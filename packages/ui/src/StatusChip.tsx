import React from 'react';
import {
  CloudCheck,
  CloudOff,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  PauseCircle,
} from 'lucide-react';

export type StatusLabelType =
  | 'ONLINE – CLOUD SYNCED'
  | 'OFFLINE – SAVED LOCALLY'
  | 'SYNCING'
  | 'SYNCED'
  | 'SYNC EXCEPTION'
  | 'STALE DASHBOARD'
  | 'BILLING PAUSED';

interface StatusChipProps {
  status: StatusLabelType;
  subText?: string;
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, subText, className = '' }) => {
  switch (status) {
    case 'ONLINE – CLOUD SYNCED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          ONLINE – CLOUD SYNCED
          {subText && <span className="text-emerald-600/70 ml-1">({subText})</span>}
        </span>
      );

    case 'OFFLINE – SAVED LOCALLY':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 ${className}`}
        >
          <CloudOff className="w-3.5 h-3.5 text-amber-600" />
          OFFLINE – SAVED LOCALLY
          {subText && <span className="text-amber-700/80 ml-1">({subText})</span>}
        </span>
      );

    case 'SYNCING':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 ${className}`}
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
          SYNCING
          {subText && <span className="text-blue-600/80 ml-1">({subText})</span>}
        </span>
      );

    case 'SYNCED':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-100 ${className}`}
        >
          <CheckCircle className="w-3 h-3 text-emerald-500" />
          SYNCED
        </span>
      );

    case 'SYNC EXCEPTION':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-300 animate-pulse ${className}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          SYNC EXCEPTION
          {subText && <span className="text-red-700/80 ml-1">({subText})</span>}
        </span>
      );

    case 'STALE DASHBOARD':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-amber-500 text-white ${className}`}
        >
          <Clock className="w-3.5 h-3.5" />
          STALE DASHBOARD
          {subText && <span className="ml-1 text-white/90">({subText})</span>}
        </span>
      );

    case 'BILLING PAUSED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-600 text-white ${className}`}
        >
          <PauseCircle className="w-3.5 h-3.5" />
          BILLING PAUSED
          {subText && <span className="ml-1 opacity-90">({subText})</span>}
        </span>
      );
  }
};
