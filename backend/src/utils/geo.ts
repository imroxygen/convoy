import { Participant, Destination } from '../types.js';

/**
 * Calculates the great-circle distance between two points on the Earth's surface (in kilometers)
 * using the Haversine formula.
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversineDistanceKm(lat1, lon1, lat2, lon2) * 1000;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates bearing (compass direction in degrees 0-360) between two coordinates.
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Checks whether a vehicle's coordinate is within threshold distance (default: 350 meters)
 * of the planned highway route polyline.
 * If distance > maxThresholdMeters, the driver has taken a wrong turn / deviated!
 */
export function isPointNearRoute(
  pointLat: number,
  pointLon: number,
  routeGeometry: [number, number][],
  maxThresholdMeters: number = 350
): boolean {
  if (!routeGeometry || routeGeometry.length < 2) return true;

  let minDistanceMeters = Infinity;

  // Sample along polyline segments
  for (let i = 0; i < routeGeometry.length - 1; i++) {
    const [lat1, lon1] = routeGeometry[i];
    const [lat2, lon2] = routeGeometry[i + 1];

    // Distance to segment
    const dist = distanceToSegmentMeters(pointLat, pointLon, lat1, lon1, lat2, lon2);
    if (dist < minDistanceMeters) {
      minDistanceMeters = dist;
    }

    if (minDistanceMeters <= maxThresholdMeters) {
      return true; // Fast exit if close enough to any segment
    }
  }

  return minDistanceMeters <= maxThresholdMeters;
}

function distanceToSegmentMeters(
  pLat: number,
  pLon: number,
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number
): number {
  // Approximate flat-earth projection for local segment distance
  const dAB = haversineDistanceMeters(aLat, aLon, bLat, bLon);
  if (dAB === 0) return haversineDistanceMeters(pLat, pLon, aLat, aLon);

  const t = Math.max(
    0,
    Math.min(
      1,
      ((pLat - aLat) * (bLat - aLat) + (pLon - aLon) * (bLon - aLon)) /
        (Math.pow(bLat - aLat, 2) + Math.pow(bLon - aLon, 2))
    )
  );

  const projLat = aLat + t * (bLat - aLat);
  const projLon = aLon + t * (bLon - aLon);

  return haversineDistanceMeters(pLat, pLon, projLat, projLon);
}

/**
 * Orders the convoy from Leader (closest to destination) to Tail (furthest from destination)
 * and calculates relative distance gaps between them.
 */
export function computeConvoyTelemetry(
  participantsMap: Record<string, Participant>,
  destination: Destination,
  routeGeometry?: [number, number][]
): {
  orderedParticipants: Participant[];
  leaderId: string | null;
  tailId: string | null;
  maxConvoySpreadKm: number;
} {
  const list = Object.values(participantsMap);
  if (list.length === 0) {
    return { orderedParticipants: [], leaderId: null, tailId: null, maxConvoySpreadKm: 0 };
  }

  // Update distance to destination for each participant
  for (const p of list) {
    p.distanceToDestinationKm = Number(
      haversineDistanceKm(p.lat, p.lon, destination.lat, destination.lon).toFixed(2)
    );

    if (routeGeometry && routeGeometry.length > 0) {
      p.isDeviated = !isPointNearRoute(p.lat, p.lon, routeGeometry);
    } else {
      p.isDeviated = false;
    }
  }

  // Sort: closest to destination is index 0 (Leader)
  list.sort((a, b) => a.distanceToDestinationKm - b.distanceToDestinationKm);

  const leader = list[0];
  const tail = list[list.length - 1];

  // Calculate gap from leader
  for (const p of list) {
    p.gapFromLeaderKm = Number((p.distanceToDestinationKm - leader.distanceToDestinationKm).toFixed(2));
  }

  const maxConvoySpreadKm = Number(
    (tail.distanceToDestinationKm - leader.distanceToDestinationKm).toFixed(2)
  );

  return {
    orderedParticipants: list,
    leaderId: leader.id,
    tailId: tail.id,
    maxConvoySpreadKm,
  };
}
