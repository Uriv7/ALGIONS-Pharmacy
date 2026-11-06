import React from 'react';
import {
  ShoppingCart,
  Search,
  Package,
  FileText,
  Clock,
  Boxes,
  Users,
  Settings,
  AlertCircle,
  LayoutDashboard,
} from 'lucide-react';
import { AccountType } from '@algions/contracts';

export type ActiveScreen =
  | 'POS'
  | 'SEARCH'
  | 'STOCK'
  | 'PURCHASES'
  | 'INVOICES'
  | 'HELD'
  | 'DASHBOARD'
  | 'EXCEPTIONS'
  | 'STAFF'
  | 'SETTINGS';

interface NavigationRailProps {
  activeScreen: ActiveScreen;
  accountType: AccountType;
  heldBillsCount: number;
  exceptionsCount: number;
  onSelectScreen: (screen: ActiveScreen) => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeScreen,
  accountType,
  heldBillsCount,
  exceptionsCount,
  onSelectScreen,
}) => {
  const isOwner = accountType === 'OWNER';

  return (
    <aside className="w-16 bg-slate-900 flex flex-col items-center py-3 select-none flex-shrink-0 z-10">
      <div className="flex flex-col gap-2 w-full px-2">
        {/* POS Billing Screen (P1) */}
        <button
          onClick={() => onSelectScreen('POS')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition text-[10px] font-medium w-full ${
            activeScreen === 'POS'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="POS Counter (F1)"
        >
          <ShoppingCart className="w-5 h-5 mb-1" />
          <span>Billing</span>
        </button>

        {/* Medicine Search (M1) */}
        <button
          onClick={() => onSelectScreen('SEARCH')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition text-[10px] font-medium w-full ${
            activeScreen === 'SEARCH'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Medicine Search & Substitutes (F2)"
        >
          <Search className="w-5 h-5 mb-1" />
          <span>Search</span>
        </button>

        {/* Stock Check (I1) */}
        <button
          onClick={() => onSelectScreen('STOCK')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition text-[10px] font-medium w-full ${
            activeScreen === 'STOCK'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Stock Check & Batches (I1)"
        >
          <Boxes className="w-5 h-5 mb-1" />
          <span>Stock</span>
        </button>

        {/* Purchase Entry (U1) */}
        <button
          onClick={() => onSelectScreen('PURCHASES')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition text-[10px] font-medium w-full ${
            activeScreen === 'PURCHASES'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Purchase Goods Receipt (U1)"
        >
          <Package className="w-5 h-5 mb-1" />
          <span>Purchase</span>
        </button>

        {/* Invoices List & Reprint (P3) */}
        <button
          onClick={() => onSelectScreen('INVOICES')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition text-[10px] font-medium w-full ${
            activeScreen === 'INVOICES'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Invoice History & Reprint (P3)"
        >
          <FileText className="w-5 h-5 mb-1" />
          <span>Invoices</span>
        </button>

        {/* Held Bills (P2) */}
        <button
          onClick={() => onSelectScreen('HELD')}
          className={`relative flex flex-col items-center justify-center p-2 rounded-lg transition text-[10px] font-medium w-full ${
            activeScreen === 'HELD'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          title="Held Bills (F6)"
        >
          <Clock className="w-5 h-5 mb-1" />
          <span>Held</span>
          {heldBillsCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
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
              onClick={() => onSelectScreen('DASHBOARD')}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition text-[10px] font-medium w-full ${
                activeScreen === 'DASHBOARD'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Owner Financial Dashboard"
            >
              <LayoutDashboard className="w-5 h-5 mb-1" />
              <span>Metrics</span>
            </button>

            {/* Reconciliation Exceptions Queue (S2) */}
            <button
              onClick={() => onSelectScreen('EXCEPTIONS')}
              className={`relative flex flex-col items-center justify-center p-2 rounded-lg transition text-[10px] font-medium w-full ${
                activeScreen === 'EXCEPTIONS'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Sync Reconciliation Exceptions (Owner only)"
            >
              <AlertCircle className="w-5 h-5 mb-1 text-red-400" />
              <span>Exceptions</span>
              {exceptionsCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {exceptionsCount}
                </span>
              )}
            </button>

            {/* Staff & Audit Trail (A1) */}
            <button
              onClick={() => onSelectScreen('STAFF')}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition text-[10px] font-medium w-full ${
                activeScreen === 'STAFF'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Staff Accounts & Tamper-Evident Audit Logs"
            >
              <Users className="w-5 h-5 mb-1" />
              <span>Staff</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
};
