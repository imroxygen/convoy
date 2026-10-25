import React from 'react';

interface DriverAlertBannerProps {
  alert: { driverName: string; message: string; type: string } | null;
  onAcknowledge: () => void;
}

export const DriverAlertBanner: React.FC<DriverAlertBannerProps> = ({
  alert,
  onAcknowledge,
}) => {
  if (!alert) return null;

  return (
    <div className="alert-popup-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '24px' }}>
          {alert.type === 'FUEL' ? '⛽' : alert.type === 'REST' ? '☕' : '🚨'}
        </span>
        <div className="alert-info-col">
          <strong>{alert.driverName}</strong>
          <p>{alert.message}</p>
        </div>
      </div>
      <button className="btn-ack" onClick={onAcknowledge}>
        Got It
      </button>
    </div>
  );
};
