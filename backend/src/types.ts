export type VehicleType = 'CAR' | 'BIKE';

export type AlertType = 'FUEL' | 'REST' | 'EMERGENCY';

export interface Destination {
  name: string;
  lat: number;
  lon: number;
}

export interface DriverAlert {
  type: AlertType;
  message: string;
  timestamp: number;
}

export interface Participant {
  id: string;
  name: string;
  vehicleType: VehicleType;
  lat: number;
  lon: number;
  speed: number; // in km/h
  heading: number; // in degrees (0-360)
  lastPing: number;
  isOnline: boolean;
  distanceToDestinationKm: number;
  gapFromLeaderKm: number;
  isDeviated: boolean; // true if strayed > 300m from planned highway route
  activeAlert?: DriverAlert | null;
}

export interface Room {
  code: string;
  tripName: string;
  secretKey: string;
  leaderId: string;
  destination: Destination;
  routeGeometry?: [number, number][]; // [[lat, lon], ...] along the actual road
  routeSteps?: any[]; // Turn-by-turn navigation steps
  totalDistanceKm?: number;
  estimatedDurationMins?: number;
  createdAt: number;
  participants: Record<string, Participant>;
}

// WebSocket message protocols
export type ClientMessageType =
  | 'JOIN_ROOM'
  | 'LOCATION_UPDATE'
  | 'DRIVER_PING'
  | 'CLEAR_ALERT'
  | 'SET_DESTINATION';

export interface ClientMessage {
  type: ClientMessageType;
  payload: any;
}

export type ServerMessageType =
  | 'ROOM_JOINED'
  | 'CONVOY_UPDATE'
  | 'ALERT_BROADCAST'
  | 'DESTINATION_UPDATED'
  | 'PARTICIPANT_LEFT'
  | 'ERROR';

export interface ServerMessage {
  type: ServerMessageType;
  payload: any;
}
