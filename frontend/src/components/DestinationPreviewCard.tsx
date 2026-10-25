import React from 'react';
import { Send, X } from 'lucide-react';
import type { Destination } from '../types';

interface DestinationPreviewCardProps {
  destination: Destination;
  previewDistanceKm: number;
  previewDurationMins: number;
  onClearDestination: () => void;
  onOpenStartModal: () => void;
}

export const DestinationPreviewCard: React.FC<DestinationPreviewCardProps> = ({
  destination,
  previewDistanceKm,
  previewDurationMins,
  onClearDestination,
  onOpenStartModal,
}) => {
  return (
    <div className="destination-preview-bottom-card glass-panel">
      <div className="dest-preview-info">
        <div className="dest-preview-title-row">
          <span className="dest-flag">🏁</span>
          <div>
            <h3>{destination.name}</h3>
            <p className="dest-subtext">
              {previewDistanceKm > 0
                ? `📍 ${previewDistanceKm} km • ~${previewDurationMins} mins highway drive`
                : 'Destination Selected • Road Trip Ready'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-close-subtle"
          onClick={onClearDestination}
          title="Clear Destination"
        >
          <X size={16} />
        </button>
      </div>

      <button
        type="button"
        className="btn-start-convoy-big"
        onClick={onOpenStartModal}
      >
        <span>Start Convoy</span>
        <Send size={18} />
      </button>
    </div>
  );
};
