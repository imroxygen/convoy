import React from 'react';
import { X } from 'lucide-react';

interface JoinConvoyModalProps {
  joinRoomCode: string;
  setJoinRoomCode: (code: string) => void;
  joinName: string;
  setJoinName: (name: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const JoinConvoyModal: React.FC<JoinConvoyModalProps> = ({
  joinRoomCode,
  setJoinRoomCode,
  joinName,
  setJoinName,
  onClose,
  onSubmit,
}) => {
  return (
    <div className="modal-backdrop-full">
      <div className="start-convoy-modal glass-panel">
        <div className="modal-title-row">
          <div>
            <h2>👥 Join Road Trip Convoy</h2>
            <p className="modal-dest-hint">Enter the room code shared by your friend</p>
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
            <label>Room Code</label>
            <input
              type="text"
              className="compact-field"
              placeholder="e.g. GOAC-493"
              value={joinRoomCode}
              onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 800 }}
              required
            />
          </div>

          <div className="input-box" style={{ marginTop: '12px' }}>
            <label>Your Name</label>
            <input
              type="text"
              className="compact-field"
              placeholder="Enter your name (e.g. Rahul)..."
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-launch-glow" style={{ marginTop: '20px' }}>
            <span>Join Squad Now 🚗</span>
          </button>
        </form>
      </div>
    </div>
  );
};
