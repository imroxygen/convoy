import React, { useState } from 'react';
import { Copy, Check, X, Link2, Sparkles } from 'lucide-react';
import type { Room } from '../types';

interface ShareModalProps {
  room: Room;
  shareUrl: string;
  onClose: () => void;
  onCopyCode?: () => void;
  onCopyLink?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  room,
  shareUrl,
  onClose,
  onCopyCode,
  onCopyLink,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      if (onCopyCode) onCopyCode();
      setTimeout(() => setCopiedCode(false), 2200);
    } catch (e) {}
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      if (onCopyLink) onCopyLink();
      setTimeout(() => setCopiedLink(false), 2200);
    } catch (e) {}
  };

  return (
    <div className="share-code-modal-backdrop" onClick={onClose}>
      <div className="share-code-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="share-modal-header">
          <div className="share-title-group">
            <div className="share-badge-pill">
              <Sparkles size={13} />
              <span>LIVE CONVOY ACTIVE</span>
            </div>
            <h2 className="share-main-title">Share Convoy Code</h2>
            <p className="share-subtitle">Give your road trip squad this code to join live navigation</p>
          </div>
          <button
            type="button"
            className="btn-modal-dismiss"
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Primary Room Code Box */}
        <div className="share-code-hero-box">
          <div className="code-meta-label">ROOM CODE</div>
          <div className="code-display-value" onClick={handleCopyCode} title="Click to copy room code">
            {room.code}
          </div>
          <button
            type="button"
            className={`btn-hero-copy ${copiedCode ? 'copied' : ''}`}
            onClick={handleCopyCode}
          >
            {copiedCode ? <Check size={16} /> : <Copy size={16} />}
            <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Direct Invite Link Row */}
        <div className="share-link-subrow">
          <div className="link-text-preview" title={shareUrl}>
            <Link2 size={15} className="link-icon" />
            <span className="link-url-truncate">{shareUrl}</span>
          </div>
          <button
            type="button"
            className={`btn-link-copy-pill ${copiedLink ? 'copied' : ''}`}
            onClick={handleCopyLink}
            title="Copy full invite link"
          >
            {copiedLink ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
          </button>
        </div>

        {/* Helper Footer */}
        <div className="share-modal-hint">
          <span>💡 Friends can click <b>Join</b> in their browser and enter this 6-character code.</span>
        </div>
      </div>
    </div>
  );
};
