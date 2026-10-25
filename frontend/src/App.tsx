import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { X } from 'lucide-react';
import type {
  MapStyleType,
  Destination,
  Room,
  Participant,
} from './types';
import { MAP_STYLES } from './constants/mapStyles';
import { computeDistanceKm, playChime, getManeuverDisplay, calculateBearing } from './utils/geo';
import {
  createGoogleDestPinIcon,
  createGoogleOriginPinIcon,
  createGpsDotIcon,
  createGoogleNavArrowIcon,
  createSquadMemberIcon,
} from './utils/mapIcons';
import { searchPlaces, type SearchResultItem } from './utils/searchService';

// Subcomponents
import { MapToolsStack } from './components/MapToolsStack';
import { GoogleSearchBar } from './components/GoogleSearchBar';
import { DestinationPreviewCard } from './components/DestinationPreviewCard';
import { StartConvoyModal } from './components/StartConvoyModal';
import { JoinConvoyModal } from './components/JoinConvoyModal';
import { GoogleNavHeader } from './components/GoogleNavHeader';
import { GoogleDrivingDock } from './components/GoogleDrivingDock';
import { MapActionsColumn } from './components/MapActionsColumn';
import { ShareModal } from './components/ShareModal';
import { DriverAlertBanner } from './components/DriverAlertBanner';
import { ExitConvoyModal } from './components/ExitConvoyModal';

