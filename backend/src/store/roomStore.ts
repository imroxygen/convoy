import { Room, Participant, Destination, AlertType, DriverAlert } from '../types.js';
import { computeConvoyTelemetry } from '../utils/geo.js';

class RoomStore {
  // In-memory cache for ultra-fast sub-millisecond lookups & pub-sub state
  private rooms: Map<string, Room> = new Map();

  /**
   * Generates a human-friendly 6-character room code, e.g. "GOA-842" or "TRIP-319".
   */
  private generateRoomCode(tripName: string): string {
    const cleanPrefix = tripName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4) || 'TRIP';
    const randomDigits = Math.floor(100 + Math.random() * 900);
    return `${cleanPrefix}-${randomDigits}`;
  }

  /**
   * Creates a new Convoy Trip Room with an initial destination.
   */
  createRoom(params: {
    tripName: string;
    secretKey: string;
    destination: Destination;
    routeGeometry?: [number, number][];
    routeSteps?: any[];
    totalDistanceKm?: number;
    estimatedDurationMins?: number;
  }): Room {
    let code = this.generateRoomCode(params.tripName);
    while (this.rooms.has(code)) {
      code = this.generateRoomCode(params.tripName);
    }

    const room: Room = {
      code,
      tripName: params.tripName,
      secretKey: params.secretKey.trim(),
      leaderId: '',
      destination: params.destination,
      routeGeometry: params.routeGeometry,
      routeSteps: params.routeSteps,
      totalDistanceKm: params.totalDistanceKm,
      estimatedDurationMins: params.estimatedDurationMins,
      createdAt: Date.now(),
      participants: {},
    };

    this.rooms.set(code, room);
    return room;
  }

  getRoom(roomCode: string): Room | null {
    return this.rooms.get(roomCode.toUpperCase().trim()) || null;
  }

  /**
   * Verifies if room exists and secret key matches.
   */
  verifyRoom(roomCode: string, secretKey: string): { valid: boolean; room?: Room; error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) {
      return { valid: false, error: 'Room not found. Check your 6-digit code.' };
    }

    if (room.secretKey && room.secretKey !== secretKey.trim()) {
      return { valid: false, error: 'Invalid secret key for this road trip.' };
    }

    return { valid: true, room };
  }

  /**
   * Adds or registers a participant into the room.
   */
  joinRoom(params: {
    roomCode: string;
    participantId: string;
    name: string;
    vehicleType: 'CAR' | 'BIKE';
    initialLat: number;
    initialLon: number;
  }): Participant | null {
    const room = this.getRoom(params.roomCode);
    if (!room) return null;

    const participant: Participant = {
      id: params.participantId,
      name: params.name,
      vehicleType: params.vehicleType,
      lat: params.initialLat,
      lon: params.initialLon,
      speed: 0,
      heading: 0,
      lastPing: Date.now(),
      isOnline: true,
      distanceToDestinationKm: 0,
      gapFromLeaderKm: 0,
      isDeviated: false,
      activeAlert: null,
    };

    // If first member, make them the initial leader
    if (Object.keys(room.participants).length === 0) {
      room.leaderId = participant.id;
    }

    room.participants[participant.id] = participant;
    return participant;
  }

  /**
   * Updates a participant's real-time GPS location and calculates convoy telemetry.
   */
  updateLocation(
    roomCode: string,
    participantId: string,
    coords: { lat: number; lon: number; speed?: number; heading?: number }
  ): { room: Room; telemetry: any } | null {
    const room = this.getRoom(roomCode);
    if (!room || !room.participants[participantId]) return null;

    const p = room.participants[participantId];
    p.lat = coords.lat;
    p.lon = coords.lon;
    if (coords.speed !== undefined) p.speed = coords.speed;
    if (coords.heading !== undefined) p.heading = coords.heading;
    p.lastPing = Date.now();
    p.isOnline = true;

    // Recalculate convoy telemetry
    const telemetry = computeConvoyTelemetry(room.participants, room.destination, room.routeGeometry);

    return { room, telemetry };
  }

  /**
   * Sets a one-tap driving alert (e.g. Fuel, Rest Break, Emergency).
   */
  setDriverAlert(roomCode: string, participantId: string, alertType: AlertType): DriverAlert | null {
    const room = this.getRoom(roomCode);
    if (!room || !room.participants[participantId]) return null;

    const p = room.participants[participantId];
    const alertMessages: Record<AlertType, string> = {
      FUEL: `${p.name} needs a Fuel Stop ⛽`,
      REST: `${p.name} requested a Chai / Rest Break ☕`,
      EMERGENCY: `🚨 ${p.name} pulled over / Emergency!`,
    };

    const alert: DriverAlert = {
      type: alertType,
      message: alertMessages[alertType] || `${p.name} sent an alert!`,
      timestamp: Date.now(),
    };

    p.activeAlert = alert;
    return alert;
  }

  clearDriverAlert(roomCode: string, participantId: string): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !room.participants[participantId]) return false;

    room.participants[participantId].activeAlert = null;
    return true;
  }

  markParticipantOffline(roomCode: string, participantId: string): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !room.participants[participantId]) return false;

    room.participants[participantId].isOnline = false;
    return true;
  }

  updateDestination(
    roomCode: string,
    destination: Destination,
    routeGeometry?: [number, number][],
    totalDistanceKm?: number,
    estimatedDurationMins?: number
  ): Room | null {
    const room = this.getRoom(roomCode);
    if (!room) return null;

    room.destination = destination;
    if (routeGeometry) room.routeGeometry = routeGeometry;
    if (totalDistanceKm !== undefined) room.totalDistanceKm = totalDistanceKm;
    if (estimatedDurationMins !== undefined) room.estimatedDurationMins = estimatedDurationMins;

    return room;
  }
}

export const roomStore = new RoomStore();
