import React from 'react';
import { AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export interface FullWidthBannerProps {
  type: 'BILLING_UNAVAILABLE_NON_PRIMARY' | 'PRIMARY_OFFLINE_PAUSED' | 'SYNCING_PAUSED' | 'CUSTOM';
  customTitle?: string;
  customMessage?: string;
  actionText?: string;
  onAction?: () => void;
}

export const FullWidthBanner: React.FC<FullWidthBannerProps> = ({
  type,
  customTitle,
  customMessage,
  actionText,
  onAction,
}) => {
  let title = '';
  let message = '';
  let bgClass = 'bg-red-600 text-white';
  let icon = <AlertCircle className="w-5 h-5 flex-shrink-0" />;

  switch (type) {
    case 'BILLING_UNAVAILABLE_NON_PRIMARY':
      title = 'Offline mode active – billing unavailable on this terminal';
      message =
        'Only the registered Primary Offline Workstation can bill while offline. This terminal is read-only.';
      bgClass = 'bg-rose-700 text-white';
      break;

    case 'PRIMARY_OFFLINE_PAUSED':
      title = 'Primary computer offline – billing paused (fail-closed)';
      message =
        'To prevent stock divergence and split-brain bills, cloud writes are suspended until the primary re-establishes its lease.';
      bgClass = 'bg-amber-600 text-white';
      icon = <AlertTriangle className="w-5 h-5 flex-shrink-0" />;
      break;

    case 'SYNCING_PAUSED':
      title = 'Syncing – billing paused until complete';
      message =
        'Queued offline transactions are reconciling with the cloud. Billing will resume automatically in moments.';
      bgClass = 'bg-blue-600 text-white';
      icon = <RefreshCw className="w-5 h-5 flex-shrink-0 animate-spin" />;
      break;

    case 'CUSTOM':
      title = customTitle || '';
      message = customMessage || '';
      break;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`w-full px-4 py-2.5 flex items-center justify-between text-sm shadow-md ${bgClass}`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <span className="font-bold mr-2">{title}:</span>
          <span className="opacity-95">{message}</span>
        </div>
      </div>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="ml-4 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-xs font-semibold transition"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
