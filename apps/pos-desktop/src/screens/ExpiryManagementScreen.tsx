import React, { useState, useEffect } from 'react';
import {
  Calendar,
  AlertTriangle,
  Trash2,
  Filter,
  CheckCircle,
  RefreshCw,
  Boxes,
  ShieldAlert,
  Sparkles,
  Percent,
  TrendingDown,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';
import { api } from '../api/client.js';
import { AuthSessionUser } from '@algions/contracts';

interface ExpiryManagementScreenProps {
  user: AuthSessionUser;
}

export const ExpiryManagementScreen: React.FC<ExpiryManagementScreenProps> = ({ user }) => {
  const [thresholdDays, setThresholdDays] = useState<number>(90);
  const [data, setData] = useState<{ expired: any[]; nearExpiry: any[]; expiredCount: number; nearExpiryCount: number } | null>(null);
  const [clearanceData, setClearanceData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'NEAR_EXPIRY' | 'EXPIRED' | 'CLEARANCE_STRATEGIES'>('NEAR_EXPIRY');

  // Adjustment Modal
  const [adjustBatch, setAdjustBatch] = useState<any | null>(null);
  const [adjustmentType, setAdjustmentType] = useState('ADJUSTMENT_WRITE_OFF');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchExpiryData = async () => {
    setLoading(true);
    try {
      const [expRes, clRes] = await Promise.all([
        api.getExpiryList(thresholdDays),
        api.getExpiryClearanceHints(),
      ]);
      setData(expRes);
      setClearanceData(clRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiryData();
  }, [thresholdDays]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustBatch) return;
    setSubmittingAdjust(true);
    try {
      const qty = parseInt(adjustQty, 10);
      await api.createStockAdjustment({
        batchId: adjustBatch.id,
        adjustmentType,
        deltaQuantity: -Math.abs(qty), // reduction
        reason: adjustReason || 'Expired / Damaged batch write-off',
      });
      setAdjustBatch(null);
      setAdjustQty('');
      setAdjustReason('');
      setMsg(`Stock adjustment of ${qty} units posted to immutable ledger.`);
      fetchExpiryData();
    } catch (err: any) {
      alert(err.message || 'Stock adjustment failed');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const listToShow = activeTab === 'NEAR_EXPIRY' ? data?.nearExpiry || [] : data?.expired || [];

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-6 bg-slate-100 overflow-y-auto lg:overflow-hidden select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            <span>Expiry Control & Clearance (EXP-001 / EXP-003)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            FEFO inventory protection • Expiry clearance prioritization • Damaged batch write-off
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Threshold Switcher */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <button
              onClick={() => setThresholdDays(30)}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                thresholdDays === 30 ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              &lt; 30 Days
            </button>
            <button
              onClick={() => setThresholdDays(60)}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                thresholdDays === 60 ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              &lt; 60 Days
            </button>
            <button
              onClick={() => setThresholdDays(90)}
              className={`px-2.5 py-1 rounded font-semibold transition ${
                thresholdDays === 90 ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              &lt; 90 Days
            </button>
          </div>

          <button
            onClick={fetchExpiryData}
            className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-lg font-semibold flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-teal-600 hover:text-teal-900 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Selectors */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => setActiveTab('NEAR_EXPIRY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === 'NEAR_EXPIRY'
              ? 'bg-amber-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Near-Expiry ({data?.nearExpiryCount || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('EXPIRED')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === 'EXPIRED'
              ? 'bg-red-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Expired Batches ({data?.expiredCount || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('CLEARANCE_STRATEGIES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === 'CLEARANCE_STRATEGIES'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Clearance Strategies (EXP-007)</span>
        </button>
      </div>

      {activeTab === 'CLEARANCE_STRATEGIES' ? (
        /* Clearance Strategies & Discount Hints (EXP-007) */
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {clearanceData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Batches Approaching Expiry
                </span>
                <div className="text-xl font-black text-amber-600 mt-1">
                  {clearanceData.totalBatchesAtRisk} Batches
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Expiring in next 90 days requiring liquidation
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Capital at Risk (Acquisition Cost)
                </span>
                <div className="text-xl font-black text-slate-900 mt-1">
                  {clearanceData.totalCapitalAtRiskPaise !== undefined
                    ? formatPaiseToINR(clearanceData.totalCapitalAtRiskPaise)
                    : 'Confidential'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Batch acquisition valuation to protect
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total MRP Retail Value
                </span>
                <div className="text-xl font-black text-teal-600 mt-1">
                  {formatPaiseToINR(clearanceData.totalMrvAtRiskPaise || 0)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Gross sales potential if cleared on time
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full min-w-[760px] text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Medicine & Form</th>
                    <th className="py-2.5 px-3">Batch & Expiry</th>
                    <th className="py-2.5 px-3 text-center">Remaining</th>
                    <th className="py-2.5 px-3 text-center">Urgency</th>
                    <th className="py-2.5 px-3">Clearance Action Hint</th>
                    <th className="py-2.5 px-3">Operational Strategy</th>
                    <th className="py-2.5 px-3 text-right">Stock (MRP)</th>
                    <th className="py-2.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!clearanceData?.suggestions?.length ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <div className="text-xs font-bold text-slate-700">No clearance actions required</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          No batches are nearing expiry in the 90-day window.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    clearanceData.suggestions.map((s: any) => (
                      <tr key={s.batchId} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-slate-900">{s.brandName} {s.strength}</div>
                          <div className="text-[10px] text-slate-400">{s.genericName} • {s.dosageForm}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <div className="font-semibold text-slate-800">{s.batchNumber}</div>
                          <div className="text-[10px] text-slate-500">{s.expiryDate}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {s.daysUntilExpiry <= 0 ? (
                            <span className="text-rose-600 font-black">EXPIRED</span>
                          ) : (
                            <span>{s.daysUntilExpiry} days</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.urgency === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : s.urgency === 'HIGH'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-blue-100 text-blue-800 border border-blue-300'
                            }`}
                          >
                            {s.urgency}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            {s.recommendedDiscountPercent > 0 && (
                              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[10px]">
                                {s.recommendedDiscountPercent}% OFF
                              </span>
                            )}
                            <span>{s.actionLabel}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-xs">
                          {s.strategy}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="font-bold text-slate-900">{s.quantity} units</div>
                          <div className="text-[10px] text-slate-500">{formatPaiseToINR(s.totalMrpValuePaise)}</div>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {user.accountType === 'OWNER' && (
                            <button
                              onClick={() => {
                                setAdjustBatch({
                                  id: s.batchId,
                                  brandName: s.brandName,
                                  batchNumber: s.batchNumber,
                                  quantity: s.quantity,
                                  mrpPaise: s.mrpPaise,
                                });
                                setAdjustQty(s.quantity.toString());
                                setAdjustReason(`Clearance write-off / supplier return (${s.actionLabel})`);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 rounded text-[11px] font-bold transition flex items-center gap-1 mx-auto"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Write-Off</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Batches Table */
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full min-w-[760px] text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4">Medicine Name</th>
                <th className="py-2.5 px-3">Batch No</th>
                <th className="py-2.5 px-3">Expiry Date</th>
                <th className="py-2.5 px-3 text-center">Days Remaining</th>
                <th className="py-2.5 px-3 text-center">Rack</th>
                <th className="py-2.5 px-3 text-right">Available Stock</th>
                <th className="py-2.5 px-3 text-right">Batch Value (MRP)</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Scanning expiry records...
                  </td>
                </tr>
              ) : listToShow.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <div className="text-xs font-bold text-slate-700">No Batches in this category</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Inventory is fresh and complies with safety thresholds.
                    </div>
                  </td>
                </tr>
              ) : (
                listToShow.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {b.brandName}
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                      {b.batchNumber}
                    </td>
                    <td className="py-3 px-3 font-bold font-mono text-slate-900">
                      {b.expiryDate}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.daysUntilExpiry <= 0
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : b.daysUntilExpiry <= 30
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-yellow-50 text-yellow-800'
                        }`}
                      >
                        {b.daysUntilExpiry <= 0 ? 'EXPIRED' : `${b.daysUntilExpiry} days`}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-600">
                      {b.rackLocation || '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-black tabular-nums text-slate-800">
                      {b.quantity} units
                    </td>
                    <td className="py-3 px-3 text-right font-bold tabular-nums text-slate-900">
                      {formatPaiseToINR(b.quantity * b.mrpPaise)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {user.accountType === 'OWNER' && (
                        <button
                          onClick={() => {
                            setAdjustBatch(b);
                            setAdjustQty(b.quantity.toString());
                            setAdjustReason(b.daysUntilExpiry <= 0 ? 'Expired stock write-off' : 'Near-expiry damaged disposal');
                          }}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[11px] font-bold transition flex items-center justify-center gap-1 mx-auto"
                          title="Write off expired or damaged batch (Owner step-up)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Write-Off</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Modal: Write-off / Adjust Stock */}
      {adjustBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200">
            <div className="flex items-center gap-2 text-red-800 font-bold text-base mb-1">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <span>Stock Write-Off & Adjustment (INV-007)</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Step-up authorized write-off for <strong>{adjustBatch.brandName}</strong> (Batch: {adjustBatch.batchNumber}).
            </p>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjustment Type
                </label>
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                >
                  <option value="ADJUSTMENT_WRITE_OFF">Expired Stock Write-Off</option>
                  <option value="ADJUSTMENT_DAMAGE">Damaged / Broken in Transit</option>
                  <option value="ADJUSTMENT_CORRECTION">Physical Count Discrepancy Correction</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity to Write Off (Units)
                </label>
                <input
                  type="number"
                  min="1"
                  max={adjustBatch.quantity}
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Audit Reason
                </label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustBatch(null)}
                  className="flex-1 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow"
                >
                  {submittingAdjust ? 'Processing...' : 'Authorize & Write-Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
