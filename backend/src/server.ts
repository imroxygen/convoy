import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { roomStore } from './store/roomStore.js';
import { ClientMessage, ServerMessage } from './types.js';
import { computeConvoyTelemetry } from './utils/geo.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Single Unified App: Serve production frontend dist directory
const frontendDistCandidates = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(process.cwd(), 'frontend/dist'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.join(__dirname, '../public'),
];
const frontendDist = frontendDistCandidates.find((d) => fs.existsSync(d)) || frontendDistCandidates[0];

app.use(express.static(frontendDist));

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

const CreateRoomSchema = z.object({
  tripName: z.string().min(2).max(50),
  secretKey: z.string().max(30).optional().default(''),
  destination: z.object({
    name: z.string().min(1),
    lat: z.number(),
    lon: z.number(),
  }),
  routeGeometry: z.array(z.tuple([z.number(), z.number()])).optional(),
  routeSteps: z.array(z.any()).optional(),
  totalDistanceKm: z.number().optional(),
  estimatedDurationMins: z.number().optional(),
});

const VerifyRoomSchema = z.object({
  roomCode: z.string().min(3),
  secretKey: z.string().optional().default(''),
});

// Create Room
app.post('/api/rooms', (req: Request, res: Response) => {
  try {
    const data = CreateRoomSchema.parse(req.body);
    const room = roomStore.createRoom(data);
    res.status(201).json(room);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid room payload' });
  }
});

// Verify Room & Secret Key
app.post('/api/rooms/verify', (req: Request, res: Response) => {
  try {
    const data = VerifyRoomSchema.parse(req.body);
    const result = roomStore.verifyRoom(data.roomCode, data.secretKey);
    if (!result.valid) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ valid: true, room: result.room });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Verification failed' });
  }
});

// Get Room State
app.get('/api/rooms/:code', (req: Request, res: Response) => {
  const codeParam = String(req.params.code || '');
  const room = roomStore.getRoom(codeParam);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json(room);
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'UP', service: 'Convoy Live Road Trip Squad Server' });
});

// -------------------------------------------------------------
// REAL-TIME WEBSOCKET SUBSCRIPTIONS & BROADCASTING
// -------------------------------------------------------------

interface SocketMetadata {
  roomCode?: string;
  participantId?: string;
}

const socketMetaMap = new WeakMap<WebSocket, SocketMetadata>();
// Room code -> Set of active WebSockets
const roomSockets = new Map<string, Set<WebSocket>>();

function broadcastToRoom(roomCode: string, message: ServerMessage, excludeWs?: WebSocket) {
  const sockets = roomSockets.get(roomCode);
  if (!sockets) return;

  const payloadStr = JSON.stringify(message);
  for (const client of sockets) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(payloadStr);
    }
  }
}

