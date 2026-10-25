import L from 'leaflet';
import type { Participant } from '../types';

/**
 * Authentic Google Maps Red Teardrop Destination Pin with Drop Shadow
 */
export function createGoogleDestPinIcon(name: string): L.DivIcon {
  return L.divIcon({
    className: 'google-dest-marker',
    html: `
      <div class="google-dest-pin-container">
        <div class="google-dest-pin-callout">${name}</div>
        <svg class="google-red-pin-svg" width="34" height="46" viewBox="0 0 34 46" fill="none">
          <path d="M17 0C7.61 0 0 7.61 0 17C0 29.75 17 46 17 46C17 46 34 29.75 34 17C34 7.61 26.39 0 17 0Z" fill="#EA4335"/>
          <circle cx="17" cy="17" r="7" fill="#B31412"/>
          <circle cx="17" cy="17" r="5" fill="#FFFFFF"/>
        </svg>
      </div>
    `,
    iconSize: [34, 52],
    iconAnchor: [17, 46],
    popupAnchor: [0, -46],
  });
}

/**
 * Authentic Google Maps Origin Green Dot Pin
 */
export function createGoogleOriginPinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'google-origin-marker',
    html: `
      <div class="google-origin-pin-container">
        <div class="google-origin-radar"></div>
        <div class="google-origin-dot"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

/**
 * Authentic Google Maps Pulsing Blue GPS Marker
 */
export function createGpsDotIcon(): L.DivIcon {
  return L.divIcon({
    className: 'gps-marker-leaflet',
    html: `
      <div class="gps-marker-container">
        <div class="gps-radar-ring"></div>
        <div class="gps-blue-dot"></div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

/**
 * Authentic Google Maps 3D Driving Navigation Arrow (for Current User when Moving / Navigating)
 */
export function createGoogleNavArrowIcon(heading: number = 0, name: string = 'You'): L.DivIcon {
  const normHeading = Math.round(((heading % 360) + 360) % 360);
  return L.divIcon({
    className: 'google-nav-arrow-leaflet',
    html: `
      <div class="google-nav-arrow-container">
        <div class="google-nav-arrow-name-tag">
          <span class="nav-arrow-dot"></span>
          <span class="nav-arrow-label">${name} (You)</span>
        </div>
        <div class="google-nav-arrow-rotator" style="transform: rotate(${normHeading}deg);">
          <div class="google-nav-arrow-halo"></div>
          <svg class="google-nav-arrow-svg" width="46" height="46" viewBox="0 0 46 46" fill="none">
            <defs>
              <linearGradient id="googleNavGrad" x1="23" y1="4" x2="23" y2="40" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="50%" stop-color="#1a73e8"/>
                <stop offset="100%" stop-color="#0d47a1"/>
              </linearGradient>
              <filter id="googleNavGlow" x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow dx="0" dy="2.5" stdDeviation="3" flood-color="rgba(0, 0, 0, 0.5)"/>
              </filter>
            </defs>
            <!-- Authentic Google Navigation 3D Chevron Arrow with Deep Blue Core & White Bevel Border -->
            <path d="M23 4L39 39L23 31L7 39L23 4Z" fill="url(#googleNavGrad)" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" filter="url(#googleNavGlow)"/>
            <!-- Inner Depth Ridge -->
            <path d="M23 7L23 30L36 37L23 7Z" fill="rgba(0, 0, 0, 0.18)"/>
            <circle cx="23" cy="23" r="3.2" fill="#ffffff"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [80, 80],
    iconAnchor: [40, 50],
  });
}

/**
 * Squad Member Vehicle Marker with Persistent, High-Contrast Name Tag & Speed
 */
export function createSquadMemberIcon(p: Participant): L.DivIcon {
  const isDeviated = p.isDeviated;
  const emoji = p.vehicleType === 'BIKE' ? '🏍️' : '🚗';
  const speedStr = p.speed > 0 ? `${Math.round(p.speed)} km/h` : 'Stopped';

  return L.divIcon({
    className: 'squad-member-marker-leaflet',
    html: `
      <div class="squad-member-wrapper ${isDeviated ? 'deviated' : ''}">
        <div class="squad-member-name-tag">
          <span class="member-tag-badge ${p.isLeader ? 'leader' : ''}">${p.isLeader ? '👑 ' : ''}${p.name}</span>
          <span class="member-speed-tag">${speedStr}</span>
        </div>
        <div class="squad-member-vehicle-pin ${p.isLeader ? 'leader' : ''}">
          <div class="vehicle-pin-pulse"></div>
          <div class="vehicle-pin-disc ${p.vehicleType.toLowerCase()}">
            <span>${emoji}</span>
          </div>
          <div class="vehicle-pin-arrow"></div>
        </div>
      </div>
    `,
    iconSize: [120, 70],
    iconAnchor: [60, 54],
    popupAnchor: [0, -50],
  });
}

/**
 * Convoy Squad Vehicle Marker
 */
export function createVehicleMarkerIcon(p: Participant, isMe: boolean): L.DivIcon {
  if (isMe) {
    return createGoogleNavArrowIcon(p.heading, p.name);
  }
  return createSquadMemberIcon(p);
}
