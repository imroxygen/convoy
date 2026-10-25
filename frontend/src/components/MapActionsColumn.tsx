import React from 'react';
import { Layers, LocateFixed, Compass, Maximize2 } from 'lucide-react';

interface MapActionsColumnProps {
  showLayerMenu: boolean;
  setShowLayerMenu: (show: boolean) => void;
  isLocating: boolean;
  hasLocation: boolean;
  onGetMyLocation: () => void;
  isFollowMe: boolean;
  setIsFollowMe: (follow: boolean) => void;
  onFitAllConvoy: () => void;
}

export const MapActionsColumn: React.FC<MapActionsColumnProps> = ({
  showLayerMenu,
  setShowLayerMenu,
  isLocating,
  hasLocation,
  onGetMyLocation,
  isFollowMe,
  setIsFollowMe,
  onFitAllConvoy,
}) => {
  return (
    <div className="map-actions-column">
      <button
        className={`btn-control-float ${showLayerMenu ? 'active' : ''}`}
        onClick={() => setShowLayerMenu(!showLayerMenu)}
        title="Change Map Style (Streets / Satellite / Terrain)"
      >
        <Layers size={22} />
      </button>
      <button
        className={`btn-control-float ${isLocating ? 'locating' : ''} ${hasLocation ? 'active' : ''}`}
        onClick={onGetMyLocation}
        title="Locate & Center On My GPS"
      >
        <LocateFixed size={22} />
      </button>
      <button
        className={`btn-control-float ${isFollowMe ? 'active' : ''}`}
        onClick={() => setIsFollowMe(!isFollowMe)}
        title="Follow My Vehicle"
      >
        <Compass size={22} />
      </button>
      <button
        className="btn-control-float"
        onClick={onFitAllConvoy}
        title="Fit Entire Convoy in View"
      >
        <Maximize2 size={22} />
      </button>
    </div>
  );
};
