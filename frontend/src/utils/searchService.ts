import { computeDistanceKm } from './geo';

export interface SearchResultItem {
  id: string;
  name: string;
  secondaryText: string;
  categoryIcon: string;
  categoryName: string;
  lat: number;
  lon: number;
  distanceKm: number;
}

export interface QuickCategory {
  label: string;
  query: string;
  icon: string;
}

export const QUICK_CATEGORIES: QuickCategory[] = [
  { label: 'Petrol / EV', query: 'petrol pump', icon: '⛽' },
  { label: 'Chai & Cafe', query: 'cafe', icon: '☕' },
  { label: 'Food & Dhaba', query: 'restaurant', icon: '🍽️' },
  { label: 'Beaches', query: 'beach', icon: '🏖️' },
  { label: 'Hotels & Stays', query: 'hotel', icon: '🏨' },
  { label: 'Hill Stations', query: 'hill station', icon: '🏔️' },
];

export const POPULAR_ROAD_TRIPS = [
  { name: 'Goa', secondary: 'Baga & Coastal Goa', lat: 15.5527, lon: 73.7516, icon: '🏖️', cat: 'Beach' },
  { name: 'Lonavala', secondary: 'Western Ghats, Maharashtra', lat: 18.7557, lon: 73.4091, icon: '⛰️', cat: 'Hill Station' },
  { name: 'Manali', secondary: 'Kullu Valley, Himachal Pradesh', lat: 32.2396, lon: 77.1887, icon: '🏔️', cat: 'Mountains' },
  { name: 'Jaipur', secondary: 'Pink City, Rajasthan', lat: 26.9124, lon: 75.7873, icon: '🏰', cat: 'Heritage' },
  { name: 'Pondicherry', secondary: 'Promenade Beach & French Colony', lat: 11.9416, lon: 79.8083, icon: '🌊', cat: 'Coastal' },
  { name: 'Mysore', secondary: 'Palace City, Karnataka', lat: 12.2958, lon: 76.6394, icon: '🌴', cat: 'Heritage' },
];

/**
 * In-memory LRU cache for 0ms instantaneous keystroke matching
 */
const searchCache = new Map<string, SearchResultItem[]>();
let activeAbortController: AbortController | null = null;

/**
 * Returns an Apple/Google category icon and name based on OSM tags
 */
function getCategoryInfo(osmKey?: string, osmValue?: string, type?: string): { icon: string; name: string } {
  const val = (osmValue || type || osmKey || '').toLowerCase();

  if (val.includes('airport') || val.includes('aerodrome')) return { icon: '✈️', name: 'Airport' };
  if (val.includes('beach')) return { icon: '🏖️', name: 'Beach' };
  if (val.includes('hotel') || val.includes('resort') || val.includes('motel') || val.includes('guest_house')) return { icon: '🏨', name: 'Hotel' };
  if (val.includes('cafe') || val.includes('coffee') || val.includes('tea')) return { icon: '☕', name: 'Cafe' };
  if (val.includes('restaurant') || val.includes('food') || val.includes('fast_food') || val.includes('dhaba')) return { icon: '🍽️', name: 'Dining' };
  if (val.includes('fuel') || val.includes('petrol') || val.includes('charging_station')) return { icon: '⛽', name: 'Fuel' };
  if (val.includes('station') || val.includes('railway') || val.includes('bus') || val.includes('subway')) return { icon: '🚆', name: 'Transit' };
  if (val.includes('hospital') || val.includes('clinic') || val.includes('pharmacy')) return { icon: '🏥', name: 'Hospital' };
  if (val.includes('castle') || val.includes('monument') || val.includes('attraction') || val.includes('museum') || val.includes('temple') || val.includes('fort')) {
    return { icon: '🏰', name: 'Landmark' };
  }
  if (val.includes('park') || val.includes('garden') || val.includes('forest') || val.includes('nature_reserve')) return { icon: '🌲', name: 'Park' };
  if (val.includes('mall') || val.includes('supermarket') || val.includes('shop') || val.includes('bazaar')) return { icon: '🛍️', name: 'Shopping' };
  if (val.includes('state') || val.includes('country') || val.includes('administrative') || val.includes('city') || val.includes('town')) return { icon: '🏙️', name: 'City' };

  return { icon: '📍', name: 'Place' };
}

/**
 * Google Maps-Grade Ranking Engine
 * Combines exact token relevance, administrative prominence, and logarithmic proximity
 */
