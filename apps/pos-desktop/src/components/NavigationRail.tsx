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
          {/* POS Billing Screen (P1) */}
          <button
            onClick={() => handleSelect('POS')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
            activeScreen === 'POS'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="POS Counter (F1)"
        >
          <ShoppingCart className="w-4 h-4 mb-0.5" />
          <span>Billing</span>
        </button>

        {/* Medicine Search (M1) */}
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

        {/* Stock Check (I1) */}
        <button
          onClick={() => handleSelect('STOCK')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
            activeScreen === 'STOCK'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Stock Check & Batches (I1)"
        >
          <Boxes className="w-4 h-4 mb-0.5" />
          <span>Stock</span>
        </button>

        {/* Medicines Catalog / Formulations (MED-001) */}
        <button
          onClick={() => handleSelect('MEDICINES')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
            activeScreen === 'MEDICINES'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Medicine Catalog & Formulations (MED-001)"
        >
          <Pill className="w-4 h-4 mb-0.5" />
          <span>Catalog</span>
        </button>

        {/* Purchase Entry (U1) */}
        <button
          onClick={() => handleSelect('PURCHASES')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
            activeScreen === 'PURCHASES'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Purchase Goods Receipt (U1)"
        >
          <Package className="w-4 h-4 mb-0.5" />
          <span>Purchase</span>
        </button>

        {/* Supplier Directory & Payables (PUR-002) */}
        <button
          onClick={() => handleSelect('SUPPLIERS')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
            activeScreen === 'SUPPLIERS'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Suppliers & Payables Ledger (PUR-002)"
        >
          <Truck className="w-4 h-4 mb-0.5" />
          <span>Suppliers</span>
        </button>

        {/* Invoices List & Returns (P3 / RET-001) */}
        <button
          onClick={() => handleSelect('INVOICES')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
            activeScreen === 'INVOICES'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Invoice History & Returns (P3 / RET-001)"
        >
          <FileText className="w-4 h-4 mb-0.5" />
          <span>Invoices</span>
        </button>

        {/* Customer Khata & Credit (CUS-001) */}
        <button
          onClick={() => handleSelect('CUSTOMERS')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
            activeScreen === 'CUSTOMERS'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Customer Khata & Receivables (CUS-001)"
        >
          <UserCheck className="w-4 h-4 mb-0.5" />
          <span>Khata</span>
        </button>

        {/* Expiry Control (EXP-001) */}
        <button
          onClick={() => handleSelect('EXPIRY')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
            activeScreen === 'EXPIRY'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Expiry Management (EXP-001)"
        >
          <Calendar className="w-4 h-4 mb-0.5" />
          <span>Expiry</span>
        </button>

        {/* Held Bills (P2) */}
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

        {/* OWNER-ONLY SECTIONS (Per FES Section 4 & 5 - Not rendered for Staff!) */}
        {isOwner && (
          <>
            <div className="w-full border-t border-slate-800 my-1" />

            {/* Owner Financial Dashboard (FES 8.4) */}
            <button
              onClick={() => handleSelect('DASHBOARD')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                activeScreen === 'DASHBOARD'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Owner Financial Dashboard"
            >
              <LayoutDashboard className="w-4 h-4 mb-0.5" />
              <span>Metrics</span>
            </button>

            {/* MIS & Sales Velocity Reports (RPT-002) */}
            <button
              onClick={() => handleSelect('REPORTS')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                activeScreen === 'REPORTS'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="MIS Reports & Sales Velocity (RPT-002)"
            >
              <BarChart3 className="w-4 h-4 mb-0.5" />
              <span>Reports</span>
            </button>

            {/* GST & Double-Entry Accounting (GST-004 / ACC-005) */}
            <button
              onClick={() => handleSelect('GST')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                activeScreen === 'GST'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="GST Compliance & Day Book"
            >
              <Calculator className="w-4 h-4 mb-0.5" />
              <span>GST/Acc</span>
            </button>

            {/* Reconciliation Exceptions Queue (S2) */}
            <button
              onClick={() => handleSelect('EXCEPTIONS')}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                activeScreen === 'EXCEPTIONS'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Sync Reconciliation Exceptions (Owner only)"
            >
              <AlertCircle className="w-4 h-4 mb-0.5 text-red-400" />
              <span>Except</span>
              {exceptionsCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {exceptionsCount}
                </span>
              )}
            </button>

            {/* Staff & Audit Trail (A1) */}
            <button
              onClick={() => handleSelect('STAFF')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                activeScreen === 'STAFF'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Staff Accounts & Tamper-Evident Audit Logs"
            >
              <Users className="w-4 h-4 mb-0.5" />
              <span>Staff</span>
            </button>

            {/* Store & Offline Control (DEV-004) */}
            <button
              onClick={() => handleSelect('SYSTEM')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition text-[9px] font-medium w-full ${
                activeScreen === 'SYSTEM'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Store Architecture & Offline Control"
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
