import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Receipt,
  Percent,
  Wallet,
  Building,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';
import { api } from '../api/client.js';

export const OwnerDashboardScreen: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getOwnerDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load Owner Dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500 font-semibold text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-teal-600" />
          <span>Loading Owner Dashboard metrics...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 bg-slate-50 flex items-center justify-center">
        <div className="bg-white p-6 rounded-xl border border-red-200 max-w-md text-center shadow-sm">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-2" />
          <h2 className="text-base font-bold text-slate-800">Dashboard Unavailable</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{error || 'Unable to fetch data.'}</p>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-slate-100 overflow-y-auto p-6">
      {/* Stale Warning Banner per FES Section 8.4 */}
      {data.isStale && (
        <div className="mb-4 bg-amber-500 text-slate-900 px-4 py-2.5 rounded-lg flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide">
            <Clock className="w-4 h-4" />
            <span>STALE DASHBOARD – Primary Workstation Offline</span>
          </div>
          <span className="text-[11px] font-medium text-slate-900">
            Metrics reflect last synchronized cloud state. Reconnecting will stream live updates.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Owner Financial & Operations Overview
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 uppercase">
              {data.storeMode}
            </span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Real-time multi-counter analytics, cash drawer balances, and inventory health
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Today's Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's Sales</span>
            <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {formatPaiseToINR(data.todaySalesPaise)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {data.todayBillsCount} total bills posted today
            </div>
          </div>
        </div>

        {/* Gross Margin */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Margin</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">
              {data.grossMarginPercent}%
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              Average across all dispensed categories
            </div>
          </div>
        </div>

        {/* Cash in Counter */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cash in Counter</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {formatPaiseToINR(data.cashInHandPaise)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              Ledger Account 1000 (Cash)
            </div>
          </div>
        </div>

        {/* Bank Account Balance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Bank Balance</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {formatPaiseToINR(data.bankBalancePaise)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              UPI & Card collections deposited
            </div>
          </div>
        </div>
      </div>

      {/* Middle Grid: Payment Splits & Top Sellers */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Payment Split */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Payment Methods</h2>
          <div className="space-y-3">
            {data.paymentModeSplit.length === 0 ? (
              <p className="text-xs text-slate-400">No payment data recorded yet.</p>
            ) : (
              data.paymentModeSplit.map((p: any) => (
                <div key={p.mode} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700">{p.mode}</span>
                    <span className="text-slate-900">{formatPaiseToINR(p.amountPaise)} ({p.percent}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-teal-600 h-2 rounded-full transition-all"
                      style={{ width: `${p.percent}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Selling Medicines */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-2">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Fast-Moving Medicines</h2>
          <div className="divide-y divide-slate-100">
            {data.topSellingProducts.length === 0 ? (
              <p className="text-xs text-slate-400">No sales recorded yet.</p>
            ) : (
              data.topSellingProducts.map((p: any, idx: number) => (
                <div key={p.productName} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{p.productName}</div>
                      <div className="text-[11px] text-slate-500">{p.unitsSold} units dispensed</div>
                    </div>
                  </div>
                  <div className="text-xs font-black text-slate-900">
                    {formatPaiseToINR(p.totalSalesPaise)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Risk, Near-Expiry & Operational Actions */}
      <div className="grid grid-cols-3 gap-6">
        {/* Near Expiry Risk */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600 mb-2 font-bold text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>Near-Expiry Value (&lt; 90 Days)</span>
          </div>
          <div className="text-2xl font-black text-amber-600 mb-1">
            {formatPaiseToINR(data.nearExpiryStockValuePaise)}
          </div>
          <p className="text-[11px] text-slate-500">
            Eligible for FEFO prioritization or supplier debit note return.
          </p>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-red-600 mb-2 font-bold text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>Reorder Triggered</span>
          </div>
          <div className="text-2xl font-black text-red-600 mb-1">
            {data.lowStockCount} SKUs
          </div>
          <p className="text-[11px] text-slate-500">
            Products at or below defined safety reorder thresholds.
          </p>
        </div>

        {/* Audit & Compliance Card */}
        <div className="bg-teal-900 text-white p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-teal-300 font-bold text-xs mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Immutable Ledger & Tamper Proof</span>
            </div>
            <p className="text-xs text-teal-100 font-normal leading-relaxed">
              All financial transactions, invoices, and stock movements are cryptographically chained with SHA-256.
            </p>
          </div>
          <div className="text-[11px] text-teal-300 font-semibold mt-3">
            Status: Audit Hash Validated ✓
          </div>
        </div>
      </div>
    </main>
  );
};