function calculateGoogleRelevanceScore(
  name: string,
  secondaryText: string,
  categoryType: string,
  distanceKm: number,
  query: string
): number {
  const q = query.toLowerCase().trim();
  const n = name.toLowerCase().trim();
  const sec = secondaryText.toLowerCase().trim();
  let score = 0;

  // 1. Textual Exact & Prefix Alignment
  if (n === q) {
    score += 2500; // Exact match: Top priority
  } else if (n.startsWith(q)) {
    score += 1400; // Prefix match: High priority
  } else if (n.includes(q)) {
    score += 700;  // Substring in title
  } else if (sec.includes(q)) {
    score += 250;  // Match in address/region
  }

  // Token boundary matching (e.g. "Goa" in "North Goa" or "South Goa")
  const tokens = n.split(/\s+/);
  if (tokens.some((t) => t.startsWith(q))) {
    score += 400;
  }

  // 2. Geographic Prominence & Entity Tier
  const typeLower = (categoryType || '').toLowerCase();
  if (['state', 'administrative', 'city', 'town', 'country'].includes(typeLower)) {
    score += 800; // Prominent destinations beat small lanes
  } else if (['aerodrome', 'airport', 'attraction', 'monument', 'landmark', 'beach', 'tourism'].includes(typeLower)) {
    score += 650;
  } else if (['hotel', 'resort', 'cafe', 'restaurant', 'fuel', 'dining'].includes(typeLower)) {
    score += 400;
  } else if (['residential', 'service', 'track', 'unclassified', 'footway', 'path'].includes(typeLower)) {
    // Penalize minor residential dirt roads unless user explicitly typed "road" or "marg"
    if (!q.includes('road') && !q.includes('marg') && !q.includes('street') && !q.includes('lane')) {
      score -= 400;
    }
  }

  // 3. Proximity Boost (Logarithmic decay so famous places far away still rank well)
  // Distance bonus up to +350 pts for very close items, smoothly decaying with distance
  const proximityBonus = Math.max(0, 350 - Math.log10(Math.max(1, distanceKm)) * 90);
  score += proximityBonus;

  return score;
}

/**
 * High-performance Google Maps-grade search:
 * - In-memory LRU cache for 0ms instant repeated keystroke responses
 * - Parallel Nominatim + Photon Elasticsearch engines with global entity recognition
 * - Smart multi-factor ranking (Exact Match > Prominent City/POIs > Proximity)
 * - Automatic deduplication & coordinate clustering
 */
