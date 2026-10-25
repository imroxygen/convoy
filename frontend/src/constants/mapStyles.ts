import type { MapStyleType, MapStyleConfig } from '../types';

export const MAP_STYLES: Record<MapStyleType, MapStyleConfig> = {
  'google-streets': {
    id: 'google-streets',
    name: 'Google Streets',
    badge: 'Popular',
    icon: '🗺️',
    subtitle: 'Classic Google Maps roads & highways',
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
  },
  'google-satellite': {
    id: 'google-satellite',
    name: 'Satellite Hybrid',
    badge: 'HD Sat',
    icon: '🛰️',
    subtitle: 'Satellite imagery with street overlays',
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
  },
  'google-terrain': {
    id: 'google-terrain',
    name: 'Google Terrain',
    badge: '3D Relief',
    icon: '⛰️',
    subtitle: 'Topography, contours & elevations',
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
  },
  'carto-dark': {
    id: 'carto-dark',
    name: 'Night Driving',
    badge: 'Dark Nav',
    icon: '🌙',
    subtitle: 'Cyber night navigation HUD',
    url: 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
    maxZoom: 19,
  },
};
