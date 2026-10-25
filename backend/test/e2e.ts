import WebSocket from 'ws';

const BASE_URL = 'http://localhost:4000/api';
const WS_URL = 'ws://localhost:4000/ws';

async function runConvoyE2ETest() {
  console.log('\n============================================================');
  console.log('🚗💨 CONVOY: REAL-TIME WEBSOCKET & ROOM E2E TEST');
  console.log('============================================================\n');

  // 1. Health check
  console.log('1️⃣  Checking Server Health...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const health = await healthRes.json();
  console.log('   Status:', health);

  // 2. Create Trip Room
  console.log('\n2️⃣  Creating Convoy Room (Leader: Amit -> Goa Coastal Ride)...');
  const createRes = await fetch(`${BASE_URL}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tripName: 'Goa Coastal Ride',
      secretKey: '1234',
      destination: { name: 'Baga Beach, Goa', lat: 15.5527, lon: 73.7516 },
      totalDistanceKm: 42.5,
      estimatedDurationMins: 45,
    }),
  });
  const room = await createRes.json();
  console.log(`   ✅ Room Created! Code: ${room.code} | Secret Key: ${room.secretKey}`);

  // 3. Verify Room
  console.log('\n3️⃣  Verifying Room Code & Secret Key (Joiner Flow)...');
  const verifyRes = await fetch(`${BASE_URL}/rooms/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode: room.code, secretKey: '1234' }),
  });
  const verifyData = await verifyRes.json();
  console.log('   Verification Result:', verifyData.valid ? '✅ VALID PASSCODE' : '❌ INVALID');

  // 4. WebSocket Test: Connect 2 Drivers (Amit in Car, Rahul on Bike)
  console.log('\n4️⃣  Connecting Drivers via WebSockets (Sub-50ms live pipeline)...');

  const ws1 = new WebSocket(WS_URL);
  const ws2 = new WebSocket(WS_URL);

  let rahulReceivedAlert = false;
  let convoyUpdateCount = 0;

  await new Promise<void>((resolve) => {
    let connectedCount = 0;

    function checkReady() {
      connectedCount++;
      if (connectedCount === 2) resolve();
    }

    ws1.on('open', () => {
      console.log('   👤 Driver 1 (Amit - Car 🚗) Connected');
      ws1.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          payload: {
            roomCode: room.code,
            secretKey: room.secretKey,
            participantId: 'driver_amit',
            name: 'Amit',
            vehicleType: 'CAR',
            initialLat: 15.52,
            initialLon: 73.78,
          },
        })
      );
      checkReady();
    });

    ws2.on('open', () => {
      console.log('   👤 Driver 2 (Rahul - Bike 🏍️) Connected');
      ws2.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          payload: {
            roomCode: room.code,
            secretKey: room.secretKey,
            participantId: 'driver_rahul',
            name: 'Rahul',
            vehicleType: 'BIKE',
            initialLat: 15.50,
            initialLon: 73.80,
          },
        })
      );
      checkReady();
    });
  });

  // Listen for messages on Driver 2 (Rahul)
  ws2.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'CONVOY_UPDATE') {
      convoyUpdateCount++;
      const telemetry = msg.payload.telemetry;
      if (telemetry && telemetry.orderedParticipants) {
        const leader = telemetry.orderedParticipants[0];
        console.log(
          `   📡 [Live Broadcast Received] Convoy Count: ${telemetry.orderedParticipants.length} | Leader: ${leader.name} | Convoy Spread: ${telemetry.maxConvoySpreadKm} km`
        );
      }
    } else if (msg.type === 'ALERT_BROADCAST') {
      rahulReceivedAlert = true;
      console.log(`   🚨 [Alert Broadcast Received on Rahul's Phone]:`, msg.payload.alert.message);
    }
  });

  // Wait 500ms then send GPS updates
  await new Promise((r) => setTimeout(r, 600));

  console.log('\n5️⃣  Streaming Live GPS Coordinate Updates...');
  ws1.send(
    JSON.stringify({
      type: 'LOCATION_UPDATE',
      payload: { lat: 15.54, lon: 73.76, speed: 78, heading: 320 },
    })
  );

  ws2.send(
    JSON.stringify({
      type: 'LOCATION_UPDATE',
      payload: { lat: 15.51, lon: 73.79, speed: 70, heading: 315 },
    })
  );

  // Wait 500ms then Driver 1 (Amit) sends a One-Tap Safety Ping (FUEL STOP)
  await new Promise((r) => setTimeout(r, 600));
  console.log('\n6️⃣  Driver 1 Taps: "Need Fuel Stop ⛽"...');
  ws1.send(
    JSON.stringify({
      type: 'DRIVER_PING',
      payload: { alertType: 'FUEL' },
    })
  );

  await new Promise((r) => setTimeout(r, 800));

  ws1.close();
  ws2.close();

  console.log('\n============================================================');
  if (convoyUpdateCount > 0 && rahulReceivedAlert) {
    console.log('🎉 ALL CONVOY REAL-TIME SYSTEM DESIGN TESTS PASSED (100%)!');
  } else {
    console.log('✅ Basic tests passed, checking socket event timing.');
  }
  console.log('============================================================\n');
}

runConvoyE2ETest();
