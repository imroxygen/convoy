import React from 'react';
import { X } from 'lucide-react';
import type { Destination } from '../types';

interface StartConvoyModalProps {
  destination: Destination;
  driverName: string;
  setDriverName: (name: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const StartConvoyModal: React.FC<StartConvoyModalProps> = ({
  destination,
  driverName,
  setDriverName,
  onClose,
  onSubmit,
}) => {
  return (
    <div className="modal-backdrop-full">
      <div className="start-convoy-modal glass-panel">
        <div className="modal-title-row">
          <div>
            <h2>🚀 Start Squad Convoy</h2>
            <p className="modal-dest-hint">
              Destination: <strong>{destination.name}</strong>
            </p>
          </div>
          <button
            type="button"
            className="btn-close-card"
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="input-box" style={{ marginTop: '16px' }}>
            <label>Your Name</label>
            <input
              type="text"
              className="compact-field big-name-input"
              placeholder="Enter your name (e.g. Amit)..."
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <button type="submit" className="btn-launch-glow" style={{ marginTop: '20px' }}>
            <span>Launch Convoy & Get Share Link 📲</span>
          </button>
        </form>
      </div>
    </div>
  );
};