export default function App() {
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('convoy_theme') as 'dark' | 'light') || 'dark';
  });

  // User State
  const [myId] = useState(() => 'driver_' + Math.random().toString(36).substring(2, 9));
  const [myName, setMyName] = useState('');

  // Room & Convoy State
  const [room, setRoom] = useState<Room | null>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [activeAlert, setActiveAlert] = useState<{ driverName: string; message: string; type: string } | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  // Selected Squad Member for Live Distance Display & Callout
  const [selectedSquadDriver, setSelectedSquadDriver] = useState<{
    participant: Participant;
    distanceKm: number;
    distText: string;
    relativePos: string;
  } | null>(null);
  const selectedSquadDriverRef = useRef<any>(null);
  useEffect(() => {
    selectedSquadDriverRef.current = selectedSquadDriver;
  }, [selectedSquadDriver]);

  // Track previous coordinates for accurate heading rotation
  const previousCoordsRef = useRef<Record<string, { lat: number; lon: number }>>({});

  // Helper to read cached GPS coordinates
  const getCachedLocation = (): { lat: number; lon: number; accuracy?: number } | null => {
    try {
      const saved = localStorage.getItem('convoy_user_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.lat === 'number' && typeof parsed.lon === 'number') {
          return { lat: parsed.lat, lon: parsed.lon, accuracy: parsed.accuracy || 100 };
        }
      }
    } catch (e) {}
    return null;
  };

  // Google Maps Search & Destination State
  const [destination, setDestination] = useState<Destination | null>(null);
  const [startPos, setStartPos] = useState<{ lat: number; lon: number }>(() => {
    const cached = getCachedLocation();
    return cached ? { lat: cached.lat, lon: cached.lon } : { lat: 23.0667, lon: 88.8167 };
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchDebounceRef = useRef<any>(null);

  // Route preview details & Turn-by-Turn Maneuvers
  const [previewDistanceKm, setPreviewDistanceKm] = useState<number>(0);
  const [previewDurationMins, setPreviewDurationMins] = useState<number>(0);
  const [previewRouteCoords, setPreviewRouteCoords] = useState<[number, number][]>([]);
  const [routeSteps, setRouteSteps] = useState<any[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Modals: Name only
  const [showStartConvoyModal, setShowStartConvoyModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [driverName, setDriverName] = useState(() => localStorage.getItem('convoy_driver_name') || 'Amit');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinName, setJoinName] = useState('');

  // Driving State
  const [isFollowMe, setIsFollowMe] = useState(true);

  // Map Style & Layers State (Defaults to Google Streets)
  const [currentMapStyle, setCurrentMapStyle] = useState<MapStyleType>(() => {
    return (localStorage.getItem('convoy_map_style') as MapStyleType) || 'google-streets';
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // GPS State
  const [isLocating, setIsLocating] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [myGpsCoords, setMyGpsCoords] = useState<{ lat: number; lon: number; accuracy: number } | null>(() => {
    const cached = getCachedLocation();
    return cached ? { lat: cached.lat, lon: cached.lon, accuracy: cached.accuracy || 100 } : null;
  });
  const [locationToast, setLocationToast] = useState<{ msg: string; type: 'error' | 'success' | 'info' } | null>(null);

  // Leaflet & WebSocket Refs
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const destMarkerRef = useRef<L.Marker | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const myLocationMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const gapLinesRef = useRef<L.Polyline[]>([]);
  const watchIdRef = useRef<number | null>(null);

  // Google Navigation Live Test Drive Simulator State
  const [isSimulating, setIsSimulating] = useState(false);
  const simIntervalRef = useRef<any>(null);
  const simIndexRef = useRef(0);

  const myGpsCoordsRef = useRef<{ lat: number; lon: number; accuracy: number } | null>(myGpsCoords);
  useEffect(() => {
    myGpsCoordsRef.current = myGpsCoords;
  }, [myGpsCoords]);

  const startPosRef = useRef<{ lat: number; lon: number }>(startPos);
  useEffect(() => {
    startPosRef.current = startPos;
  }, [startPos]);

  const isFollowMeRef = useRef(isFollowMe);
  useEffect(() => {
    isFollowMeRef.current = isFollowMe;
  }, [isFollowMe]);

  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const showStartConvoyModalRef = useRef(showStartConvoyModal);
  useEffect(() => {
    showStartConvoyModalRef.current = showStartConvoyModal;
  }, [showStartConvoyModal]);

  const showJoinModalRef = useRef(showJoinModal);
  useEffect(() => {
    showJoinModalRef.current = showJoinModal;
  }, [showJoinModal]);

  // Clean up live GPS watcher & simulation on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    };
  }, []);

  // Google Maps continuous live GPS tracking
  const startLiveGpsTracking = (targetMap?: L.Map | null) => {
    if (!navigator.geolocation || watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;
        const coords = { lat: latitude, lon: longitude, accuracy };
        myGpsCoordsRef.current = coords;
        startPosRef.current = { lat: latitude, lon: longitude };
        setMyGpsCoords(coords);
        setStartPos({ lat: latitude, lon: longitude });

        const activeMap = targetMap || mapRef.current;
        if (activeMap) {
          if (myLocationMarkerRef.current) {
            myLocationMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            myLocationMarkerRef.current = L.marker([latitude, longitude], {
              icon: createGpsDotIcon(),
              zIndexOffset: 1000,
            }).addTo(activeMap);
          }

          if (isFollowMeRef.current && !roomRef.current) {
            activeMap.panTo([latitude, longitude], { animate: true });
          }
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'LOCATION_UPDATE',
              payload: {
                lat: latitude,
                lon: longitude,
                speed: speed ? Math.round(speed * 3.6) : 0,
                heading: heading || 0,
              },
            })
          );
        }
      },
      (err) => {
        console.warn('Live GPS watch notice:', err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
    );
  };

  // Sync user location immediately like Google Maps
  const syncUserLocation = (opts?: {
    mapInstance?: L.Map | null;
    flyTo?: boolean;
    showToast?: boolean;
    openPopup?: boolean;
  }) => {
    const activeMap = opts?.mapInstance || mapRef.current;
    const shouldFlyTo = opts?.flyTo ?? true;
    const shouldShowToast = opts?.showToast ?? false;
    const shouldOpenPopup = opts?.openPopup ?? false;

    if (!navigator.geolocation) {
      if (shouldShowToast) {
        setLocationToast({ msg: 'Geolocation not supported by your browser.', type: 'error' });
        setTimeout(() => setLocationToast(null), 4000);
      }
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setHasLocation(true);
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;
        const coords = { lat: latitude, lon: longitude, accuracy };
        myGpsCoordsRef.current = coords;
        startPosRef.current = { lat: latitude, lon: longitude };
        setMyGpsCoords(coords);
        setStartPos({ lat: latitude, lon: longitude });

        try {
          localStorage.setItem('convoy_user_location', JSON.stringify({ lat: latitude, lon: longitude }));
        } catch (e) {}

        const currentMap = activeMap || mapRef.current;
        if (currentMap) {
          if (shouldFlyTo) {
            currentMap.flyTo([latitude, longitude], Math.max(currentMap.getZoom(), 16), {
              duration: 1.2,
              easeLinearity: 0.25,
            });
          }

          if (myLocationMarkerRef.current) {
            myLocationMarkerRef.current.setLatLng([latitude, longitude]);
            if (shouldOpenPopup) myLocationMarkerRef.current.openPopup();
          } else {
            myLocationMarkerRef.current = L.marker([latitude, longitude], {
              icon: createGpsDotIcon(),
              zIndexOffset: 1000,
            }).addTo(currentMap);
            if (shouldOpenPopup) {
              myLocationMarkerRef.current
                .bindPopup(`<b>📍 Your Location</b><br>Accuracy: ±${Math.round(accuracy)}m`)
                .openPopup();
            }
          }
        }

        if (shouldShowToast) {
          setLocationToast({ msg: `📍 Found your location (±${Math.round(accuracy)}m)`, type: 'success' });
          setTimeout(() => setLocationToast(null), 3000);
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'LOCATION_UPDATE',
              payload: {
                lat: latitude,
                lon: longitude,
                speed: speed ? Math.round(speed * 3.6) : 0,
                heading: heading || 0,
              },
            })
          );
        }

        // Keep continuous live syncing active
        startLiveGpsTracking(currentMap);
      },
      async (err) => {
        setIsLocating(false);
        // Fallback: fast IP-based geolocation so user is centered in their actual city
        try {
          const ipRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
          const ipData = await ipRes.json();
          if (ipData && ipData.latitude && ipData.longitude) {
            const ipLat = parseFloat(ipData.latitude);
            const ipLon = parseFloat(ipData.longitude);
            startPosRef.current = { lat: ipLat, lon: ipLon };
            setStartPos({ lat: ipLat, lon: ipLon });
            const currentMap = activeMap || mapRef.current;
            if (currentMap && !hasLocation) {
              currentMap.setView([ipLat, ipLon], 12);
            }
          }
        } catch (e) {}

        if (shouldShowToast) {
          let msg = 'Could not get location. Check browser permissions.';
          if (err.code === 1) msg = 'Location permission denied. Please allow GPS access in browser.';
          else if (err.code === 2) msg = 'GPS signal unavailable.';
          else if (err.code === 3) msg = 'Location request timed out.';
          setLocationToast({ msg, type: 'error' });
          setTimeout(() => setLocationToast(null), 4500);
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Theme Sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('convoy_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Switch Map Style dynamically (Google Streets, Satellite, Terrain, Dark)
  const handleSwitchMapStyle = (styleKey: MapStyleType) => {
    setCurrentMapStyle(styleKey);
    localStorage.setItem('convoy_map_style', styleKey);
    setShowLayerMenu(false);

    if (!mapRef.current) return;
    const config = MAP_STYLES[styleKey] || MAP_STYLES['google-streets'];

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      subdomains: config.subdomains || ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps & Convoy',
    }).addTo(mapRef.current);
  };

  // Initialize Map immediately on page load with Google Maps Tiles & Auto Location Sync
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Check for cached user location so the map immediately loads in the user's city
    const cached = getCachedLocation();
    let initialCenter: [number, number] = cached
      ? [cached.lat, cached.lon]
      : [startPosRef.current.lat, startPosRef.current.lon];
    let initialZoom = cached ? 15 : 12;

    const map = L.map(mapContainerRef.current, { zoomControl: false }).setView(initialCenter, initialZoom);

    const initialStyleKey = (localStorage.getItem('convoy_map_style') as MapStyleType) || 'google-streets';
    const config = MAP_STYLES[initialStyleKey] || MAP_STYLES['google-streets'];

    tileLayerRef.current = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      subdomains: config.subdomains || ['0', '1', '2', '3'],
      attribution: '&copy; Google Maps',
    }).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    map.on('dragstart', () => setIsFollowMe(false));

    map.on('click', async (e: L.LeafletMouseEvent) => {
      // If a convoy room is active, the route and destination are locked!
      if (roomRef.current) {
        if (selectedSquadDriverRef.current) {
          setSelectedSquadDriver(null);
        }
        return;
      }

      // Ignore map clicks if launch/join dialogs are open
      if (showStartConvoyModalRef.current || showJoinModalRef.current) {
        return;
      }

      const { lat, lng } = e.latlng;
      await handleMapClick(lat, lng);
    });

    mapRef.current = map;

    // Google Maps Auto-Sync: Immediately sync current user GPS location on load
    syncUserLocation({ mapInstance: map, flyTo: true, showToast: false });

    // Check URL params for WhatsApp invite link
    const params = new URLSearchParams(window.location.search);
    const paramRoom = params.get('room');
    if (paramRoom) {
      setShowJoinModal(true);
      setJoinRoomCode(paramRoom.toUpperCase());
    }
  }, []);

  // Resolves the real-time current user GPS or network location dynamically
  const getLiveUserLocation = async (): Promise<[number, number]> => {
    // 1. If high-accuracy GPS coordinates already resolved in ref
    if (myGpsCoordsRef.current) {
      return [myGpsCoordsRef.current.lat, myGpsCoordsRef.current.lon];
    }

    // 2. Query browser geolocation with quick timeout to guarantee fresh location
    if (navigator.geolocation) {
      try {
        const fix = await new Promise<{ lat: number; lon: number }>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
              myGpsCoordsRef.current = coords;
              startPosRef.current = { lat: coords.lat, lon: coords.lon };
              setMyGpsCoords(coords);
              setStartPos({ lat: coords.lat, lon: coords.lon });
              try {
                localStorage.setItem('convoy_user_location', JSON.stringify(coords));
              } catch (e) {}
              resolve({ lat: coords.lat, lon: coords.lon });
            },
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 3500, maximumAge: 10000 }
          );
        });
        return [fix.lat, fix.lon];
      } catch (e) {}
    }

    // 3. Fallback to startPosRef (cached or IP detected)
    if (startPosRef.current) {
      return [startPosRef.current.lat, startPosRef.current.lon];
    }

    // 4. Map center if available
    if (mapRef.current) {
      const c = mapRef.current.getCenter();
      return [c.lat, c.lng];
    }

    return [23.0667, 88.8167];
  };

  // Compute Highway Route and Drop Google Pin with Pinpoint Accuracy
  const selectDestinationAndRoute = async (lat: number, lon: number, name: string) => {
    // When convoy is active/started, locked to squad navigation
    if (roomRef.current) return;
    const latFixed = Number(lat.toFixed(6));
    const lonFixed = Number(lon.toFixed(6));
    const newDest: Destination = { name, lat: latFixed, lon: lonFixed };
    setDestination(newDest);
    setSearchQuery(name);
    setIsSearchFocused(false);
    setSearchResults([]);

    // Always calculate route from user's live current location
    const start = await getLiveUserLocation();

    let routeCoords: [number, number][] = [];
    let steps: any[] = [];
    let distKm = 0;
    let durMins = 0;

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${lonFixed},${latFixed}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        routeCoords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
        distKm = Number((data.routes[0].distance / 1000).toFixed(1));
        durMins = Math.round(data.routes[0].duration / 60);
        if (data.routes[0].legs?.[0]?.steps) {
          steps = data.routes[0].legs[0].steps;
        }
      }
    } catch (e) {
      console.warn('Highway route fetch failed:', e);
    }

    setPreviewDistanceKm(distKm);
    setPreviewDurationMins(durMins);
    setPreviewRouteCoords(routeCoords);
    setRouteSteps(steps);
    setCurrentStepIndex(0);

    const map = mapRef.current;
    if (map) {
      if (destMarkerRef.current) map.removeLayer(destMarkerRef.current);
      if (originMarkerRef.current) map.removeLayer(originMarkerRef.current);
      if (routeLayerGroupRef.current) map.removeLayer(routeLayerGroupRef.current);

      // Google Origin Marker
      originMarkerRef.current = L.marker([start[0], start[1]], {
        icon: createGoogleOriginPinIcon(),
        zIndexOffset: 500,
      }).addTo(map);

      // Google Red Teardrop Pin
      destMarkerRef.current = L.marker([latFixed, lonFixed], {
        icon: createGoogleDestPinIcon(name),
        zIndexOffset: 600,
      })
        .addTo(map)
        .bindPopup(`<b>📍 ${name}</b><br>Goal Destination`);

      if (routeCoords.length > 0) {
        // Dual-stroke Google navigation route
        const outerCasing = L.polyline(routeCoords, {
          color: theme === 'dark' ? '#0f2b48' : '#174ea6',
          weight: 10,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        });

        const innerCore = L.polyline(routeCoords, {
          color: theme === 'dark' ? '#38bdf8' : '#1a73e8',
          weight: 6,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        });

        routeLayerGroupRef.current = L.layerGroup([outerCasing, innerCore]).addTo(map);
        map.fitBounds(outerCasing.getBounds(), { padding: [70, 70] });
      } else {
        map.setView([latFixed, lonFixed], 15);
      }
    }
  };

  const handleClearDestination = () => {
    if (roomRef.current) return;
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {}
    setDestination(null);
    setSearchQuery('');
    setSearchResults([]);
    setPreviewRouteCoords([]);
    setRouteSteps([]);
    setCurrentStepIndex(0);
    setPreviewDistanceKm(0);
    setPreviewDurationMins(0);
    const map = mapRef.current;
    if (map) {
      if (destMarkerRef.current) {
        map.removeLayer(destMarkerRef.current);
        destMarkerRef.current = null;
      }
      if (originMarkerRef.current) {
        map.removeLayer(originMarkerRef.current);
        originMarkerRef.current = null;
      }
      if (routeLayerGroupRef.current) {
        map.removeLayer(routeLayerGroupRef.current);
        routeLayerGroupRef.current = null;
      }
    }
  };

  const handleMapClick = async (lat: number, lon: number) => {
    if (roomRef.current) return;
    let placeName = `Pin (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
      );
      const data = await res.json();
      if (data && data.display_name) {
        placeName =
          data.name ||
          data.address?.amenity ||
          data.address?.building ||
          data.address?.road ||
          data.address?.suburb ||
          data.address?.city ||
          data.display_name.split(',')[0];
      }
    } catch (e) {}

    await selectDestinationAndRoute(lat, lon, placeName);
  };

  // High-performance search with debouncing (Photon Elasticsearch + Nominatim)
  const handleSearchPlaces = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setIsSearching(true);

    searchDebounceRef.current = setTimeout(async () => {
      const centerLat = myGpsCoordsRef.current?.lat ?? startPosRef.current?.lat ?? mapRef.current?.getCenter().lat ?? 23.0667;
      const centerLon = myGpsCoordsRef.current?.lon ?? startPosRef.current?.lon ?? mapRef.current?.getCenter().lng ?? 88.8167;

      const items = await searchPlaces(query, centerLat, centerLon);
      setSearchResults(items);
      setIsSearching(false);
    }, 200);
  };

  const handleSelectSearchResult = async (item: SearchResultItem) => {
    await selectDestinationAndRoute(item.lat, item.lon, item.name);
  };

  // GPS Location Handler (Google Maps crosshairs button)
  const handleGetMyLocation = () => {
    setIsFollowMe(true);
    const map = mapRef.current;
    if (myGpsCoords && map) {
      map.flyTo([myGpsCoords.lat, myGpsCoords.lon], Math.max(map.getZoom(), 16), {
        duration: 1.0,
        easeLinearity: 0.25,
      });
      if (myLocationMarkerRef.current) {
        myLocationMarkerRef.current.openPopup();
      }
    }
    syncUserLocation({ flyTo: true, showToast: true, openPopup: true });
  };

  // Connect WebSocket
  const connectWs = (
    roomCode: string,
    secretKey: string,
    initialLat: number,
    initialLon: number,
    participantName?: string
  ) => {
    const chosenName = (participantName || myName || driverName || 'Driver').trim();
    setMyName(chosenName);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          payload: {
            roomCode,
            secretKey,
            participantId: myId,
            name: chosenName,
            vehicleType: 'CAR',
            initialLat,
            initialLon,
          },
        })
      );
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'ROOM_JOINED') {
        roomRef.current = msg.payload.room;
        setRoom(msg.payload.room);
        setTelemetry(msg.payload.telemetry);
        drawDestinationAndRoute(msg.payload.room);
      } else if (msg.type === 'CONVOY_UPDATE') {
        setRoom((prev) => (prev ? { ...prev, participants: msg.payload.participants } : null));
        setTelemetry(msg.payload.telemetry);
        updateMapMarkers(msg.payload.participants);
      } else if (msg.type === 'ALERT_BROADCAST') {
        const p = msg.payload.participants[msg.payload.participantId];
        setActiveAlert({
          driverName: p ? `${p.name} (${p.vehicleType})` : 'Driver Alert',
          message: msg.payload.alert.message,
          type: msg.payload.alert.type,
        });
        playChime();
      } else if (msg.type === 'ERROR') {
        setLocationToast({ msg: `⚠️ ${msg.payload.message || 'Error occurred'}`, type: 'error' });
        setTimeout(() => setLocationToast(null), 4000);
      }
    };

    wsRef.current = ws;
  };

  const drawDestinationAndRoute = (currentRoom: Room) => {
    const map = mapRef.current;
    if (!map) return;

    if (destMarkerRef.current) map.removeLayer(destMarkerRef.current);
    if (originMarkerRef.current) map.removeLayer(originMarkerRef.current);
    if (routeLayerGroupRef.current) map.removeLayer(routeLayerGroupRef.current);

    const dest = currentRoom.destination;
    destMarkerRef.current = L.marker([dest.lat, dest.lon], {
      icon: createGoogleDestPinIcon(dest.name),
      zIndexOffset: 600,
    })
      .addTo(map)
      .bindPopup(`<b>📍 ${dest.name}</b><br>Goal Destination`);

    if (currentRoom.routeGeometry && currentRoom.routeGeometry.length > 0) {
      const coords = currentRoom.routeGeometry;
      originMarkerRef.current = L.marker([coords[0][0], coords[0][1]], {
        icon: createGoogleOriginPinIcon(),
        zIndexOffset: 500,
      }).addTo(map);

      // Google Dual-Stroke Route: Outer border casing + Inner electric blue
      const outerCasing = L.polyline(coords, {
        color: theme === 'dark' ? '#0f2b48' : '#174ea6',
        weight: 10,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      });

      const innerCore = L.polyline(coords, {
        color: theme === 'dark' ? '#38bdf8' : '#1a73e8',
        weight: 6,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      });

      routeLayerGroupRef.current = L.layerGroup([outerCasing, innerCore]).addTo(map);
      map.fitBounds(outerCasing.getBounds(), { padding: [60, 60] });
    }

    if (currentRoom.routeSteps && currentRoom.routeSteps.length > 0) {
      setRouteSteps(currentRoom.routeSteps);
    }
  };

  const updateMapMarkers = (participants: Record<string, Participant>) => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(Object.keys(participants));

    // When in active convoy room, remove the default static blue GPS dot so the Google Navigation Arrow is the single focus
    if (participants[myId] && myLocationMarkerRef.current) {
      map.removeLayer(myLocationMarkerRef.current);
      myLocationMarkerRef.current = null;
    }

    const myLat = participants[myId]?.lat ?? myGpsCoordsRef.current?.lat ?? startPosRef.current.lat;
    const myLon = participants[myId]?.lon ?? myGpsCoordsRef.current?.lon ?? startPosRef.current.lon;

    for (const id in participants) {
      const p = participants[id];
      const isMe = p.id === myId;

      if (isMe) {
        // Authentic Google Navigation 3D Chevron Arrow for current user
        let heading = p.heading || 0;
        const prev = previousCoordsRef.current[p.id];
        if (prev && (prev.lat !== p.lat || prev.lon !== p.lon)) {
          heading = calculateBearing(prev.lat, prev.lon, p.lat, p.lon);
        }
        previousCoordsRef.current[p.id] = { lat: p.lat, lon: p.lon };

        const icon = createGoogleNavArrowIcon(heading, p.name || myName || 'You');

        if (!markersRef.current[p.id]) {
          markersRef.current[p.id] = L.marker([p.lat, p.lon], { icon, zIndexOffset: 1200 }).addTo(map);
        } else {
          markersRef.current[p.id].setLatLng([p.lat, p.lon]);
          markersRef.current[p.id].setIcon(icon);
          markersRef.current[p.id].setZIndexOffset(1200);
        }
      } else {
        // Squad member icon with vehicle avatar & name tag
        const icon = createSquadMemberIcon(p);
        const distKm = computeDistanceKm(myLat, myLon, p.lat, p.lon);
        const distText =
          distKm < 0.05
            ? 'Right next to you'
            : distKm < 1
            ? `${Math.round(distKm * 1000)} m away`
            : `${distKm.toFixed(1)} km away`;

        // Compute relative order in convoy
        let relativePos = 'Convoy member';
        const ord = telemetry?.orderedParticipants;
        if (ord && ord.length > 1) {
          const myIdx = ord.findIndex((x: any) => x.id === myId);
          const theirIdx = ord.findIndex((x: any) => x.id === p.id);
          if (myIdx !== -1 && theirIdx !== -1) {
            if (theirIdx < myIdx) {
              relativePos = `${distText} ahead of you`;
            } else if (theirIdx > myIdx) {
              relativePos = `${distText} behind you`;
            } else {
              relativePos = 'Driving alongside you';
            }
          }
        }

        const popupHtml = `
          <div class="squad-distance-popup">
            <div class="popup-header-row">
              <span class="popup-emoji">${p.vehicleType === 'BIKE' ? '🏍️' : '🚗'}</span>
              <span class="popup-driver-name">${p.name}</span>
              <span class="popup-badge ${p.isDeviated ? 'deviated' : 'ok'}">${p.isDeviated ? 'Off-Route' : 'On Route'}</span>
            </div>
            <div class="popup-distance-hero">
              <div class="popup-distance-val">${distText}</div>
              <div class="popup-distance-rel">${relativePos}</div>
            </div>
            <div class="popup-meta-row">
              <span>⚡ Speed: <b>${Math.round(p.speed)} km/h</b></span>
              <span>📍 Status: <b>${p.isDeviated ? 'Deviated' : 'On Track'}</b></span>
            </div>
          </div>
        `;

        let marker = markersRef.current[p.id];
        if (!marker) {
          marker = L.marker([p.lat, p.lon], { icon, zIndexOffset: 800 }).addTo(map);
          markersRef.current[p.id] = marker;
        } else {
          marker.setLatLng([p.lat, p.lon]);
          marker.setIcon(icon);
        }

        marker.bindPopup(popupHtml, { closeButton: false, offset: [0, -10] });
        marker.off('click');
        marker.on('click', () => {
          setSelectedSquadDriver({
            participant: p,
            distanceKm: distKm,
            distText,
            relativePos,
          });
          marker.openPopup();
        });

        // Live update active distance card if this driver is selected
        if (selectedSquadDriverRef.current?.participant.id === p.id) {
          setSelectedSquadDriver({
            participant: p,
            distanceKm: distKm,
            distText,
            relativePos,
          });
        }
      }
    }

    for (const id in markersRef.current) {
      if (!currentIds.has(id)) {
        map.removeLayer(markersRef.current[id]);
        delete markersRef.current[id];
      }
    }

    // Inter-vehicle Convoy Gap Lines on the map
    if (gapLinesRef.current.length > 0) {
      gapLinesRef.current.forEach((l) => map.removeLayer(l));
      gapLinesRef.current = [];
    }

    const ordered = telemetry?.orderedParticipants || Object.values(participants);
    if (ordered.length > 1) {
      for (let i = 0; i < ordered.length - 1; i++) {
        const p1 = ordered[i];
        const p2 = ordered[i + 1];
        if (p1 && p2 && p1.lat && p2.lat) {
          const line = L.polyline(
            [
              [p1.lat, p1.lon],
              [p2.lat, p2.lon],
            ],
            {
              color: '#38bdf8',
              weight: 3,
              dashArray: '6, 8',
              opacity: 0.85,
            }
          ).addTo(map);
          gapLinesRef.current.push(line);
        }
      }
    }

    if (isFollowMe && participants[myId]) {
      map.panTo([participants[myId].lat, participants[myId].lon], { animate: true });
    }
  };

  // Launch Convoy (Only Name Required)
  const handleStartConvoySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) return;

    const finalLeaderName = driverName.trim() || 'Driver';
    localStorage.setItem('convoy_driver_name', finalLeaderName);
    setMyName(finalLeaderName);

    const tripName = `${destination.name} Convoy`;
    const secretKey = '';

    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripName,
        secretKey,
        destination,
        routeGeometry: previewRouteCoords,
        routeSteps,
        totalDistanceKm: previewDistanceKm || 35,
        estimatedDurationMins: previewDurationMins || 45,
      }),
    });

    const newRoom = await res.json();
    roomRef.current = newRoom;
    setRoom(newRoom);
    setShowStartConvoyModal(false);

    // Copy squad room code to clipboard
    try {
      await navigator.clipboard.writeText(newRoom.code);
      setLocationToast({ msg: `📋 Squad Code copied: ${newRoom.code}`, type: 'success' });
      setTimeout(() => setLocationToast(null), 3000);
    } catch (e) {}

    setShowShareModal(true);
    const launchCoords = myGpsCoordsRef.current || startPosRef.current;
    connectWs(newRoom.code, secretKey, launchCoords.lat, launchCoords.lon, finalLeaderName);
  };

  // Join Existing Squad
  const handleJoinTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = joinName.trim() || 'Driver';
    setMyName(finalName);
    localStorage.setItem('convoy_driver_name', finalName);

    const res = await fetch('/api/rooms/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: joinRoomCode.trim().toUpperCase(), secretKey: '' }),
    });

    const verifyData = await res.json();
    if (!res.ok) {
      setLocationToast({ msg: `⚠️ ${verifyData.error || 'Verification failed. Please check the room code.'}`, type: 'error' });
      setTimeout(() => setLocationToast(null), 4000);
      return;
    }

    const currentRoom = verifyData.room;
    roomRef.current = currentRoom;
    setRoom(currentRoom);
    setShowJoinModal(false);

    const myCoords = myGpsCoordsRef.current || startPosRef.current;
    const startLat = myCoords?.lat ?? currentRoom.routeGeometry?.[0]?.[0] ?? (currentRoom.destination.lat - 0.1);
    const startLon = myCoords?.lon ?? currentRoom.routeGeometry?.[0]?.[1] ?? (currentRoom.destination.lon - 0.1);
    connectWs(currentRoom.code, '', startLat, startLon, finalName);
  };

  // Google Navigation Turn-by-Turn Driving Simulator
  const toggleSimulation = () => {
    if (isSimulating) {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      setIsSimulating(false);
      setLocationToast({ msg: '⏸️ Drive simulation paused', type: 'info' });
      setTimeout(() => setLocationToast(null), 2500);
      return;
    }

    const currentCoords = roomRef.current?.routeGeometry || previewRouteCoords;
    if (!currentCoords || currentCoords.length < 2) {
      setLocationToast({ msg: '⚠️ No route geometry found to simulate driving on', type: 'error' });
      setTimeout(() => setLocationToast(null), 3000);
      return;
    }

    setIsSimulating(true);
    setLocationToast({ msg: '🚗💨 Starting Google Navigation drive simulation...', type: 'success' });
    setTimeout(() => setLocationToast(null), 3000);

    if (simIntervalRef.current) clearInterval(simIntervalRef.current);

    simIntervalRef.current = setInterval(() => {
      const activeCoords = roomRef.current?.routeGeometry || previewRouteCoords;
      if (!activeCoords || activeCoords.length < 2) return;

      simIndexRef.current = (simIndexRef.current + 1) % activeCoords.length;
      const curr = activeCoords[simIndexRef.current];
      const next = activeCoords[(simIndexRef.current + 1) % activeCoords.length];
      const heading = calculateBearing(curr[0], curr[1], next[0], next[1]);

      const newCoords = { lat: curr[0], lon: curr[1], accuracy: 5 };
      myGpsCoordsRef.current = newCoords;
      setMyGpsCoords(newCoords);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'LOCATION_UPDATE',
            payload: {
              lat: curr[0],
              lon: curr[1],
              speed: 55, // 55 km/h driving speed
              heading,
            },
          })
        );
      } else if (mapRef.current) {
        if (myLocationMarkerRef.current) {
          myLocationMarkerRef.current.setLatLng([curr[0], curr[1]]);
          myLocationMarkerRef.current.setIcon(createGoogleNavArrowIcon(heading, myName || 'You'));
        }
        if (isFollowMeRef.current) {
          mapRef.current.panTo([curr[0], curr[1]], { animate: true });
        }
      }
    }, 1200);
  };

  // Smoothly exit convoy without native browser popups, and reset URL cleanly
  const handleConfirmExitConvoy = () => {
    // 1. Reset URL query params without reloading the page
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {}

    // 2. Stop live simulation
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setIsSimulating(false);

    // 3. Disconnect WebSocket cleanly
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    // 4. Clean up all map route layers, pins, and squad markers
    const map = mapRef.current;
    if (map) {
      if (destMarkerRef.current) {
        map.removeLayer(destMarkerRef.current);
        destMarkerRef.current = null;
      }
      if (originMarkerRef.current) {
        map.removeLayer(originMarkerRef.current);
        originMarkerRef.current = null;
      }
      if (routeLayerGroupRef.current) {
        map.removeLayer(routeLayerGroupRef.current);
        routeLayerGroupRef.current = null;
      }
      gapLinesRef.current.forEach((line) => map.removeLayer(line));
      gapLinesRef.current = [];

      for (const id in markersRef.current) {
        map.removeLayer(markersRef.current[id]);
      }
      markersRef.current = {};

      // Restore user's standard blue GPS locator dot
      const curCoords = myGpsCoordsRef.current || startPosRef.current;
      if (curCoords && !myLocationMarkerRef.current) {
        myLocationMarkerRef.current = L.marker([curCoords.lat, curCoords.lon], {
          icon: createGpsDotIcon(),
          zIndexOffset: 1000,
        }).addTo(map);
      }
    }

    // 5. Reset all active convoy and route states
    roomRef.current = null;
    setRoom(null);
    setTelemetry(null);
    setDestination(null);
    setSearchQuery('');
    setSearchResults([]);
    setPreviewRouteCoords([]);
    setRouteSteps([]);
    setCurrentStepIndex(0);
    setPreviewDistanceKm(0);
    setPreviewDurationMins(0);
    setSelectedSquadDriver(null);
    setActiveAlert(null);
    setShowShareModal(false);
    setShowExitConfirmModal(false);

    // 6. User feedback toast
    setLocationToast({ msg: '🏁 Left convoy navigation. Safe driving!', type: 'info' });
    setTimeout(() => setLocationToast(null), 3000);
  };

  const sendPing = (alertType: 'FUEL' | 'REST' | 'EMERGENCY') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'DRIVER_PING', payload: { alertType } }));
    }
  };

  const fitAllConvoy = () => {
    const map = mapRef.current;
    if (!map) return;
    const points: L.LatLng[] = [];
    for (const id in markersRef.current) {
      points.push(markersRef.current[id].getLatLng());
    }
    if (destMarkerRef.current) points.push(destMarkerRef.current.getLatLng());

    if (points.length > 0) {
      setIsFollowMe(false);
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 15 });
    }
  };

  const getShareUrl = () => {
    if (!room) return '';
    return `${window.location.origin}/?room=${room.code}&key=${encodeURIComponent(room.secretKey)}`;
  };

  const participantsList = room ? Object.values(room.participants) : [];
  const leaderParticipant = telemetry?.orderedParticipants?.[0];
  const myParticipant = room?.participants?.[myId];
  const activeStep = routeSteps[currentStepIndex] || null;
  const nextStep = routeSteps[currentStepIndex + 1] || null;
  const currentManeuver = getManeuverDisplay(activeStep);
  const nextManeuver = nextStep ? getManeuverDisplay(nextStep) : null;

  return (
    <>
      {/* 100% Fullscreen Map Layer */}
      <div ref={mapContainerRef} className="map-canvas" />

      {/* Floating Map Tools (Layers & My Location) */}
      <MapToolsStack
        showLayerMenu={showLayerMenu}
        setShowLayerMenu={setShowLayerMenu}
        currentMapStyle={currentMapStyle}
        onSwitchMapStyle={handleSwitchMapStyle}
        isLocating={isLocating}
        hasLocation={hasLocation}
        onGetMyLocation={handleGetMyLocation}
        locationToast={locationToast}
      />

      {/* Top Google Maps Search Bar (Before Room Launch) */}
      {!room && (
        <GoogleSearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
          isSearchFocused={isSearchFocused}
          setIsSearchFocused={setIsSearchFocused}
          onSearch={handleSearchPlaces}
          onSelectResult={handleSelectSearchResult}
          onOpenJoinModal={() => setShowJoinModal(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          currentCoords={myGpsCoordsRef.current || startPosRef.current}
        />
      )}

      {/* Destination Preview Card */}
      {!room && destination && (
        <DestinationPreviewCard
          destination={destination}
          previewDistanceKm={previewDistanceKm}
          previewDurationMins={previewDurationMins}
          onClearDestination={handleClearDestination}
          onOpenStartModal={() => setShowStartConvoyModal(true)}
        />
      )}

      {/* Start Convoy Modal (Name Only) */}
      {showStartConvoyModal && destination && (
        <StartConvoyModal
          destination={destination}
          driverName={driverName}
          setDriverName={setDriverName}
          onClose={() => setShowStartConvoyModal(false)}
          onSubmit={handleStartConvoySubmit}
        />
      )}

      {/* Join Squad Modal (Room Code & Name) */}
      {showJoinModal && (
        <JoinConvoyModal
          joinRoomCode={joinRoomCode}
          setJoinRoomCode={setJoinRoomCode}
          joinName={joinName}
          setJoinName={setJoinName}
          onClose={() => setShowJoinModal(false)}
          onSubmit={handleJoinTrip}
        />
      )}

      {/* Active Navigation: Google Green Turn-by-Turn Header & Driving Dock */}
      {room && (
        <>
          <GoogleNavHeader
            currentManeuver={currentManeuver}
            nextManeuver={nextManeuver}
            participantsList={participantsList}
            orderedParticipants={telemetry?.orderedParticipants}
            myId={myId}
            theme={theme}
            roomCode={room.code}
            onToggleTheme={toggleTheme}
            onOpenShareModal={() => setShowShareModal(true)}
            onExitNav={() => setShowExitConfirmModal(true)}
            onFocusDriver={(driver) => {
              if (driver.id === myId) {
                setIsFollowMe(true);
                if (mapRef.current) mapRef.current.flyTo([driver.lat, driver.lon], 16, { duration: 0.8 });
                return;
              }
              setIsFollowMe(false);
              const myLat = room?.participants?.[myId]?.lat ?? myGpsCoordsRef.current?.lat ?? startPosRef.current.lat;
              const myLon = room?.participants?.[myId]?.lon ?? myGpsCoordsRef.current?.lon ?? startPosRef.current.lon;
              const distKm = computeDistanceKm(myLat, myLon, driver.lat, driver.lon);
              const distText = distKm < 0.05 ? 'Right next to you' : distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;

              setSelectedSquadDriver({
                participant: driver,
                distanceKm: distKm,
                distText,
                relativePos: `${distText} from your location`,
              });

              if (mapRef.current) {
                mapRef.current.flyTo([driver.lat, driver.lon], 16, { duration: 0.8 });
                markersRef.current[driver.id]?.openPopup();
              }
            }}
          />

          <MapActionsColumn
            showLayerMenu={showLayerMenu}
            setShowLayerMenu={setShowLayerMenu}
            isLocating={isLocating}
            hasLocation={hasLocation}
            onGetMyLocation={handleGetMyLocation}
            isFollowMe={isFollowMe}
            setIsFollowMe={setIsFollowMe}
            onFitAllConvoy={fitAllConvoy}
          />

          {/* Apple Frosted Glass Driver Distance Floating Card */}
          {selectedSquadDriver && (
            <div className="driver-distance-floating-card glass-panel">
              <div className="distance-card-left">
                <div className="distance-avatar-disc">
                  {selectedSquadDriver.participant.vehicleType === 'BIKE' ? '🏍️' : '🚗'}
                </div>
                <div>
                  <div className="distance-card-driver">
                    {selectedSquadDriver.participant.name}
                    <span className={`distance-status-tag ${selectedSquadDriver.participant.isDeviated ? 'deviated' : 'ok'}`}>
                      {selectedSquadDriver.participant.isDeviated ? 'Off-Route' : 'On Route'}
                    </span>
                  </div>
                  <div className="distance-card-rel">{selectedSquadDriver.relativePos}</div>
                </div>
              </div>

              <div className="distance-card-right">
                <div className="distance-card-metric">
                  <span className="distance-val-big">{selectedSquadDriver.distText}</span>
                  <span className="distance-sub-label">from you</span>
                </div>
                <button
                  className="distance-btn-focus"
                  onClick={() => {
                    mapRef.current?.flyTo(
                      [selectedSquadDriver.participant.lat, selectedSquadDriver.participant.lon],
                      16,
                      { duration: 0.8 }
                    );
                  }}
                  title="Center map on driver"
                >
                  Focus
                </button>
                <button
                  className="distance-btn-close"
                  onClick={() => setSelectedSquadDriver(null)}
                  title="Close distance card"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          <GoogleDrivingDock
            leaderParticipant={leaderParticipant}
            myParticipant={myParticipant}
            previewDurationMins={previewDurationMins}
            previewDistanceKm={previewDistanceKm}
            isSimulating={isSimulating}
            onToggleSimulation={toggleSimulation}
            onSendPing={sendPing}
            onExitNav={() => setShowExitConfirmModal(true)}
          />
        </>
      )}

      {/* Driver Deviation / Safety Alert Banner */}
      <DriverAlertBanner
        alert={activeAlert}
        onAcknowledge={() => setActiveAlert(null)}
      />

      {/* Smooth Squad Room Share Modal */}
      {showShareModal && room && (
        <ShareModal
          room={room}
          shareUrl={getShareUrl()}
          onClose={() => setShowShareModal(false)}
          onCopyCode={() => {
            setLocationToast({ msg: `📋 Copied Squad Code: ${room.code}`, type: 'success' });
            setTimeout(() => setLocationToast(null), 2500);
          }}
          onCopyLink={() => {
            setLocationToast({ msg: `🔗 Copied direct invite link!`, type: 'success' });
            setTimeout(() => setLocationToast(null), 2500);
          }}
        />
      )}

      {/* Modern In-App Exit Convoy Modal (No Jarring Browser Alerts) */}
      {showExitConfirmModal && (
        <ExitConvoyModal
          tripName={room?.tripName}
          onConfirm={handleConfirmExitConvoy}
          onCancel={() => setShowExitConfirmModal(false)}
        />
      )}
    </>
  );
}
