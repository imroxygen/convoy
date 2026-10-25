import React from 'react';
import { Copy, Sun, Moon, X } from 'lucide-react';
import type { ManeuverInfo, Participant } from '../types';

interface GoogleNavHeaderProps {
  currentManeuver: ManeuverInfo;
  nextManeuver: ManeuverInfo | null;
  participantsList: Participant[];
  orderedParticipants?: Participant[];
  myId: string;
  theme: 'dark' | 'light';
  roomCode?: string;
  onToggleTheme: () => void;
  onOpenShareModal: () => void;
  onExitNav: () => void;
  onFocusDriver: (p: Participant) => void;
}

export const GoogleNavHeader: React.FC<GoogleNavHeaderProps> = ({
  currentManeuver,
  nextManeuver,
  participantsList,
  orderedParticipants,
  myId,
  theme,
  roomCode,
  onToggleTheme,
  onOpenShareModal,
  onExitNav,
  onFocusDriver,
}) => {
  return (
    <div className="top-map-bar-container">
      {/* Google Maps Deep Forest Green Turn-by-Turn Header */}
      <div className="google-nav-header-card">
        <div className="google-maneuver-box">
          {currentManeuver.icon}
        </div>

        <div className="google-nav-instruction-col">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="google-nav-dist-big">{currentManeuver.distText}</span>
            <span className="nav-locked-pill" title="Convoy route is locked to squad navigation">
              🔒 Route Locked
            </span>
          </div>
          <div className="google-nav-road-name">{currentManeuver.text}</div>
          {nextManeuver && (
            <div className="google-nav-next-step">
              <span>then</span>
              <span style={{ fontSize: '14px' }}>{nextManeuver.icon}</span>
              <span>{nextManeuver.distText}</span>
            </div>
          )}
        </div>

        <div className="google-nav-actions">
          {roomCode && (
            <button
              type="button"
              className="google-hud-code-btn"
              onClick={onOpenShareModal}
              title="Click to view & copy squad code"
            >
              <span className="code-pill-label">CODE</span>
              <span className="code-pill-val">{roomCode}</span>
              <Copy size={12} className="code-copy-svg" />
            </button>
          )}

          <button
            className="google-hud-circle-btn"
            onClick={onToggleTheme}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="google-hud-circle-btn danger"
            onClick={onExitNav}
            title="Exit Navigation"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Convoy Squad Chain HUD */}
      <div className="convoy-chain-bar glass-panel">
        <div className="squad-count-pill">
          <span className="pulsing-beacon" />
          <span>{participantsList.length} In Squad</span>
        </div>

        <div className="chain-flow">
          {orderedParticipants?.map((p: Participant, idx: number) => {
            const isLeader = idx === 0;
            const isMe = p.id === myId;
            const emoji = p.vehicleType === 'BIKE' ? '🏍️' : '🚗';
            const next = orderedParticipants[idx + 1];

            return (
              <React.Fragment key={p.id}>
                <div
                  className={`driver-pill ${isLeader ? 'leader' : ''} ${isMe ? 'me' : ''} ${
                    p.isDeviated ? 'deviated' : ''
                  }`}
                  onClick={() => onFocusDriver(p)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view driver on map"
                >
                  <span>{emoji}</span>
                  <span>
                    {p.name} {isLeader && '👑'} {isMe && '(You)'}
                  </span>
                  {p.speed > 0 && (
                    <span style={{ opacity: 0.75, fontSize: '11px', fontWeight: 800 }}>
                      {Math.round(p.speed)} km/h
                    </span>
                  )}
                </div>

                {next && (
                  <span className="chain-gap">
                    ── {(next.distanceToDestinationKm - p.distanceToDestinationKm).toFixed(1)} km ──
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
