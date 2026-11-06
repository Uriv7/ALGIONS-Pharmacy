import React from 'react';
import {
  ShoppingCart,
  Search,
  Package,
  FileText,
  Clock,
  Boxes,
  Users,
  AlertCircle,
  LayoutDashboard,
  Calendar,
  Calculator,
  Server,
  UserCheck,
  Pill,
  Truck,
  BarChart3,
} from 'lucide-react';
import { AccountType } from '@algions/contracts';

export type ActiveScreen =
  | 'POS'
  | 'SEARCH'
  | 'STOCK'
  | 'MEDICINES'
  | 'PURCHASES'
  | 'SUPPLIERS'
  | 'INVOICES'
  | 'CUSTOMERS'
  | 'EXPIRY'
  | 'HELD'
  | 'DASHBOARD'
  | 'STAFF_DASHBOARD'
  | 'REPORTS'
  | 'GST'
  | 'EXCEPTIONS'
  | 'STAFF'
  | 'SYSTEM';

interface NavigationRailProps {
  activeScreen: ActiveScreen;
  accountType: AccountType;
  heldBillsCount: number;
  exceptionsCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onSelectScreen: (screen: ActiveScreen) => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeScreen,
  accountType,
  heldBillsCount,
  exceptionsCount,
  isMobileOpen = false,
  onCloseMobile,
  onSelectScreen,
}) => {
  const isOwner = accountType === 'OWNER';

  const handleSelect = (screen: ActiveScreen) => {
    onSelectScreen(screen);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-30 md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-16 bg-slate-900 flex flex-col items-center py-2 select-none flex-shrink-0 overflow-y-auto transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col gap-1.5 w-full px-1.5">
          {/* 1. Dashboard */}
          <button
            onClick={() => handleSelect(isOwner ? 'DASHBOARD' : 'STAFF_DASHBOARD')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
              (isOwner && activeScreen === 'DASHBOARD') || (!isOwner && activeScreen === 'STAFF_DASHBOARD')
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={isOwner ? 'Owner Financial Dashboard (Full)' : 'Staff Counter Dashboard (Limited)'}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span>Dashboard</span>
          </button>

          {/* 2. POS / Billing Screen */}
          <button
            onClick={() => handleSelect('POS')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
              activeScreen === 'POS'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="POS Billing Counter (F1)"
          >
            <ShoppingCart className="w-4 h-4 mb-0.5" />
            <span>Billing</span>
          </button>

          {/* 3. Medicine Search (Staff & Owner) */}
          <button
            onClick={() => handleSelect('SEARCH')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
              activeScreen === 'SEARCH'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Medicine Search & Substitutes (F2)"
          >
            <Search className="w-4 h-4 mb-0.5" />
            <span>Search</span>
          </button>

          {/* 4. Medicine Management (Owner ONLY) */}
          {isOwner && (
            <button
              onClick={() => handleSelect('MEDICINES')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                activeScreen === 'MEDICINES'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Medicine Management & CSV (Owner Only - MED-001)"
            >
              <Pill className="w-4 h-4 mb-0.5" />
              <span>Catalog</span>
            </button>
          )}

          {/* 5. Inventory Management / Stock Checking */}
          <button
            onClick={() => handleSelect('STOCK')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
              activeScreen === 'STOCK'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={isOwner ? 'Inventory Management & Valuation' : 'Stock Checking (I1)'}
          >
            <Boxes className="w-4 h-4 mb-0.5" />
            <span>Stock</span>
          </button>

          {/* 6. Purchase Entries / Management */}
          <button
            onClick={() => handleSelect('PURCHASES')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
              activeScreen === 'PURCHASES'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={isOwner ? 'Purchase Management & Approvals' : 'Purchase Entries (U1)'}
          >
            <Package className="w-4 h-4 mb-0.5" />
            <span>Purchase</span>
          </button>

          {/* 7. Supplier Management (Owner ONLY) */}
          {isOwner && (
            <button
              onClick={() => handleSelect('SUPPLIERS')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                activeScreen === 'SUPPLIERS'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Supplier Management & Payables (Owner Only - PUR-001)"
            >
              <Truck className="w-4 h-4 mb-0.5" />
              <span>Suppliers</span>
            </button>
          )}

          {/* 8. Customer Management (Both) */}
          <button
            onClick={() => handleSelect('CUSTOMERS')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
              activeScreen === 'CUSTOMERS'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={isOwner ? 'Customer Management & Credit Limits' : 'Customer Khata Lookup'}
          >
            <UserCheck className="w-4 h-4 mb-0.5" />
            <span>Khata</span>
          </button>

          {/* 9. Invoices / Sales Returns */}
          <button
            onClick={() => handleSelect('INVOICES')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
              activeScreen === 'INVOICES'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={isOwner ? 'Invoice History & Voids (Full)' : 'Billing History & Returns (Restricted)'}
          >
            <FileText className="w-4 h-4 mb-0.5" />
            <span>Invoices</span>
          </button>

          {/* 10. Expiry Management */}
          <button
            onClick={() => handleSelect('EXPIRY')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
              activeScreen === 'EXPIRY'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Expiry Management & Near-Expiry Alerts"
          >
            <Calendar className="w-4 h-4 mb-0.5" />
            <span>Expiry</span>
          </button>

          {/* 11. Held Bills */}
          <button
            onClick={() => handleSelect('HELD')}
            className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
              activeScreen === 'HELD'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Held Bills (F6)"
          >
            <Clock className="w-4 h-4 mb-0.5" />
            <span>Held</span>
            {heldBillsCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-amber-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                {heldBillsCount}
              </span>
            )}
          </button>

          {/* 12. Staff Profile & Activity (Staff ONLY) */}
          {!isOwner && (
            <button
              onClick={() => handleSelect('STAFF_DASHBOARD')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                activeScreen === 'STAFF_DASHBOARD'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Staff Profile & Activity History"
            >
              <Users className="w-4 h-4 mb-0.5" />
              <span>Profile</span>
            </button>
          )}

          {/* OWNER-ONLY MODULES (Accounting, GST, Reports, Staff, Exceptions/Sync, System/Devices) */}
          {isOwner && (
            <>
              <div className="w-full border-t border-slate-800 my-1" />

              {/* Reports & Analytics */}
              <button
                onClick={() => handleSelect('REPORTS')}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                  activeScreen === 'REPORTS'
                    ? 'bg-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Reports & Analytics (Owner Only)"
              >
                <BarChart3 className="w-4 h-4 mb-0.5" />
                <span>Reports</span>
              </button>

              {/* Accounting & Finance / GST & Tax */}
              <button
                onClick={() => handleSelect('GST')}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                  activeScreen === 'GST'
                    ? 'bg-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Accounting & Finance, GST & Tax (Owner Only)"
              >
                <Calculator className="w-4 h-4 mb-0.5" />
                <span>GST/Acc</span>
              </button>

              {/* Employee / Staff Management */}
              <button
                onClick={() => handleSelect('STAFF')}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                  activeScreen === 'STAFF'
                    ? 'bg-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Employee / Staff Management (Owner Only)"
              >
                <Users className="w-4 h-4 mb-0.5" />
                <span>Staff</span>
              </button>

              {/* Backup, Synchronization & Exceptions */}
              <button
                onClick={() => handleSelect('EXCEPTIONS')}
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                  activeScreen === 'EXCEPTIONS'
                    ? 'bg-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Backup & Synchronization, Exceptions (Owner Only)"
              >
                <AlertCircle className="w-4 h-4 mb-0.5 text-amber-400" />
                <span>Sync</span>
                {exceptionsCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {exceptionsCount}
                  </span>
                )}
              </button>

              {/* System Settings & Device Management */}
              <button
                onClick={() => handleSelect('SYSTEM')}
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                  activeScreen === 'SYSTEM'
                    ? 'bg-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="System Settings & Device Management (Owner Only)"
              >
                <Server className="w-4 h-4 mb-0.5" />
                <span>System</span>
              </button>
            </>
          )}
      </div>
    </aside>
    </>
  );
};
