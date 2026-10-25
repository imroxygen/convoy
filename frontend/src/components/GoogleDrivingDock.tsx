import React from 'react';
import { Fuel, Coffee, AlertTriangle, X } from 'lucide-react';
import type { Participant } from '../types';

interface GoogleDrivingDockProps {
  leaderParticipant?: Participant;
  myParticipant?: Participant;
  previewDurationMins: number;
  previewDistanceKm: number;
  isSimulating?: boolean;
  onToggleSimulation?: () => void;
  onSendPing: (type: 'FUEL' | 'REST' | 'EMERGENCY') => void;
  onExitNav: () => void;
}

export const GoogleDrivingDock: React.FC<GoogleDrivingDockProps> = ({
  leaderParticipant,
  myParticipant,
  previewDurationMins,
  previewDistanceKm,
  isSimulating,
  onToggleSimulation,
  onSendPing,
  onExitNav,
}) => {
  const remainingMins = leaderParticipant
    ? Math.max(1, Math.round((leaderParticipant.distanceToDestinationKm / 65) * 60))
    : previewDurationMins || 45;

  const remainingDist = leaderParticipant
    ? `${leaderParticipant.distanceToDestinationKm} km`
    : `${previewDistanceKm || 35} km`;

  const arrivalClock = new Date(
    Date.now() +
      (leaderParticipant
        ? (leaderParticipant.distanceToDestinationKm / 65) * 3600000
        : (previewDurationMins || 45) * 60000)
  ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="google-driving-bottom-dock">
      {/* Google Maps ETA Bar */}
      <div className="google-eta-panel glass-panel">
        <div className="eta-left-group">
          <div className="eta-mins-bold">{remainingMins} min</div>
          <div className="eta-sub-row">
            <span>{remainingDist}</span>
            <span>•</span>
            <span className="eta-clock">{arrivalClock}</span>
          </div>
        </div>

        <div className="eta-controls-right">
          <div className="btn-speed-badge">
            <span>⚡</span>
            <span>{myParticipant?.speed ? `${Math.round(myParticipant.speed)} km/h` : '0 km/h'}</span>
          </div>

          {onToggleSimulation && (
            <button
              type="button"
              className={`btn-sim-drive ${isSimulating ? 'simulating' : ''}`}
              onClick={onToggleSimulation}
              title={isSimulating ? 'Pause Driving Simulation' : 'Start Live Test Drive along Highway Route'}
            >
              <span>{isSimulating ? '⏸️ Pause' : '🚗💨 Test Drive'}</span>
            </button>
          )}

          <button
            className="btn-exit-nav"
            onClick={onExitNav}
            title="Exit Navigation"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Squad Driver Safety 1-Tap Pings */}
      <div
        className="bottom-dock glass-panel"
        style={{
          position: 'relative',
          bottom: 'auto',
          left: 'auto',
          right: 'auto',
          margin: 0,
          maxWidth: '100%',
        }}
      >
        <div className="dock-header">SQUAD SAFETY ONE-TAP PINGS</div>
        <div className="pings-grid">
          <button className="ping-button fuel" onClick={() => onSendPing('FUEL')}>
            <Fuel size={17} />
            <span>Need Fuel</span>
          </button>
          <button className="ping-button rest" onClick={() => onSendPing('REST')}>
            <Coffee size={17} />
            <span>Chai Break</span>
          </button>
          <button className="ping-button emergency" onClick={() => onSendPing('EMERGENCY')}>
            <AlertTriangle size={17} />
            <span>Emergency</span>
          </button>
        </div>
      </div>
    </div>
  );
};
