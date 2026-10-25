# Convoy 🚗💨🏍️
> **Real-Time Road Trip Squad Navigator & Driving Convoy Engine**  
> *Built with Node.js, TypeScript, WebSockets, React, Leaflet.js, and OpenStreetMap.*

---

## 📁 Clean Monorepo Architecture

The project is cleanly split into two dedicated, independent applications:

```
convoy/
  ├── backend/               # Node.js + Express + WebSocket Engine
  │    ├── src/
  │    │    ├── server.ts     # Express REST API & WebSocket Server
  │    │    ├── types.ts      # Shared Domain & Protocol Types
  │    │    ├── store/        # In-memory Room & Telemetry Store
  │    │    └── utils/        # Haversine & Cross-Track Spatial Math
  │    ├── test/              # Real-time WebSocket E2E Test Suite
  │    ├── .env               # Backend Environment Config (PORT=4000)
  │    ├── docker-compose.yml # Redis Container Setup
  │    ├── package.json       # Backend Dependencies & Scripts
  │    └── tsconfig.json      # Backend TypeScript Config
  │
  ├── frontend/              # Modern React + Vite Web Application
  │    ├── src/
  │    │    ├── App.tsx       # Main Map & HUD Component
  │    │    ├── index.css     # Light & Dark Theme Glassmorphism Styling
  │    │    └── main.tsx      # React Entrypoint
  │    ├── vite.config.ts     # Proxies /api and /ws to Backend
  │    └── package.json       # React, Leaflet, Lucide Dependencies
  │
  └── package.json           # Root Orchestration Scripts
```

---

### 🌟 Single Unified App (1 Port & 1 Process)
Run everything — UI, REST APIs, and WebSockets — together on **Port 4000**:
```bash
npm run serve
# or npm run build && npm start
```
*Open in your browser:* **http://localhost:4000**

---

### ⚡ Live Dev Mode (Hot-Reloading on Backend + Frontend)
```bash
npm run dev
```
*(Runs backend on :4000 and frontend on :5173 concurrently with Vite instant hot reloading)*

### 3. Run Backend Real-Time Tests
```bash
npm run test:backend
```
*(or `cd backend && npm test`)*

---

## 🌟 Key Features

* **Light & Dark Theme Toggle:** ☀️ Sun / 🌙 Moon button with dynamic CartoDB map tiles.
* **3-Way Destination Selection:**
  1. *Live Search Autocomplete:* Search any city, highway, or landmark.
  2. *Visual Road Trip Cards:* Popular routes (Goa, Lonavala, Manali, Mysore).
  3. *Click-on-Map Mode:* Drop a pin anywhere on the highway.
* **Live Convoy HUD:** Top bar showing Leader $\to$ Gap $\to$ Tail distances.
* **One-Tap Safety Pings:** ⛽ Fuel, ☕ Chai Break, 🚨 Emergency with sound chime.
* **Simulation Mode (`🚗💨`):** Test moving cars and bikes on desktop!
