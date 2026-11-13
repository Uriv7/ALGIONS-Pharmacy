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
  Edit2,
  Lock,
  AlertOctagon,
  Phone,
  Users,
  ShieldAlert,
  X,
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
  const [filterMode, setFilterMode] = useState<'ALL' | 'NEAR_EXPIRY' | 'EXPIRED' | 'RECALLED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [barcodePrintProduct, setBarcodePrintProduct] = useState<any | null>(null);

  // Batch Recall & Patient Trace State (INV-012)
  const [recallingBatch, setRecallingBatch] = useState<any | null>(null);
  const [recallImpact, setRecallImpact] = useState<any | null>(null);
  const [loadingRecallImpact, setLoadingRecallImpact] = useState(false);
  const [recallReasonInput, setRecallReasonInput] = useState('');
  const [submittingRecall, setSubmittingRecall] = useState(false);

  // Stock Audit State (INV-010)
  const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
  const [auditRackFilter, setAuditRackFilter] = useState('ALL');
  const [finalizingAudit, setFinalizingAudit] = useState(false);
  const [auditSuccessMsg, setAuditSuccessMsg] = useState<string | null>(null);

  // Edit Batch Modal State (INV-004 / INV-011)
  const [editingBatch, setEditingBatch] = useState<any | null>(null);
  const [editRackLocation, setEditRackLocation] = useState('');
  const [editSaleRateRupees, setEditSaleRateRupees] = useState('');
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchActionMsg, setBatchActionMsg] = useState<string | null>(null);

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;
    setSavingBatch(true);
    try {
      const payload: { rackLocation?: string; saleRatePaise?: number } = {
        rackLocation: editRackLocation.trim() || undefined,
      };

      if (isOwner && editSaleRateRupees) {
        const paise = Math.round(parseFloat(editSaleRateRupees) * 100);
        if (paise > editingBatch.mrpPaise) {
          alert(`Selling price cannot exceed printed MRP of ₹${(editingBatch.mrpPaise / 100).toFixed(2)}.`);
          setSavingBatch(false);
          return;
        }
        payload.saleRatePaise = paise;
      }

      await api.updateBatch(editingBatch.id, payload);
      setBatchActionMsg(`Batch ${editingBatch.batchNumber} updated successfully.`);
      setEditingBatch(null);
      await fetchStockData();
    } catch (err: any) {
      alert(err.message || 'Error updating batch');
    } finally {
      setSavingBatch(false);
    }
  };

  const handleOpenRecallModal = async (batch: any) => {
    setRecallingBatch(batch);
    setRecallReasonInput(batch.recallReason || '');
    setLoadingRecallImpact(true);
    try {
      const res = await api.getBatchRecallImpact(batch.id);
      setRecallImpact(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingRecallImpact(false);
    }
  };

  const handleRecallBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recallingBatch || !recallReasonInput.trim()) return;
    setSubmittingRecall(true);
    try {
      await api.recallBatch(recallingBatch.id, recallReasonInput.trim());
      setBatchActionMsg(`Batch ${recallingBatch.batchNumber} has been marked RECALLED. Sales are blocked.`);
      await fetchStockData();
      const res = await api.getBatchRecallImpact(recallingBatch.id);
      setRecallImpact(res);
      setRecallingBatch((prev: any) => ({ ...prev, isRecalled: true, recallReason: recallReasonInput.trim() }));
    } catch (err: any) {
      alert(err.message || 'Error recalling batch');
    } finally {
      setSubmittingRecall(false);
    }
  };

  const handleUnrecallBatch = async () => {
    if (!recallingBatch) return;
    if (!window.confirm(`Revoke recall on batch ${recallingBatch.batchNumber} and restore sales?`)) return;
    setSubmittingRecall(true);
    try {
      await api.unrecallBatch(recallingBatch.id);
      setBatchActionMsg(`Recall restriction revoked on batch ${recallingBatch.batchNumber}.`);
      await fetchStockData();
      const res = await api.getBatchRecallImpact(recallingBatch.id);
      setRecallImpact(res);
      setRecallingBatch((prev: any) => ({ ...prev, isRecalled: false, recallReason: null }));
    } catch (err: any) {
      alert(err.message || 'Error clearing recall');
    } finally {
      setSubmittingRecall(false);
    }
  };

  const handleExportRecallTrace = () => {
    if (!recallImpact?.impactedInvoices?.length) {
      alert('No sold invoices found for this batch.');
      return;
    }
    const headers = ['Invoice Number', 'Dispensed Date', 'Customer Name', 'Customer Phone', 'Units Dispensed', 'Cashier'];
    const rows = recallImpact.impactedInvoices.map((inv: any) => [
      `"${inv.invoiceNumber}"`,
      `"${inv.dispensedAt}"`,
      `"${inv.customerName}"`,
      `"${inv.customerPhone}"`,
      inv.unitsSold,
      `"${inv.cashierName}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Batch_Recall_Trace_${recallingBatch?.batchNumber}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    if (filterMode === 'RECALLED') return b.isRecalled;
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

      {/* Alerts */}
      {batchActionMsg && (
        <div className="mb-3 p-3 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-lg font-semibold flex items-center justify-between">
          <span>{batchActionMsg}</span>
          <button onClick={() => setBatchActionMsg(null)} className="text-teal-600 hover:text-teal-900 font-bold">
            Dismiss
          </button>
        </div>
      )}

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
              <button
                onClick={() => setFilterMode('RECALLED')}
                className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                  filterMode === 'RECALLED'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-purple-700 hover:text-purple-800'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Recalled Batches</span>
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
                    <th className="py-2.5 px-3 text-center">Actions</th>
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
                          {b.isRecalled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-700 text-white shadow-xs">
                              <AlertOctagon className="w-3.5 h-3.5" /> RECALLED
                            </span>
                          ) : b.isExpired ? (
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
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingBatch(b);
                                setEditRackLocation(b.rackLocation || '');
                                setEditSaleRateRupees((b.saleRatePaise / 100).toFixed(2));
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-500 transition"
                              title="Edit Shelf Location & Price (INV-004)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenRecallModal(b)}
                              className={`p-1.5 rounded-lg transition ${
                                b.isRecalled
                                  ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                  : 'bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-500'
                              }`}
                              title="Batch Recall & Customer Impact Trace (INV-012)"
                            >
                              <AlertOctagon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setBarcodePrintProduct(b)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-500 transition"
                              title="Print Barcode & Shelf Label"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
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

      {/* Edit Batch Location & Pricing Modal (INV-004 / INV-011) */}
      {editingBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200">
            <h2 className="text-base font-bold text-slate-800 mb-1">Edit Shelf Location & Pricing</h2>
            <p className="text-xs text-slate-500 mb-4">
              {editingBatch.brandName} • Batch <span className="font-mono font-bold text-slate-700">{editingBatch.batchNumber}</span>
            </p>

            <form onSubmit={handleSaveBatch} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Printed MRP</span>
                  <span className="font-bold text-slate-700">{formatPaiseToINR(editingBatch.mrpPaise)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Available Units</span>
                  <span className="font-bold text-emerald-700">{editingBatch.quantity} loose</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Shelf / Rack Location (INV-004)
                </label>
                <input
                  type="text"
                  value={editRackLocation}
                  onChange={(e) => setEditRackLocation(e.target.value)}
                  placeholder="e.g. Rack A-02, Shelf 3, Cold Storage"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Shelf position guides billing retrieval and physical cycle counts.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    Selling Price (₹ per unit)
                    {!isOwner && <Lock className="w-3 h-3 text-slate-400" />}
                  </label>
                  {!isOwner ? (
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Owner Only
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      Ceiling: ₹{(editingBatch.mrpPaise / 100).toFixed(2)}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(editingBatch.mrpPaise / 100).toFixed(2)}
                  value={editSaleRateRupees}
                  disabled={!isOwner}
                  onChange={(e) => setEditSaleRateRupees(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-xs font-bold ${
                    !isOwner
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600'
                  }`}
                  required
                />
                {!isOwner && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Staff members cannot alter retail selling rates. Owner login required.
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBatch(null)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBatch}
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow transition"
                >
                  {savingBatch ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BATCH RECALL & PATIENT TRACING (INV-012) */}
      {recallingBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-purple-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">
                  Batch Recall Management & Customer Trace (INV-012)
                </h3>
              </div>
              <button
                onClick={() => {
                  setRecallingBatch(null);
                  setRecallImpact(null);
                }}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Batch Info Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Medicine</span>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">{recallingBatch.brandName}</div>
                  <div className="text-[11px] text-slate-500">{recallingBatch.strength}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Batch Number</span>
                  <div className="font-mono font-bold text-purple-800 text-sm mt-0.5">{recallingBatch.batchNumber}</div>
                  <div className="text-[11px] text-slate-500">Exp: {recallingBatch.expiryDate}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Remaining Stock</span>
                  <div className="font-black text-slate-900 text-sm mt-0.5">{recallingBatch.quantity} loose units</div>
                  <div className="text-[11px] text-slate-500">Rack: {recallingBatch.rackLocation || 'Shelf'}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Recall Status</span>
                  <div className="mt-0.5">
                    {recallingBatch.isRecalled ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-700 text-white flex items-center gap-1 w-max">
                        <AlertOctagon className="w-3 h-3" /> RECALLED (SALE BLOCKED)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        ACTIVE / SELLABLE
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Recall Action Form / Status */}
              {recallingBatch.isRecalled ? (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                      <ShieldAlert className="w-4 h-4 text-purple-700" />
                      <span>Active Recall Notice</span>
                    </span>
                    <p className="text-purple-800 mt-1 font-semibold">{recallingBatch.recallReason || 'Safety alert issued.'}</p>
                    <p className="text-[10px] text-purple-600 mt-0.5">Dispensing this batch in POS checkout is strictly rejected with 400 BATCH_RECALLED.</p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={handleUnrecallBatch}
                      disabled={submittingRecall}
                      className="px-4 py-2 bg-white border border-purple-300 hover:bg-purple-100 text-purple-800 rounded-lg font-bold text-xs shadow-xs transition"
                    >
                      {submittingRecall ? 'Revoking...' : 'Revoke Recall (Restore Sales)'}
                    </button>
                  )}
                </div>
              ) : isOwner ? (
                <form onSubmit={handleRecallBatch} className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Issue Regulatory / Quality Batch Recall</span>
                  </div>
                  <p className="text-amber-800 text-[11px]">
                    Marking this batch recalled will immediately prevent any counter from dispensing this batch.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={recallReasonInput}
                      onChange={(e) => setRecallReasonInput(e.target.value)}
                      placeholder="Mandatory recall reason (e.g., CDSCO Quality Alert / Lab Sub-standard Notice)..."
                      className="flex-1 py-1.5 px-3 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
                      required
                    />
                    <button
                      type="submit"
                      disabled={submittingRecall || !recallReasonInput.trim()}
                      className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold text-xs shadow transition disabled:opacity-50"
                    >
                      {submittingRecall ? 'Marking...' : 'Mark Recalled & Block Sales'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs">
                  Only Store Owners can issue or revoke official batch recall restrictions.
                </div>
              )}

              {/* Customer Trace & Impact Report */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-purple-700" />
                      <span>Dispensed Customer Recall Trace (Mandatory Patient Outreach)</span>
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {recallImpact
                        ? `${recallImpact.totalUnitsSold} units dispensed across ${recallImpact.totalImpactedInvoices} invoices`
                        : 'Querying patient trace...'}
                    </p>
                  </div>

                  <button
                    onClick={handleExportRecallTrace}
                    disabled={!recallImpact?.impactedInvoices?.length}
                    className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded text-xs flex items-center gap-1 shadow-xs disabled:opacity-50"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Export Patient Contact List</span>
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Invoice #</th>
                        <th className="py-2 px-3">Dispensed Date</th>
                        <th className="py-2 px-3">Customer Name</th>
                        <th className="py-2 px-3">Contact Phone</th>
                        <th className="py-2 px-2 text-center">Units Sold</th>
                        <th className="py-2 px-3">Cashier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loadingRecallImpact ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Loading customer trace records...
                          </td>
                        </tr>
                      ) : !recallImpact?.impactedInvoices?.length ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Zero units have been dispensed from this batch. No customer outreach required.
                          </td>
                        </tr>
                      ) : (
                        recallImpact.impactedInvoices.map((inv: any, idx: number) => (
                          <tr key={idx} className="hover:bg-purple-50/50">
                            <td className="py-2 px-3 font-mono font-bold text-purple-800">{inv.invoiceNumber}</td>
                            <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                              {inv.dispensedAt.slice(0, 16).replace('T', ' ')}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{inv.customerName}</td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-700 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-teal-600" />
                              <span>{inv.customerPhone}</span>
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-purple-700">{inv.unitsSold}</td>
                            <td className="py-2 px-3 text-slate-500">{inv.cashierName}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => {
                  setRecallingBatch(null);
                  setRecallImpact(null);
                }}
                className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
