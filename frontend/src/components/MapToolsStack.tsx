import React from 'react';
import { Layers, LocateFixed, X } from 'lucide-react';
import type { MapStyleType } from '../types';
import { MAP_STYLES } from '../constants/mapStyles';

interface MapToolsStackProps {
  showLayerMenu: boolean;
  setShowLayerMenu: (show: boolean) => void;
  currentMapStyle: MapStyleType;
  onSwitchMapStyle: (style: MapStyleType) => void;
  isLocating: boolean;
  hasLocation: boolean;
  onGetMyLocation: () => void;
  locationToast: { msg: string; type: 'error' | 'success' | 'info' } | null;
}

export const MapToolsStack: React.FC<MapToolsStackProps> = ({
  showLayerMenu,
  setShowLayerMenu,
  currentMapStyle,
  onSwitchMapStyle,
  isLocating,
  hasLocation,
  onGetMyLocation,
  locationToast,
}) => {
  return (
    <>
      <div className="map-tools-stack">
        <button
          className={`map-tool-circle-btn ${showLayerMenu ? 'active' : ''}`}
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          title="Map Styles (Google Streets, Satellite, Terrain, Dark)"
        >
          <Layers size={20} />
        </button>
        <button
          className={`map-tool-circle-btn ${isLocating ? 'locating' : ''} ${hasLocation ? 'located' : ''}`}
          onClick={onGetMyLocation}
          title="My Current Location"
        >
          <LocateFixed size={20} />
        </button>
      </div>

      {locationToast && (
        <div className={`location-toast-banner ${locationToast.type}`}>
          <span>{locationToast.msg}</span>
        </div>
      )}

      {showLayerMenu && (
        <div className="layers-popup-menu glass-panel">
          <div className="layers-menu-header">
            <span className="layers-menu-title">Select Map Style</span>
            <button className="btn-close-card" onClick={() => setShowLayerMenu(false)}>
              <X size={15} />
            </button>
          </div>
          <div className="layer-options-grid">
            {Object.values(MAP_STYLES).map((style) => (
              <div
                key={style.id}
                className={`layer-option-card ${currentMapStyle === style.id ? 'active' : ''}`}
                onClick={() => onSwitchMapStyle(style.id)}
              >
                <div className="layer-info-left">
                  <span className="layer-icon">{style.icon}</span>
                  <div>
                    <div className="layer-name-title">{style.name}</div>
                    <div className="layer-subtitle">{style.subtitle}</div>
                  </div>
                </div>
                <span className="layer-badge">{style.badge}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
