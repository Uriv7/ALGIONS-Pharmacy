import React from 'react';
import { StatusChip, StatusLabelType } from '@algions/ui';
import {
  Wifi,
  WifiOff,
  Lock,
  RefreshCw,
  Computer,
  User,
  ShieldCheck,
  Menu,
} from 'lucide-react';
import { AuthSessionUser } from '@algions/contracts';

interface TopBarProps {
  user: AuthSessionUser;
  storeName: string;
  storeMode: string;
  isOffline: boolean;
  isPrimary: boolean;
  pendingSyncCount: number;
  lastHeartbeatTime: string | null;
  onToggleOfflineSimulator: () => void;
  onTriggerSync: () => void;
  onLock: () => void;
  onToggleMobileMenu?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  storeName,
  storeMode,
  isOffline,
  isPrimary,
  pendingSyncCount,
  lastHeartbeatTime,
  onToggleOfflineSimulator,
  onTriggerSync,
  onLock,
  onToggleMobileMenu,
}) => {
  let statusLabel: StatusLabelType = 'ONLINE – CLOUD SYNCED';
  if (isOffline) {
    statusLabel = isPrimary ? 'OFFLINE – SAVED LOCALLY' : 'BILLING PAUSED';
  } else if (storeMode === 'RECOVERY_SYNCING') {
    statusLabel = 'SYNCING';
  } else if (storeMode === 'DEGRADED_CONFLICT') {
    statusLabel = 'SYNC EXCEPTION';
  }

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-3 sm:px-4 flex items-center justify-between select-none shadow-sm z-20">
      {/* Left: Mobile Menu + Brand & Store */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            title="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-base shadow flex-shrink-0">
          A
        </div>
        <div className="min-w-0">
          <div className="font-bold text-slate-800 text-xs sm:text-sm leading-tight tracking-tight truncate max-w-[140px] sm:max-w-xs md:max-w-md">
            {storeName}
          </div>
          <div className="text-[10px] text-slate-400 font-medium hidden sm:block">
            ALGIONS Pharmacy ERP v1.0
          </div>
        </div>
      </div>

      {/* Center: System Status & Workstation Indicators (Responsive) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <StatusChip
          status={statusLabel}
          subText={pendingSyncCount > 0 ? `${pendingSyncCount} pending` : undefined}
        />

        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
          <Computer className="w-3.5 h-3.5 text-teal-600" />
          <span>{isPrimary ? 'Primary Workstation (Offline-Ready)' : 'Secondary Counter'}</span>
        </div>

        {/* Offline Controls: Owner has full control; Staff has operational view */}
        {user.accountType === 'OWNER' ? (
          <button
            onClick={onToggleOfflineSimulator}
            className={`hidden md:flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition border ${
              isOffline
                ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
            }`}
            title="Owner Control: Simulate network outage / restoration"
          >
            {isOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span>Simulate Online</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Simulate Outage</span>
              </>
            )}
          </button>
        ) : (
          <div
            className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200"
            title="Operational Status: Automatic background synchronization active"
          >
            {isOffline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                <span>Offline Queue Active</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cloud Synced</span>
              </>
            )}
          </div>
        )}

        {pendingSyncCount > 0 && !isOffline && (
          user.accountType === 'OWNER' ? (
            <button
              onClick={onTriggerSync}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition animate-pulse"
              title="Owner Control: Force sync outbox transactions"
            >
              <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
              <span className="hidden sm:inline">Sync ({pendingSyncCount})</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"
              title="Outbox transactions queued for automatic sync"
            >
              <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
              <span className="hidden sm:inline">Syncing ({pendingSyncCount})</span>
            </div>
          )
        )}
      </div>

      {/* Right: User, Account Type & Quick Lock */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-800 leading-none truncate max-w-[80px] sm:max-w-none">
              {user.name}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center justify-end gap-1">
              {user.accountType === 'OWNER' ? (
                <span className="text-teal-700 font-bold flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3" /> OWNER
                </span>
              ) : (
                <span className="text-slate-600 flex items-center gap-0.5">
                  <User className="w-3 h-3" /> STAFF
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onLock}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition border border-transparent hover:border-slate-300"
          title="Quick Lock (PIN required to resume)"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
