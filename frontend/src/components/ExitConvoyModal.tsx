import React, { useEffect } from 'react';
import { AlertTriangle, LogOut, ArrowLeft } from 'lucide-react';

interface ExitConvoyModalProps {
  tripName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ExitConvoyModal: React.FC<ExitConvoyModalProps> = ({
  tripName,
  onConfirm,
  onCancel,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="exit-convoy-backdrop" onClick={onCancel}>
      <div className="exit-convoy-card glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* Warning Icon Badge */}
        <div className="exit-icon-header">
          <div className="exit-warning-disc">
            <AlertTriangle size={24} className="exit-warning-icon" />
          </div>
        </div>

        {/* Title and Explanation */}
        <div className="exit-content-body">
          <h2 className="exit-title">Exit Convoy Navigation?</h2>
          <p className="exit-description">
            {tripName ? (
              <>You are about to leave <b>{tripName}</b>. Your squad tracking will stop and the active route will be reset.</>
            ) : (
              'You are about to disconnect from this live squad session. Your route and convoy map will be cleared.'
            )}
          </p>
        </div>

        {/* Dual Actions: Keep Navigating vs Exit & Reset */}
        <div className="exit-actions-row">
          <button
            type="button"
            className="btn-exit-cancel"
            onClick={onCancel}
            autoFocus
          >
            <ArrowLeft size={16} />
            <span>Keep Navigating</span>
          </button>

          <button
            type="button"
            className="btn-exit-confirm"
            onClick={onConfirm}
          >
            <LogOut size={16} />
            <span>Exit & Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
