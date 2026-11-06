import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  User,
  Package,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';
import { api } from '../api/client.js';

export const ReportsScreen: React.FC = () => {
  const [rangePreset, setRangePreset] = useState<'TODAY' | '7D' | '30D'>('30D');
  const [salesReport, setSalesReport] = useState<any | null>(null);
  const [velocityReport, setVelocityReport] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'ITEMS' | 'CASHIERS' | 'VELOCITY'>('ITEMS');
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let days = 30;
      if (rangePreset === 'TODAY') days = 0;
      else if (rangePreset === '7D') days = 7;

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const endDate = new Date().toISOString().slice(0, 10);

      const [sRes, vRes] = await Promise.all([
        api.getSalesReport(startDate, endDate),
        api.getVelocityReport(),
      ]);
      setSalesReport(sRes);
      setVelocityReport(vRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [rangePreset]);

  const handleExportCSV = () => {
    if (!salesReport?.itemSales?.length) {
      alert('No sales data available to export.');
      return;
    }

    const headers = ['Product Name', 'Units Sold', 'Revenue (INR)', 'Tax (INR)'];
    const rows = salesReport.itemSales.map((i: any) => [
      `"${i.productName}"`,
      i.unitsSold,
      (i.revenuePaise / 100).toFixed(2),
      (i.taxPaise / 100).toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ALGIONS_Sales_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const avgBillSizePaise = salesReport?.totalBillsCount > 0
    ? Math.round(salesReport.totalSalesPaise / salesReport.totalBillsCount)
    : 0;

  return (
    <div className="flex-1 flex flex-col p-6 bg-slate-100 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            <span>Business Intelligence & MIS Reports (RPT-001 / RPT-002)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sales volume analytics • Cashier audit • Fast vs Slow moving velocity analysis
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Preset buttons */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs font-semibold">
            <button
              onClick={() => setRangePreset('TODAY')}
              className={`px-3 py-1 rounded transition ${
                rangePreset === 'TODAY' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setRangePreset('7D')}
              className={`px-3 py-1 rounded transition ${
                rangePreset === '7D' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setRangePreset('30D')}
              className={`px-3 py-1 rounded transition ${
                rangePreset === '30D' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 30 Days
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchReports}
            className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Gross Billed Revenue
          </span>
          <div className="text-xl font-black text-slate-900 mt-1">
            {formatPaiseToINR(salesReport?.totalSalesPaise || 0)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Invoices Issued
          </span>
          <div className="text-xl font-black text-teal-600 mt-1">
            {salesReport?.totalBillsCount || 0} Bills
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Average Basket Size
          </span>
          <div className="text-xl font-black text-slate-900 mt-1">
            {formatPaiseToINR(avgBillSizePaise)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total GST Collected
          </span>
          <div className="text-xl font-black text-slate-900 mt-1">
            {formatPaiseToINR(salesReport?.totalTaxPaise || 0)}
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setActiveTab('ITEMS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
            activeTab === 'ITEMS'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Item Sales Breakdown</span>
        </button>

        <button
          onClick={() => setActiveTab('CASHIERS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
            activeTab === 'CASHIERS'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Cashier Performance</span>
        </button>

        <button
          onClick={() => setActiveTab('VELOCITY')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
            activeTab === 'VELOCITY'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Fast vs Slow Moving (EXP-006)</span>
        </button>
      </div>

      {/* Tab 1: Item Sales Table */}
      {activeTab === 'ITEMS' && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4">Medicine Name</th>
                  <th className="py-2.5 px-3 text-center">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">GST Collected</th>
                  <th className="py-2.5 px-4 text-right">Net Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!salesReport?.itemSales?.length ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      No item sales in selected window.
                    </td>
                  </tr>
                ) : (
                  salesReport.itemSales.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {item.productName}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {item.unitsSold} units
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                        {formatPaiseToINR(item.taxPaise)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-black text-slate-900 text-sm">
                        {formatPaiseToINR(item.revenuePaise)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Cashier Table */}
      {activeTab === 'CASHIERS' && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4">Cashier / Staff Member</th>
                  <th className="py-2.5 px-3 text-center">Bills Finalized</th>
                  <th className="py-2.5 px-4 text-right">Total Billing Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!salesReport?.cashierPerformance?.length ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400">
                      No cashier activity in selected window.
                    </td>
                  </tr>
                ) : (
                  salesReport.cashierPerformance.map((c: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {c.cashierName}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-teal-700">
                        {c.billCount} bills
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-black text-slate-900 text-sm">
                        {formatPaiseToINR(c.totalSalesPaise)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Velocity Analysis (EXP-006) */}
      {activeTab === 'VELOCITY' && (
        <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
          {/* Fast Moving */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2 text-xs font-bold text-emerald-900">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Fast-Moving Medicines (High Velocity Demand)</span>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {!velocityReport?.fastMoving?.length ? (
                <div className="p-8 text-center text-xs text-slate-400">No fast-moving items detected.</div>
              ) : (
                velocityReport.fastMoving.map((p: any, idx: number) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{p.brandName}</div>
                      <div className="text-[11px] text-slate-400">{p.genericName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-700">{p.unitsSold} units dispensed</div>
                      <div className="text-[10px] text-slate-400 font-semibold">{p.currentStock} in stock</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Slow Moving */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs font-bold text-amber-900">
              <TrendingDown className="w-4 h-4 text-amber-600" />
              <span>Slow-Moving Medicines (Clearance Candidate - EXP-007)</span>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {!velocityReport?.slowMoving?.length ? (
                <div className="p-8 text-center text-xs text-slate-400">No slow-moving items detected.</div>
              ) : (
                velocityReport.slowMoving.map((p: any, idx: number) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">{p.brandName}</div>
                      <div className="text-[11px] text-slate-400">{p.genericName}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-amber-700">{p.currentStock} idle units</div>
                      <div className="text-[10px] text-slate-400 font-mono">Expiry: {p.nearestExpiry || '—'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
