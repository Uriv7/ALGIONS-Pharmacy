import React, { useState, useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar.js';
import { NavigationRail, ActiveScreen } from './components/NavigationRail.js';
import { POSScreen } from './screens/POSScreen.js';
import { MedicineSearchScreen } from './screens/MedicineSearchScreen.js';
import { StockCheckScreen } from './screens/StockCheckScreen.js';
import { PurchaseEntryScreen } from './screens/PurchaseEntryScreen.js';
import { InvoiceListScreen } from './screens/InvoiceListScreen.js';
import { OwnerDashboardScreen } from './screens/OwnerDashboardScreen.js';
import { ExceptionsScreen } from './screens/ExceptionsScreen.js';
import { StaffManagementScreen } from './screens/StaffManagementScreen.js';
import { CustomerManagementScreen } from './screens/CustomerManagementScreen.js';
import { ExpiryManagementScreen } from './screens/ExpiryManagementScreen.js';
import { AccountingGstScreen } from './screens/AccountingGstScreen.js';
import { StoreControlScreen } from './screens/StoreControlScreen.js';
import { MedicineMasterScreen } from './screens/MedicineMasterScreen.js';
import { SupplierManagementScreen } from './screens/SupplierManagementScreen.js';
import { ReportsScreen } from './screens/ReportsScreen.js';
import { StaffDashboardScreen } from './screens/StaffDashboardScreen.js';
import { LockScreen } from './components/LockScreen.js';
import { ReceiptPrintDialog } from './components/dialogs/ReceiptPrintDialog.js';
import { FullWidthBanner } from '@algions/ui';
import { api } from './api/client.js';
import { offlineEngine } from './offline/engine.js';
import { AuthSessionUser } from '@algions/contracts';
import {
  LogIn,
  KeyRound,
  ShieldCheck,
  User,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Server,
  Clock,
  Activity,
} from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [storeStatus, setStoreStatus] = useState<any | null>(null);
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('POS');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [heldBillsCount, setHeldBillsCount] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Login form state
  const [username, setUsername] = useState('staff1');
  const [password, setPassword] = useState('Staff@Algions2026!');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState<boolean>(false);
  const [mfaToken, setMfaToken] = useState<string>('');
  const [mfaCode, setMfaCode] = useState<string>('');

  // Backend health & Render cold-start indicator state
  type BackendStatus = 'CHECKING' | 'WAKING_UP' | 'ONLINE' | 'OFFLINE';
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('CHECKING');
  const [backendLatency, setBackendLatency] = useState<number | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [wakeSeconds, setWakeSeconds] = useState<number>(0);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginSeconds, setLoginSeconds] = useState<number>(0);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState<boolean>(false);

  // Reprint Dialog
  const [reprintInvoice, setReprintInvoice] = useState<any | null>(null);

  // Ping Backend Health (detects Render cold starts)
  const checkBackendHealth = useCallback(async () => {
    setBackendError(null);
    const start = Date.now();

    // Start timer that increments every second; if >= 3s, flag as WAKING_UP
    const wakeInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setWakeSeconds(elapsed);
      if (elapsed >= 3) {
        setBackendStatus((curr) => (curr === 'ONLINE' ? 'ONLINE' : 'WAKING_UP'));
      }
    }, 1000);

    try {
      const res = await api.checkHealth();
      clearInterval(wakeInterval);
      if (res.status === 'ok') {
        setBackendStatus('ONLINE');
        setBackendLatency(res.latencyMs);
        if (res.storeName) {
          setStoreStatus((prev: any) => ({
            ...prev,
            name: res.storeName,
            activeMode: res.activeMode || 'ONLINE',
          }));
        }
      } else {
        setBackendStatus('OFFLINE');
        setBackendError(res.error || 'Server error');
      }
    } catch (err: any) {
      clearInterval(wakeInterval);
      setBackendStatus('OFFLINE');
      setBackendError(err.message || 'Cannot reach server');
    }
  }, []);

  // Initial load & health polling
  useEffect(() => {
    // Check health immediately on mount
    checkBackendHealth();

    const initStore = async () => {
      try {
        const status = await api.getStoreStatus();
        setStoreStatus(status);
      } catch (err) {
        console.error('Store status error:', err);
      }
    };
    initStore();

    // Heartbeat every 15s per TAD Section 6
    const heartbeatTimer = setInterval(async () => {
      if (!isOffline && user) {
        try {
          await api.sendHeartbeat(Date.now());
        } catch {
          // offline detected
        }
      }
    }, 15000);

    return () => clearInterval(heartbeatTimer);
  }, [isOffline, user, checkBackendHealth]);

  // Periodic health check while on Auth screen
  useEffect(() => {
    if (user) return;
    const pollInterval = setInterval(() => {
      checkBackendHealth();
    }, backendStatus === 'ONLINE' ? 30000 : 7000);

    return () => clearInterval(pollInterval);
  }, [user, backendStatus, checkBackendHealth]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    setLoginSeconds(0);

    const loginStartTime = Date.now();
    const loginTimer = setInterval(() => {
      setLoginSeconds(Math.floor((Date.now() - loginStartTime) / 1000));
    }, 1000);

    try {
      const res = await api.login(username, password);
      clearInterval(loginTimer);
      setIsLoggingIn(false);
      setBackendStatus('ONLINE');
      if (res.requiresMfa) {
        setRequiresMfa(true);
        setMfaToken(res.tempToken || '');
        setMfaCode('123456'); // pre-fill demo TOTP for ease of testing
      } else {
        setUser(res.user);
        setActiveScreen(res.user.accountType === 'OWNER' ? 'DASHBOARD' : 'POS');
      }
    } catch (err: any) {
      clearInterval(loginTimer);
      setIsLoggingIn(false);
      const isNetwork =
        err.message?.toLowerCase().includes('failed to fetch') ||
        err.message?.toLowerCase().includes('network') ||
        err.message?.toLowerCase().includes('timeout') ||
        err.message?.toLowerCase().includes('abort');

      if (isNetwork || backendStatus !== 'ONLINE') {
        setLoginError(
          'Could not reach the server. The Render cloud instance is likely waking up from sleep mode (~30-50s). Please wait for the status indicator above to show Online and try again.'
        );
        checkBackendHealth();
      } else {
        setLoginError(err.message || 'Login failed. Check credentials.');
      }
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingMfa(true);
    setLoginError(null);
    try {
      const res = await api.verifyMfa(mfaToken, mfaCode);
      setIsVerifyingMfa(false);
      setUser(res.user);
      setRequiresMfa(false);
      setActiveScreen('DASHBOARD');
    } catch (err: any) {
      setIsVerifyingMfa(false);
      setLoginError(err.message || 'Invalid MFA Code.');
    }
  };

  // Quick Unlock PIN
  const handleQuickUnlock = async (pin: string): Promise<boolean> => {
    try {
      const res = await api.quickUnlock(pin);
      setUser(res.user);
      setIsLocked(false);
      return true;
    } catch {
      return false;
    }
  };

  // Toggle Offline Simulation (demonstrates failover & local commit)
  const handleToggleOffline = () => {
    const nextState = !isOffline;
    setIsOffline(nextState);
    offlineEngine.setOfflineMode(nextState);
  };

  // Trigger sync
  const handleTriggerSync = async () => {
    const result = await offlineEngine.triggerSync();
    setPendingSyncCount(result.remainingCount);
  };

  if (!user) {
    return (
      <div className="h-screen w-screen bg-slate-900 flex items-center justify-center p-4 select-none">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-100">
          <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center text-white font-black text-xl mx-auto mb-4 shadow-md">
            A
          </div>
          <h1 className="text-xl font-bold text-center text-slate-800">ALGIONS Pharmacy</h1>
          <p className="text-xs text-center text-slate-500 mt-1 mb-4">
            Sign in to start counter billing session
          </p>

          {/* Live Backend Health & Render Cold-Start Indicator */}
          <div className="mb-4">
            {backendStatus === 'ONLINE' && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <div>
                    <span className="font-bold text-[11px] text-emerald-900">Cloud API Online</span>
                    <span className="text-[10px] text-emerald-600 block">
                      {storeStatus?.name || 'ALGIONS Pharmacy Cloud'} • Ready
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {backendLatency !== null && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-mono font-medium">
                      {backendLatency}ms
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={checkBackendHealth}
                    title="Refresh server status"
                    className="p-1 hover:bg-emerald-100 rounded text-emerald-700 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {backendStatus === 'WAKING_UP' && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />
                    <span className="font-bold text-amber-900">Waking Up Cloud Server...</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {wakeSeconds}s
                  </span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  Render free instances spin down after inactivity. The backend is spinning up (takes ~30–50s). Please wait...
                </p>
                <div className="w-full bg-amber-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-600 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min(100, Math.round((wakeSeconds / 45) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {backendStatus === 'CHECKING' && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                  <span className="text-[11px]">Connecting to Cloud API...</span>
                </div>
                <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />
              </div>
            )}

            {backendStatus === 'OFFLINE' && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span className="font-bold text-[11px]">Cloud Server Offline / Sleeping</span>
                  </div>
                  <button
                    type="button"
                    onClick={checkBackendHealth}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-[10px] flex items-center gap-1 shadow-sm transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Wake Server</span>
                  </button>
                </div>
                <p className="text-[10px] text-red-600 leading-snug">
                  If the server hasn't been accessed recently, clicking "Wake Server" will initiate Render boot.
                </p>
              </div>
            )}
          </div>

          {loginError && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
              {loginError}
            </div>
          )}

          {!requiresMfa ? (
            <form onSubmit={handleLogin} className="space-y-3.5">
              {/* Quick Auto-Fill Role Buttons */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                  Quick Role Auto-Fill
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUsername('owner');
                      setPassword('Owner@Algions2026!');
                      setLoginError(null);
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      username === 'owner'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-600/20'
                        : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Auto-fill Owner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUsername('staff1');
                      setPassword('Staff@Algions2026!');
                      setLoginError(null);
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      username === 'staff1'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-600/20'
                        : 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Auto-fill Staff</span>
                  </button>
                </div>
              </div>

              {/* Role Scope Badge */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                {username === 'owner' ? (
                  <div>
                    <div className="font-bold text-purple-800 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                      <span>Owner Permissions: 15 Feature Modules</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                      Dashboard, POS, Catalog, Inventory, Purchases, Suppliers, Customers, Accounting, GST, Reports, Staff, Settings, Devices, Backup/Sync, Mobile
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-bold text-teal-800 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-teal-600" />
                      <span>Staff Permissions: 10 Feature Modules</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                      Dashboard (Limited), POS Billing, Search, Customers, Purchases, Stock Check, Sales Returns, Profile, Own Billing, Activity History
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className={`w-full py-2.5 font-bold rounded-lg text-xs shadow-md transition flex items-center justify-center gap-1.5 ${
                    isLoggingIn
                      ? 'bg-teal-700 text-white cursor-wait opacity-90'
                      : 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white'
                  }`}
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>
                        {loginSeconds > 2
                          ? `Waking Server & Authenticating (${loginSeconds}s)...`
                          : 'Signing In...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In as {username === 'owner' ? 'Owner' : 'Staff'}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1 truncate max-w-[240px]">
                  <Server className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span className="truncate" title={api.getBaseUrl()}>
                    {api.getBaseUrl()}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={checkBackendHealth}
                  className="text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-0.5 ml-2 flex-shrink-0"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Ping</span>
                </button>
              </div>

              <div className="text-[10px] text-slate-400 text-center">
                Demo: <span className="font-semibold text-slate-600">owner</span> (MFA 123456) • <span className="font-semibold text-slate-600">staff1</span> (PIN 1234)
              </div>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-3.5">
              <div className="text-xs text-slate-600 mb-2">
                Owner account requires 6-digit TOTP verification code.
              </div>
              <div>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="Enter 6-digit code (e.g. 123456)"
                  className="w-full px-3 py-2 text-center tracking-widest font-mono text-lg bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 font-bold"
                  autoFocus
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => setMfaCode('123456')}
                className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition"
              >
                Auto-fill Code: 123456
              </button>
              <button
                type="submit"
                disabled={isVerifyingMfa}
                className={`w-full py-2.5 font-bold rounded-lg text-xs shadow transition flex items-center justify-center gap-1.5 ${
                  isVerifyingMfa
                    ? 'bg-teal-700 text-white cursor-wait opacity-90'
                    : 'bg-teal-600 hover:bg-teal-700 text-white'
                }`}
              >
                {isVerifyingMfa ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Verify & Enter</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setRequiresMfa(false)}
                className="w-full py-1 text-slate-400 hover:text-slate-600 text-xs text-center"
              >
                Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden select-none">
      {/* Top Application Bar */}
      <TopBar
        user={user}
        storeName={storeStatus?.name || 'ALGIONS Health Pharmacy'}
        storeMode={storeStatus?.activeMode || 'ONLINE'}
        isOffline={isOffline}
        isPrimary={true}
        pendingSyncCount={pendingSyncCount}
        lastHeartbeatTime={storeStatus?.serverTime || null}
        onToggleOfflineSimulator={handleToggleOffline}
        onTriggerSync={handleTriggerSync}
        onLock={() => setIsLocked(true)}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Offline Mode Banner per FES Section 4 */}
      {isOffline && (
        <FullWidthBanner
          type="CUSTOM"
          customTitle="OFFLINE BILLING ACTIVE (PRIMARY WORKSTATION)"
          customMessage="Transactions will be saved securely to local SQLite outbox and synchronized automatically once network is restored."
        />
      )}

      {/* Main Layout: Navigation Rail + Active Screen Content */}
      <div className="flex-1 flex overflow-hidden">
        <NavigationRail
          activeScreen={activeScreen}
          accountType={user.accountType}
          heldBillsCount={heldBillsCount}
          exceptionsCount={storeStatus?.pendingExceptionsCount || 0}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onSelectScreen={setActiveScreen}
        />

        {activeScreen === 'POS' && (
          <POSScreen
            user={user}
            isOffline={isOffline}
            storeProfile={storeStatus}
            onRefreshSyncCount={() => setPendingSyncCount(offlineEngine.getPendingCount())}
          />
        )}

        {activeScreen === 'SEARCH' && (
          <MedicineSearchScreen
            onSelectItemForBilling={(prod, batch) => {
              setActiveScreen('POS');
            }}
          />
        )}

        {activeScreen === 'STOCK' && <StockCheckScreen user={user} />}

        {activeScreen === 'MEDICINES' && (
          user.accountType === 'OWNER' ? (
            <MedicineMasterScreen user={user} />
          ) : (
            <MedicineSearchScreen onSelectItemForBilling={() => setActiveScreen('POS')} />
          )
        )}

        {activeScreen === 'PURCHASES' && (
          <PurchaseEntryScreen user={user} onSuccess={() => setActiveScreen('STOCK')} />
        )}

        {activeScreen === 'SUPPLIERS' && (
          user.accountType === 'OWNER' ? (
            <SupplierManagementScreen user={user} />
          ) : (
            <PurchaseEntryScreen user={user} onSuccess={() => setActiveScreen('STOCK')} />
          )
        )}

        {activeScreen === 'INVOICES' && (
          <InvoiceListScreen
            user={user}
            onReprintInvoice={async (id) => {
              const inv = await api.getInvoice(id);
              setReprintInvoice(inv);
            }}
          />
        )}

        {activeScreen === 'CUSTOMERS' && <CustomerManagementScreen user={user} />}

        {activeScreen === 'EXPIRY' && <ExpiryManagementScreen user={user} />}

        {activeScreen === 'HELD' && (
          <POSScreen
            user={user}
            isOffline={isOffline}
            storeProfile={storeStatus}
            onRefreshSyncCount={() => setPendingSyncCount(offlineEngine.getPendingCount())}
          />
        )}

        {activeScreen === 'STAFF_DASHBOARD' && (
          <StaffDashboardScreen
            user={user}
            onNavigate={setActiveScreen}
            onReprintInvoice={(inv) => setReprintInvoice(inv)}
          />
        )}

        {activeScreen === 'DASHBOARD' && (
          user.accountType === 'STAFF' ? (
            <StaffDashboardScreen
              user={user}
              onNavigate={setActiveScreen}
              onReprintInvoice={(inv) => setReprintInvoice(inv)}
            />
          ) : (
            <OwnerDashboardScreen />
          )
        )}

        {activeScreen === 'REPORTS' && (
          user.accountType === 'OWNER' ? (
            <ReportsScreen />
          ) : (
            <StaffDashboardScreen
              user={user}
              onNavigate={setActiveScreen}
              onReprintInvoice={(inv) => setReprintInvoice(inv)}
            />
          )
        )}

        {activeScreen === 'GST' && (
          user.accountType === 'OWNER' ? (
            <AccountingGstScreen />
          ) : (
            <StaffDashboardScreen
              user={user}
              onNavigate={setActiveScreen}
              onReprintInvoice={(inv) => setReprintInvoice(inv)}
            />
          )
        )}

        {activeScreen === 'EXCEPTIONS' && (
          user.accountType === 'OWNER' ? (
            <ExceptionsScreen />
          ) : (
            <StaffDashboardScreen
              user={user}
              onNavigate={setActiveScreen}
              onReprintInvoice={(inv) => setReprintInvoice(inv)}
            />
          )
        )}

        {activeScreen === 'STAFF' && (
          user.accountType === 'OWNER' ? (
            <StaffManagementScreen />
          ) : (
            <StaffDashboardScreen
              user={user}
              onNavigate={setActiveScreen}
              onReprintInvoice={(inv) => setReprintInvoice(inv)}
            />
          )
        )}

        {activeScreen === 'SYSTEM' && (
          user.accountType === 'OWNER' ? (
            <StoreControlScreen
              user={user}
              isOffline={isOffline}
              onToggleOffline={handleToggleOffline}
            />
          ) : (
            <StaffDashboardScreen
              user={user}
              onNavigate={setActiveScreen}
              onReprintInvoice={(inv) => setReprintInvoice(inv)}
            />
          )
        )}
      </div>

      {/* Quick Lock Screen Modal (A2) */}
      {isLocked && (
        <LockScreen
          user={user}
          onUnlock={handleQuickUnlock}
          onFullLogout={() => {
            setUser(null);
            setIsLocked(false);
            api.clearToken();
          }}
        />
      )}

      {/* Reprint Modal */}
      {reprintInvoice && (
        <ReceiptPrintDialog
          invoice={reprintInvoice}
          store={storeStatus}
          onClose={() => setReprintInvoice(null)}
        />
      )}
    </div>
  );
};
