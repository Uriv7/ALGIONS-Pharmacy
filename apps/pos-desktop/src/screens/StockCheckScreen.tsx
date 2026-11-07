import React, { useState, useEffect } from 'react';
import {
  Boxes,
  AlertTriangle,
  Filter,
  Search,
  ClipboardList,
  TrendingDown,
  RefreshCw,
  CheckCircle,
  Truck,
  Plus,
  ArrowRight,
  ShieldCheck,
  Printer,
  Barcode as BarcodeIcon,
} from 'lucide-react';
import { api } from '../api/client.js';
import { formatPaiseToINR, isBatchNearExpiry, isBatchExpired } from '@algions/domain';
import { AuthSessionUser } from '@algions/contracts';
import { BarcodeLabelPrintDialog } from '../components/dialogs/BarcodeLabelPrintDialog.js';

interface StockCheckScreenProps {
  user?: AuthSessionUser;
}

export const StockCheckScreen: React.FC<StockCheckScreenProps> = ({ user }) => {
  const isOwner = user?.accountType === 'OWNER';
  const [activeTab, setActiveTab] = useState<'BATCHES' | 'AUDIT' | 'REORDER'>('BATCHES');
  const [batches, setBatches] = useState<any[]>([]);
  const [reorderItems, setReorderItems] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'NEAR_EXPIRY' | 'EXPIRED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [barcodePrintProduct, setBarcodePrintProduct] = useState<any | null>(null);

  // Stock Audit State (INV-010)
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
  const [auditRackFilter, setAuditRackFilter] = useState('ALL');
  const [finalizingAudit, setFinalizingAudit] = useState(false);
  const [auditSuccessMsg, setAuditSuccessMsg] = useState<string | null>(null);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const [bRes, rRes] = await Promise.all([
        api.getBatches(),
        api.getReorderItems().catch(() => ({ reorderItems: [] })),
      ]);
      setBatches(bRes.batches || []);
      setReorderItems(rRes.reorderItems || []);

      // Initialize audit counts with current system stock
      const initial: Record<string, number> = {};
      (bRes.batches || []).forEach((b: any) => {
        initial[b.id] = b.quantity;
      });
      setAuditCounts(initial);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  const handleAuditCountChange = (batchId: string, count: number) => {
    setAuditCounts((prev) => ({
      ...prev,
      [batchId]: Math.max(0, count),
    }));
  };

  const handleFinalizeAudit = async () => {
    const adjustments: { batchId: string; physicalCount: number; reason: string }[] = [];
    batches.forEach((b) => {
      const counted = auditCounts[b.id];
      if (counted !== undefined && counted !== b.quantity) {
        adjustments.push({
          batchId: b.id,
          physicalCount: counted,
          reason: `Physical count audit discrepancy (Counted: ${counted}, System: ${b.quantity})`,
        });
      }
    });

    if (adjustments.length === 0) {
      alert('No discrepancies between counted stock and system stock.');
      return;
    }

    if (!window.confirm(`Finalize audit and post ${adjustments.length} batch stock adjustments to the immutable ledger?`)) {
      return;
    }

    setFinalizingAudit(true);
    setAuditSuccessMsg(null);
    try {
      const res = await api.finalizeStockAudit({ adjustments });
      setAuditSuccessMsg(res.message || 'Audit finalized successfully.');
      await fetchStockData();
    } catch (err: any) {
      alert(`Error finalizing audit: ${err.message}`);
    } finally {
      setFinalizingAudit(false);
    }
  };

  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      b.brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.rackLocation || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === 'NEAR_EXPIRY') return b.isNearExpiry;
    if (filterMode === 'EXPIRED') return b.isExpired;
    return true;
  });

  const uniqueRacks = Array.from(new Set(batches.map((b) => b.rackLocation || 'Shelf'))).filter(Boolean);

  const auditBatches = batches.filter((b) => {
    if (auditRackFilter === 'ALL') return true;
    return (b.rackLocation || 'Shelf') === auditRackFilter;
  });

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-6 bg-slate-100 overflow-y-auto lg:overflow-hidden select-none">
      {/* Top Header & Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-teal-600" />
            <span>Batch Inventory & Stock Control (I1 / INV-010 / INV-011)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Derived balance from immutable stock ledger • Physical count audit • Reorder level alerts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tabs */}
          <div className="bg-white border border-slate-200 rounded-lg p-0.5 flex flex-wrap gap-1">
            <button
              onClick={() => setActiveTab('BATCHES')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'BATCHES'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Live Batches ({batches.length})</span>
            </button>

            {isOwner && (
              <button
                onClick={() => setActiveTab('AUDIT')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'AUDIT'
                    ? 'bg-teal-600 text-white shadow'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Physical Audit (Owner)</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('REORDER')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'REORDER'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
              <span>Reorder Indents ({reorderItems.length})</span>
            </button>
          </div>

          <button
            onClick={fetchStockData}
            className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE BATCHES */}
      {activeTab === 'BATCHES' && (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* Sub Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by medicine, batch, or rack..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="flex flex-wrap bg-slate-200 p-1 rounded-lg text-xs font-semibold text-slate-600 gap-1">
              <button
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1 rounded-md transition ${
                  filterMode === 'ALL' ? 'bg-white text-slate-800 shadow' : 'hover:text-slate-900'
                }`}
              >
                All Batches
              </button>
              <button
                onClick={() => setFilterMode('NEAR_EXPIRY')}
                className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                  filterMode === 'NEAR_EXPIRY'
                    ? 'bg-amber-500 text-white shadow'
                    : 'text-amber-700 hover:text-amber-800'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Near Expiry (≤90d)</span>
              </button>
              <button
                onClick={() => setFilterMode('EXPIRED')}
                className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                  filterMode === 'EXPIRED'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-red-600 hover:text-red-700'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Expired</span>
              </button>
            </div>
          </div>

          {/* Batches Table */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full min-w-[760px] text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Medicine Name</th>
                    <th className="py-2.5 px-3">Salt Composition</th>
                    <th className="py-2.5 px-3">Batch Number</th>
                    <th className="py-2.5 px-3">Rack Location</th>
                    <th className="py-2.5 px-3">Expiry Date</th>
                    <th className="py-2.5 px-3 text-right">MRP</th>
                    <th className="py-2.5 px-3 text-right">Sale Rate</th>
                    <th className="py-2.5 px-4 text-center">Available Stock</th>
                    <th className="py-2.5 px-3 text-center">Barcode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        Loading stock records...
                      </td>
                    </tr>
                  ) : filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No batches match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          {b.brandName} <span className="font-normal text-slate-500">({b.strength})</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 italic">{b.genericName}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{b.batchNumber}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                            {b.rackLocation || 'Shelf'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {b.isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700">
                              <AlertTriangle className="w-3.5 h-3.5" /> Expired: {b.expiryDate}
                            </span>
                          ) : b.isNearExpiry ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                              <AlertTriangle className="w-3.5 h-3.5" /> Exp: {b.expiryDate} ({b.daysUntilExpiry}d)
                            </span>
                          ) : (
                            <span className="text-slate-700 font-medium">{b.expiryDate}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
                          {formatPaiseToINR(b.mrpPaise)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-800">
                          {formatPaiseToINR(b.saleRatePaise)}
                        </td>
                        <td className="py-2.5 px-4 text-center font-black text-emerald-700 text-sm">
                          {b.quantity} loose
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setBarcodePrintProduct(b)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-500 transition"
                            title="Print Barcode & Shelf Label"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PHYSICAL STOCK AUDIT & VARIANCE POSTING (INV-010) */}
      {activeTab === 'AUDIT' && (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-teal-600" />
                <span>Physical Stock Count & Variance Reconciliation (INV-010)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Count items on shelf. Discrepancies post atomic adjustment movements with audit tracking.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <span>Rack Filter:</span>
                <select
                  value={auditRackFilter}
                  onChange={(e) => setAuditRackFilter(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-800"
                >
                  <option value="ALL">All Racks</option>
                  {uniqueRacks.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleFinalizeAudit}
                disabled={finalizingAudit}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{finalizingAudit ? 'Finalizing...' : 'Finalize Audit & Post Discrepancies'}</span>
              </button>
            </div>
          </div>

          {auditSuccessMsg && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{auditSuccessMsg}</span>
            </div>
          )}

          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full min-w-[700px] text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Rack</th>
                  <th className="py-2.5 px-3">Medicine & Strength</th>
                  <th className="py-2.5 px-3">Batch Number</th>
                  <th className="py-2.5 px-3">Expiry</th>
                  <th className="py-2.5 px-3 text-center">System Stock</th>
                  <th className="py-2.5 px-3 text-center">Physical Count</th>
                  <th className="py-2.5 px-4 text-center">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {auditBatches.map((b) => {
                  const counted = auditCounts[b.id] ?? b.quantity;
                  const variance = counted - b.quantity;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-600">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">
                          {b.rackLocation || 'Shelf'}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900">{b.brandName}</div>
                        <div className="text-[10px] text-slate-500">{b.genericName} • {b.strength}</div>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-700">
                        {b.batchNumber}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                        {b.expiryDate}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-700">
                        {b.quantity}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={counted}
                          onChange={(e) => handleAuditCountChange(b.id, parseInt(e.target.value || '0', 10))}
                          className="w-20 px-2 py-1 text-center font-bold bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </td>
                      <td className="py-2 px-4 text-center font-bold text-xs">
                        {variance === 0 ? (
                          <span className="text-slate-400">0 (Match)</span>
                        ) : variance > 0 ? (
                          <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-black">
                            +{variance} (Excess)
                          </span>
                        ) : (
                          <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded font-black">
                            {variance} (Shortage)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LOW-STOCK & REORDER INDENT (INV-011) */}
      {activeTab === 'REORDER' && (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-amber-600" />
                <span>Low-Stock & Reorder Indent Suggestions (INV-011)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Medicines at or below configured reorder threshold. Based on minimum floor quantities and sales velocity.
              </p>
            </div>

            <div className="text-xs font-semibold text-slate-600">
              {reorderItems.length} formulations require reordering
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full min-w-[700px] text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10 text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Medicine Name</th>
                  <th className="py-2.5 px-3">Manufacturer</th>
                  <th className="py-2.5 px-3 text-center">Rack</th>
                  <th className="py-2.5 px-3 text-center">Current Stock</th>
                  <th className="py-2.5 px-3 text-center">Reorder Level</th>
                  <th className="py-2.5 px-3 text-center">Shortage Units</th>
                  <th className="py-2.5 px-4 text-right">Suggested Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reorderItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      All inventory formulations are well above reorder thresholds.
                    </td>
                  </tr>
                ) : (
                  reorderItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-amber-50/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.brandName}</div>
                        <div className="text-[10px] text-slate-500">{item.genericName} • {item.strength}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {item.manufacturer}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium text-[10px]">
                          {item.rackLocation || 'Shelf'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-red-600">
                        {item.currentStock} loose
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-700">
                        {item.reorderLevel} units
                      </td>
                      <td className="py-3 px-3 text-center font-black text-amber-700">
                        {item.shortageUnits} units
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-teal-800">
                        {item.suggestedPacks} {item.packUnitLabel}s ({item.suggestedOrderUnits} units)
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Barcode & Shelf Label Print Dialog */}
      {barcodePrintProduct && (
        <BarcodeLabelPrintDialog
          product={{
            brandName: barcodePrintProduct.brandName,
            genericName: barcodePrintProduct.genericName,
            strength: barcodePrintProduct.strength,
            barcode: barcodePrintProduct.barcode || '8901031045022',
            mrpPaise: barcodePrintProduct.mrpPaise,
            batchNumber: barcodePrintProduct.batchNumber,
            expiryDate: barcodePrintProduct.expiryDate,
            rackLocation: barcodePrintProduct.rackLocation,
          }}
          onClose={() => setBarcodePrintProduct(null)}
        />
      )}
    </div>
  );
};