wss.on('connection', (ws: WebSocket) => {
  socketMetaMap.set(ws, {});

  ws.on('message', (data: string) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());
      const meta = socketMetaMap.get(ws) || {};

      switch (msg.type) {
        // 1. Participant joins room
        case 'JOIN_ROOM': {
          const { roomCode, secretKey, participantId, name, vehicleType, initialLat, initialLon } = msg.payload;

          const verification = roomStore.verifyRoom(roomCode, secretKey || '');
          if (!verification.valid) {
            ws.send(JSON.stringify({ type: 'ERROR', payload: { message: verification.error } }));
            return;
          }

          const upperRoomCode = roomCode.toUpperCase();
          meta.roomCode = upperRoomCode;
          meta.participantId = participantId;
          socketMetaMap.set(ws, meta);

          // Add socket to room set
          if (!roomSockets.has(upperRoomCode)) {
            roomSockets.set(upperRoomCode, new Set());
          }
          roomSockets.get(upperRoomCode)!.add(ws);

          // Register in store
          const participant = roomStore.joinRoom({
            roomCode: upperRoomCode,
            participantId,
            name,
            vehicleType: vehicleType || 'CAR',
            initialLat: initialLat || 0,
            initialLon: initialLon || 0,
          });

          const currentRoom = roomStore.getRoom(upperRoomCode)!;
          const telemetry = computeConvoyTelemetry(
            currentRoom.participants,
            currentRoom.destination,
            currentRoom.routeGeometry
          );

          // Send confirmation to the joining participant
          ws.send(
            JSON.stringify({
              type: 'ROOM_JOINED',
              payload: {
                room: currentRoom,
                participant,
                telemetry,
              },
            })
          );

          // Broadcast updated convoy state to everyone in room
          broadcastToRoom(
            upperRoomCode,
            {
              type: 'CONVOY_UPDATE',
              payload: {
                participants: currentRoom.participants,
                telemetry,
                destination: currentRoom.destination,
              },
            },
            ws
          );
          break;
        }

        // 2. Real-time GPS location update
        case 'LOCATION_UPDATE': {
          if (!meta.roomCode || !meta.participantId) return;

          const updated = roomStore.updateLocation(meta.roomCode, meta.participantId, msg.payload);
          if (updated) {
            broadcastToRoom(meta.roomCode, {
              type: 'CONVOY_UPDATE',
              payload: {
                participants: updated.room.participants,
                telemetry: updated.telemetry,
                destination: updated.room.destination,
              },
            });
          }
          break;
        }

        // 3. One-Tap Driver Safety Alert (Fuel, Rest, Emergency)
        case 'DRIVER_PING': {
          if (!meta.roomCode || !meta.participantId) return;

          const alert = roomStore.setDriverAlert(meta.roomCode, meta.participantId, msg.payload.alertType);
          const room = roomStore.getRoom(meta.roomCode);

          if (alert && room) {
            const telemetry = computeConvoyTelemetry(room.participants, room.destination, room.routeGeometry);

            // Broadcast loud alert
            broadcastToRoom(meta.roomCode, {
              type: 'ALERT_BROADCAST',
              payload: {
                participantId: meta.participantId,
                alert,
                participants: room.participants,
                telemetry,
              },
            });
          }
          break;
        }

        // 4. Clear alert
        case 'CLEAR_ALERT': {
          if (!meta.roomCode || !meta.participantId) return;

          roomStore.clearDriverAlert(meta.roomCode, meta.participantId);
          const room = roomStore.getRoom(meta.roomCode);
          if (room) {
            const telemetry = computeConvoyTelemetry(room.participants, room.destination, room.routeGeometry);
            broadcastToRoom(meta.roomCode, {
              type: 'CONVOY_UPDATE',
              payload: {
                participants: room.participants,
                telemetry,
                destination: room.destination,
              },
            });
          }
          break;
        }

        // 5. Update destination
        case 'SET_DESTINATION': {
          if (!meta.roomCode) return;

          const { destination, routeGeometry, totalDistanceKm, estimatedDurationMins } = msg.payload;
          const updatedRoom = roomStore.updateDestination(
            meta.roomCode,
            destination,
            routeGeometry,
            totalDistanceKm,
            estimatedDurationMins
          );

          if (updatedRoom) {
            const telemetry = computeConvoyTelemetry(
              updatedRoom.participants,
              updatedRoom.destination,
              updatedRoom.routeGeometry
            );

            broadcastToRoom(meta.roomCode, {
              type: 'DESTINATION_UPDATED',
              payload: {
                room: updatedRoom,
                telemetry,
              },
            });
          }
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    const meta = socketMetaMap.get(ws);
    if (meta && meta.roomCode && meta.participantId) {
      // Remove from room socket set
      const sockets = roomSockets.get(meta.roomCode);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) roomSockets.delete(meta.roomCode);
      }

      // Mark offline
      roomStore.markParticipantOffline(meta.roomCode, meta.participantId);
      const room = roomStore.getRoom(meta.roomCode);
      if (room) {
        const telemetry = computeConvoyTelemetry(room.participants, room.destination, room.routeGeometry);
        broadcastToRoom(meta.roomCode, {
          type: 'CONVOY_UPDATE',
          payload: {
            participants: room.participants,
            telemetry,
            destination: room.destination,
          },
        });
      }
    }
  });
});

// Single Unified App: Fallback handler to serve frontend index.html for client-side routing (Express 5 compatible)
app.use((req: Request, res: Response) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    res.status(404).json({ error: 'Endpoint not found' });
    return;
  }
  const indexPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Convoy Server</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #0f172a; color: #f8fafc;">
          <h2>🚀 Convoy Server is Running</h2>
          <p>Frontend production bundle not found yet. Run: <code>npm run build</code></p>
        </body>
      </html>
    `);
  }
});

server.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 CONVOY Live Squad Navigator server running on:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`=============================================================\n`);
});
