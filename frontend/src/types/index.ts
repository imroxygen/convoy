export type MapStyleType = 'google-streets' | 'google-satellite' | 'google-terrain' | 'carto-dark';

export interface MapStyleConfig {
  id: MapStyleType;
  name: string;
  badge: string;
  icon: string;
  subtitle: string;
  url: string;
  subdomains?: string[];
  maxZoom: number;
}

export interface Destination {
  name: string;
  lat: number;
  lon: number;
}

export interface DriverAlert {
  type: 'FUEL' | 'REST' | 'EMERGENCY';
  message: string;
  timestamp: number;
}

export interface Participant {
  id: string;
  name: string;
  vehicleType: 'CAR' | 'BIKE';
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  lastPing: number;
  isOnline: boolean;
  distanceToDestinationKm: number;
  gapFromLeaderKm: number;
  isDeviated: boolean;
  isLeader?: boolean;
  activeAlert?: DriverAlert | null;
}

export interface Room {
  code: string;
  tripName: string;
  secretKey: string;
  leaderId: string;
  destination: Destination;
  routeGeometry?: [number, number][];
  routeSteps?: any[];
  totalDistanceKm?: number;
  estimatedDurationMins?: number;
  participants: Record<string, Participant>;
}

export interface ManeuverInfo {
  icon: string;
  text: string;
  road: string;
  distText: string;
}

export const TYPES_VERSION = '1.0';