export async function searchPlaces(
  query: string,
  centerLat: number,
  centerLon: number
): Promise<SearchResultItem[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const cacheKey = `${clean.toLowerCase()}_${centerLat.toFixed(2)}_${centerLon.toFixed(2)}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  // Abort previous running request to avoid out-of-order race conditions
  if (activeAbortController) {
    activeAbortController.abort();
  }
  activeAbortController = new AbortController();
  const { signal } = activeAbortController;

  const qLower = clean.toLowerCase();
  const isCategoryQuery = ['petrol', 'fuel', 'pump', 'charging', 'cafe', 'coffee', 'food', 'restaurant', 'hotel', 'hospital', 'beach', 'dhaba', 'resort'].some(
    (c) => qLower.includes(c)
  );

  const rawResults: (SearchResultItem & { score: number; type: string })[] = [];
  const seenClusters: { lat: number; lon: number; name: string }[] = [];

  const isDuplicate = (lat: number, lon: number, name: string) => {
    return seenClusters.some((c) => {
      const dist = computeDistanceKm(c.lat, c.lon, lat, lon);
      return dist < 0.25 || (c.name.toLowerCase() === name.toLowerCase() && dist < 5);
    });
  };

  const addCandidate = (
    id: string,
    name: string,
    secondaryText: string,
    catIcon: string,
    catName: string,
    lat: number,
    lon: number,
    type: string
  ) => {
    if (!name || isDuplicate(lat, lon, name)) return;

    seenClusters.push({ lat, lon, name });
    const distanceKm = computeDistanceKm(centerLat, centerLon, lat, lon);
    const score = calculateGoogleRelevanceScore(name, secondaryText, type, distanceKm, clean);

    rawResults.push({
      id,
      name,
      secondaryText,
      categoryIcon: catIcon,
      categoryName: catName,
      lat,
      lon,
      distanceKm,
      score,
      type,
    });
  };

  try {
    // Run Nominatim + Photon Global + Local in parallel for complete coverage
    const fetchPromises: Promise<void>[] = [];

    // 1. Nominatim with user-agent and address details
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      clean
    )}&addressdetails=1&limit=8${
      isCategoryQuery
        ? `&viewbox=${(centerLon - 0.6).toFixed(4)},${(centerLat + 0.6).toFixed(4)},${(centerLon + 0.6).toFixed(4)},${(centerLat - 0.6).toFixed(4)}&bounded=0`
        : ''
    }`;

    fetchPromises.push(
      fetch(nomUrl, {
        headers: { 'User-Agent': 'ConvoyNavigator/1.0' },
        signal,
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((items: any[]) => {
          if (!Array.isArray(items)) return;
          for (const item of items) {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            if (isNaN(lat) || isNaN(lon)) continue;

            const name = item.name || item.display_name.split(',')[0];
            const parts = item.display_name.split(',').map((s: string) => s.trim());
            // Secondary address: omit first part (which is usually the name)
            const secondaryText = parts.length > 1 ? parts.slice(1, 4).join(', ') : item.display_name;

            const { icon, name: catName } = getCategoryInfo(item.class, item.type, item.addresstype);
            addCandidate(
              `nom_${item.place_id || Math.random()}`,
              name,
              secondaryText,
              icon,
              catName,
              lat,
              lon,
              item.type || item.class || 'place'
            );
          }
        })
        .catch(() => {})
    );

    // 2. Photon Global Elasticsearch (Typo-tolerant POIs, cities, beaches, airports)
    const photonGlobalUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(clean)}&limit=8&lang=en`;
    fetchPromises.push(
      fetch(photonGlobalUrl, { signal })
        .then((res) => (res.ok ? res.json() : { features: [] }))
        .then((data: any) => {
          if (!data?.features || !Array.isArray(data.features)) return;
          for (const feat of data.features) {
            const props = feat.properties || {};
            const coords = feat.geometry?.coordinates;
            if (!coords || coords.length < 2) continue;

            const lon = coords[0];
            const lat = coords[1];
            const name = props.name || clean;

            const addressParts = [
              props.street ? `${props.street}${props.housenumber ? ' ' + props.housenumber : ''}` : null,
              props.district,
              props.city,
              props.state,
              props.country,
            ].filter(Boolean);

            const secondaryText = addressParts.join(', ') || props.country || 'Location';
            const { icon, name: catName } = getCategoryInfo(props.osm_key, props.osm_value, props.type);

            addCandidate(
              `photon_g_${props.osm_id || Math.random()}`,
              name,
              secondaryText,
              icon,
              catName,
              lat,
              lon,
              props.osm_value || props.type || 'place'
            );
          }
        })
        .catch(() => {})
    );

    // 3. Photon Localized (if category query or short search to prioritize immediate vicinity)
    if (isCategoryQuery || clean.length <= 4) {
      const photonLocalUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        clean
      )}&lat=${centerLat}&lon=${centerLon}&limit=6&lang=en`;
      fetchPromises.push(
        fetch(photonLocalUrl, { signal })
          .then((res) => (res.ok ? res.json() : { features: [] }))
          .then((data: any) => {
            if (!data?.features || !Array.isArray(data.features)) return;
            for (const feat of data.features) {
              const props = feat.properties || {};
              const coords = feat.geometry?.coordinates;
              if (!coords || coords.length < 2) continue;

              const lon = coords[0];
              const lat = coords[1];
              const name = props.name || clean;

              const addressParts = [
                props.street ? `${props.street}${props.housenumber ? ' ' + props.housenumber : ''}` : null,
                props.district,
                props.city,
                props.state,
                props.country,
              ].filter(Boolean);

              const secondaryText = addressParts.join(', ') || props.country || 'Location';
              const { icon, name: catName } = getCategoryInfo(props.osm_key, props.osm_value, props.type);

              addCandidate(
                `photon_l_${props.osm_id || Math.random()}`,
                name,
                secondaryText,
                icon,
                catName,
                lat,
                lon,
                props.osm_value || props.type || 'place'
              );
            }
          })
          .catch(() => {})
      );
    }

    await Promise.all(fetchPromises);
  } catch (err: any) {
    if (err?.name === 'AbortError') return [];
  }

  // Rank candidate results by Google Relevance Score (Highest score first!)
  rawResults.sort((a, b) => b.score - a.score);

  const finalResults: SearchResultItem[] = rawResults.slice(0, 8).map(({ score, type, ...item }) => item);

  // Cache up to 60 queries in memory
  if (searchCache.size > 60) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(cacheKey, finalResults);

  return finalResults;
}
