import type { ManeuverInfo } from '../types';

/**
 * Precise Haversine Distance Calculator (km)
 */
export function computeDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/**
 * Calculate Compass Bearing (0-360 deg) between two coordinates
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Format human-readable distance gap between drivers
 */
export function formatDistanceGap(distKm: number): string {
  if (distKm < 0.05) return 'Right next to you';
  if (distKm < 1) return `${Math.round(distKm * 1000)} m away`;
  return `${distKm.toFixed(1)} km away`;
}

/**
 * Audio chime for driver notifications & deviation alerts
 */
export function playChime(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}

/**
 * Google Maps Turn Maneuver Display Formatter
 */
export function getManeuverDisplay(step: any): ManeuverInfo {
  if (!step || !step.maneuver) {
    return {
      icon: '⬆️',
      text: 'Continue along planned route',
      road: 'Highway',
      distText: 'In 500 m',
    };
  }

  const { type, modifier } = step.maneuver;
  const road = step.name || step.ref || 'Highway';
  const distM = Math.round(step.distance || 0);
  const distText = distM >= 1000 ? `In ${(distM / 1000).toFixed(1)} km` : `In ${distM} m`;

  let icon = '⬆️';
  let action = 'Continue straight onto';

  if (type === 'arrive') {
    icon = '🏁';
    action = 'Arrive at';
  } else if (type === 'depart') {
    icon = '🚗';
    action = 'Head towards';
  } else if (modifier === 'left') {
    icon = '↰';
    action = 'Turn left onto';
  } else if (modifier === 'right') {
    icon = '↱';
    action = 'Turn right onto';
  } else if (modifier === 'slight left') {
    icon = '↖';
    action = 'Slight left onto';
  } else if (modifier === 'slight right') {
    icon = '↗';
    action = 'Slight right onto';
  } else if (modifier === 'sharp left') {
    icon = '⮢';
    action = 'Sharp left onto';
  } else if (modifier === 'sharp right') {
    icon = '⮣';
    action = 'Sharp right onto';
  } else if (modifier === 'uturn') {
    icon = '↩';
    action = 'Make a U-turn onto';
  } else if (type === 'roundabout') {
    icon = '🔄';
    action = 'Take roundabout onto';
  }

  return {
    icon,
    text: `${action} ${road}`,
    road,
    distText,
  };
}
