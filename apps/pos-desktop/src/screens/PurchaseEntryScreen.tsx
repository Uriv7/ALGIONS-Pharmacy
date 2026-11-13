import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  User,
  FileText,
  Search,
  RefreshCw,
  Truck,
  RotateCcw,
  Printer,
  X,
  ArrowRight,
} from 'lucide-react';
import { api } from '../api/client.js';
import { formatPaiseToINR, toPaise } from '@algions/domain';
import { AuthSessionUser } from '@algions/contracts';

interface PurchaseEntryScreenProps {
  user?: AuthSessionUser;
  onSuccess: () => void;
}

export const PurchaseEntryScreen: React.FC<PurchaseEntryScreenProps> = ({ user, onSuccess }) => {
  const isOwner = user?.accountType === 'OWNER';
  const [activeTab, setActiveTab] = useState<'NEW_ENTRY' | 'HISTORY' | 'RETURNS'>('NEW_ENTRY');

  // Purchase History State
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  // Suppliers & Products
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);

  // Line items for Inward Entry
  const [lines, setLines] = useState<any[]>([
    {
      productId: '',
      productName: '',
      batchNumber: '',
      expiryDate: '',
      quantityPacks: 10,
      freeQuantityPacks: 0,
      unitsPerPack: 10,
      purchaseRateRupees: '120.00',
      mrpRupees: '180.00',
      saleRateRupees: '180.00',
      taxRatePercent: 12,
      rackLocation: 'Rack A1',
    },
  ]);

  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Purchase Returns / Debit Notes State (PUR-006 / ACC-007)
  const [debitNotes, setDebitNotes] = useState<any[]>([]);
  const [loadingDebitNotes, setLoadingDebitNotes] = useState(false);
  const [debitNoteSearchTerm, setDebitNoteSearchTerm] = useState('');
  const [viewingDebitNote, setViewingDebitNote] = useState<any | null>(null);

  // Return Creation Form State
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnSupplierId, setReturnSupplierId] = useState('');
  const [returnReason, setReturnReason] = useState('Damaged goods return');
  const [returnCustomDocNumber, setReturnCustomDocNumber] = useState('');
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);
  const [returnLines, setReturnLines] = useState<any[]>([]);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.getPurchases();
      setPurchaseHistory(res.purchases || []);
    } catch {
      setPurchaseHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchDebitNotes = async () => {
    setLoadingDebitNotes(true);
    try {
      const res = await api.getPurchaseReturns();
      setDebitNotes(res.debitNotes || []);
    } catch {
      setDebitNotes([]);
    } finally {
      setLoadingDebitNotes(false);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await api.getBatches();
      setAvailableBatches(res.batches || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchHistory();
    } else if (activeTab === 'RETURNS') {
      fetchDebitNotes();
      fetchBatches();
    }
  }, [activeTab]);

  useEffect(() => {
    const init = async () => {
      try {
        const suppRes = await api.getSuppliers();
        setSuppliers(suppRes.suppliers || []);
        if (suppRes.suppliers?.length > 0) {
          setSelectedSupplierId(suppRes.suppliers[0].id);
          setReturnSupplierId(suppRes.suppliers[0].id);
        }

        const prodRes = await api.searchProducts('');
        setAvailableProducts(prodRes.results?.map((r) => r.product) || []);
        if (prodRes.results?.length > 0) {
          const firstP = prodRes.results[0].product;
          setLines((prev) => [
            {
              ...prev[0],
              productId: firstP.id,
              productName: firstP.brandName,
              unitsPerPack: firstP.unitsPerPack,
            },
          ]);
        }
      } catch (err) {
        console.error(err);
      }
    };
    init();
  }, []);

  const handleAddLine = () => {
    const firstP = availableProducts[0];
    setLines((prev) => [
      ...prev,
      {
        productId: firstP?.id || '',
        productName: firstP?.brandName || '',
        batchNumber: '',
        expiryDate: '',
        quantityPacks: 10,
        freeQuantityPacks: 0,
        unitsPerPack: firstP?.unitsPerPack || 10,
        purchaseRateRupees: '100.00',
        mrpRupees: '150.00',
        saleRateRupees: '150.00',
        taxRatePercent: 12,
        rackLocation: 'Rack A1',
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, value: any) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };

      if (field === 'productId') {
        const found = availableProducts.find((p) => p.id === value);
        if (found) {
          updated[idx].productName = found.brandName;
          updated[idx].unitsPerPack = found.unitsPerPack;
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !invoiceNumber.trim() || lines.length === 0) {
      setErrorMessage('Please fill all mandatory fields (Supplier, Invoice Number, and at least 1 item).');
      return;
    }

    // Validate future expiry
    const today = new Date().toISOString().slice(0, 10);
    for (const l of lines) {
      if (!l.batchNumber.trim() || !l.expiryDate) {
        setErrorMessage('All lines must have a valid Batch Number and Expiry Date.');
        return;
      }
      if (l.expiryDate <= today) {
        setErrorMessage(`Expiry date for batch ${l.batchNumber} must be in the future.`);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        supplierId: selectedSupplierId,
        supplierInvoiceNumber: invoiceNumber.trim(),
        supplierInvoiceDate: invoiceDate,
        paymentTermsDays,
        lines: lines.map((l) => ({
          productId: l.productId,
          batchNumber: l.batchNumber.trim().toUpperCase(),
          expiryDate: l.expiryDate,
          quantityPacks: parseInt(l.quantityPacks, 10) || 1,
          freeQuantityPacks: parseInt(l.freeQuantityPacks, 10) || 0,
          unitsPerPack: parseInt(l.unitsPerPack, 10) || 10,
          purchaseRatePaise: toPaise(l.purchaseRateRupees),
          mrpPaise: toPaise(l.mrpRupees),
          saleRatePaise: toPaise(l.saleRateRupees),
          taxRatePercent: parseFloat(l.taxRatePercent) || 12,
          rackLocation: l.rackLocation,
        })),
      };

      await api.createPurchase(payload);
      setSuccessMessage(`Purchase invoice #${invoiceNumber} posted successfully. Stock ledger updated!`);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create purchase entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Return Line Helpers
  const handleAddReturnLine = () => {
    if (availableBatches.length === 0) {
      alert('No available stock batches in inventory to return.');
      return;
    }
    const firstB = availableBatches[0];
    const unitRateRupees = (Number(firstB.purchaseRatePaise || firstB.saleRatePaise || 1000) / 100).toFixed(2);
    setReturnLines((prev) => [
      ...prev,
      {
        batchId: firstB.id,
        productId: firstB.productId,
        productName: firstB.brandName,
        batchNumber: firstB.batchNumber,
        availableStock: firstB.quantity,
        quantityUnits: 1,
        returnRateRupees: unitRateRupees,
        taxRatePercent: 12,
      },
    ]);
  };

  const handleReturnLineChange = (idx: number, field: string, value: any) => {
    setReturnLines((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };

      if (field === 'batchId') {
        const found = availableBatches.find((b) => b.id === value);
        if (found) {
          updated[idx].productId = found.productId;
          updated[idx].productName = found.brandName;
          updated[idx].batchNumber = found.batchNumber;
          updated[idx].availableStock = found.quantity;
          const rateRupees = (Number(found.purchaseRatePaise || found.saleRatePaise || 1000) / 100).toFixed(2);
          updated[idx].returnRateRupees = rateRupees;
        }
      }
      return updated;
    });
  };

  const handleRemoveReturnLine = (idx: number) => {
    setReturnLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnSupplierId || returnLines.length === 0) {
      alert('Please select a supplier and add at least one batch to return.');
      return;
    }

    for (const line of returnLines) {
      if (line.quantityUnits <= 0) {
        alert('Return quantity must be at least 1 unit.');
        return;
      }
      if (line.quantityUnits > line.availableStock) {
        alert(`Cannot return ${line.quantityUnits} units of batch ${line.batchNumber}. Available: ${line.availableStock}.`);
        return;
      }
    }

    setIsSubmittingReturn(true);
    try {
      const payload = {
        supplierId: returnSupplierId,
        reason: returnReason,
        debitNoteNumber: returnCustomDocNumber.trim() || undefined,
        lines: returnLines.map((l) => ({
          batchId: l.batchId,
          productId: l.productId,
          quantityUnits: Number(l.quantityUnits),
          returnRatePaise: Math.round(parseFloat(l.returnRateRupees) * 100),
          taxRatePercent: Number(l.taxRatePercent) || 12,
          reason: returnReason,
        })),
      };

      const res = await api.createPurchaseReturn(payload);
      alert(`Supplier Debit Note ${res.debitNoteNumber} issued successfully! Stock deducted and Accounts Payable reduced.`);
      setShowReturnForm(false);
      setReturnLines([]);
      await fetchDebitNotes();
      await fetchBatches();
    } catch (err: any) {
      alert(err.message || 'Failed to issue debit note');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const handleOpenDebitNoteVoucher = async (noteId: string) => {
    try {
      const res = await api.getPurchaseReturn(noteId);
      setViewingDebitNote(res.debitNote);
    } catch (err: any) {
      alert(err.message || 'Error fetching debit note');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-6 bg-slate-100 overflow-y-auto lg:overflow-hidden select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-teal-600" />
            <span>Procurement & Inward Goods (PUR-002 / PUR-006)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record supplier invoice, manage debit notes, and post stock movements atomically
          </p>
        </div>

        {isOwner ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span>Owner Mode: Direct Approval & AP Posting</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold">
            <User className="w-4 h-4 text-teal-600" />
            <span>Staff Entry: Queued for Owner Review ({user?.username || 'Staff'})</span>
          </div>
        )}
      </div>

      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('NEW_ENTRY')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
            activeTab === 'NEW_ENTRY'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Inward Goods Receipt</span>
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
            activeTab === 'HISTORY'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Inward Invoices Archive</span>
          {purchaseHistory.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {purchaseHistory.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('RETURNS')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
            activeTab === 'RETURNS'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Supplier Returns / Debit Notes (PUR-006 / ACC-007)</span>
          {debitNotes.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-700 font-bold">
              {debitNotes.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search invoice or distributor..."
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <button
              onClick={fetchHistory}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full min-w-[700px] text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4">Invoice No</th>
                  <th className="py-2.5 px-3">Distributor</th>
                  <th className="py-2.5 px-3">Invoice Date</th>
                  <th className="py-2.5 px-3 text-right">Gross Total</th>
                  <th className="py-2.5 px-3 text-right">Tax (GST)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-4">Entry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingHistory ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Loading inward invoices...
                    </td>
                  </tr>
                ) : purchaseHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No purchase invoices recorded yet.
                    </td>
                  </tr>
                ) : (
                  purchaseHistory
                    .filter((p) => {
                      const t = historySearchTerm.toLowerCase();
                      return (
                        (p.supplierInvoiceNumber || '').toLowerCase().includes(t) ||
                        (p.supplierName || '').toLowerCase().includes(t)
                      );
                    })
                    .map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-4 font-mono font-bold text-teal-800">
                          {p.supplierInvoiceNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {p.supplierName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {p.supplierInvoiceDate}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                          {formatPaiseToINR(p.totalAmountPaise)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-700 tabular-nums">
                          {formatPaiseToINR(p.totalTaxPaise)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {p.status || 'POSTED'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                          {(p.createdAt || '').slice(0, 16).replace('T', ' ')}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: NEW INWARD ENTRY FORM */}
      {activeTab === 'NEW_ENTRY' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Header details card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Distributor / Supplier <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.gstin || 'No GSTIN'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Supplier Invoice No <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-90214"
                className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Credit Terms</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={paymentTermsDays}
                  onChange={(e) => setPaymentTermsDays(parseInt(e.target.value, 10) || 0)}
                  className="w-20 py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <span className="text-slate-500 text-xs">Days</span>
              </div>
            </div>
          </div>

          {/* Lines Grid Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-xs">Purchased Medicines & Batches</h3>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center gap-1 px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-bold transition shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Medicine Line</span>
              </button>
            </div>

            <table className="w-full min-w-[760px] text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Medicine</th>
                  <th className="py-2 px-2 w-28">Batch No</th>
                  <th className="py-2 px-2 w-32">Expiry (YYYY-MM-DD)</th>
                  <th className="py-2 px-2 w-16 text-center">Qty (Pks)</th>
                  <th className="py-2 px-2 w-16 text-center">Free (Pks)</th>
                  <th className="py-2 px-2 w-20 text-right">Cost Rate (₹)</th>
                  <th className="py-2 px-2 w-20 text-right">MRP (₹)</th>
                  <th className="py-2 px-2 w-16 text-center">GST %</th>
                  <th className="py-2 px-2 w-24">Rack</th>
                  <th className="py-2 px-2 w-8 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <select
                        value={line.productId}
                        onChange={(e) => handleLineChange(idx, 'productId', e.target.value)}
                        className="w-full py-1 px-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
                      >
                        {availableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.brandName} ({p.strength})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        placeholder="BATCH-123"
                        value={line.batchNumber}
                        onChange={(e) => handleLineChange(idx, 'batchNumber', e.target.value)}
                        className="w-full py-1 px-1.5 bg-white border border-slate-300 rounded font-mono font-bold uppercase text-slate-800"
                        required
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="date"
                        value={line.expiryDate}
                        onChange={(e) => handleLineChange(idx, 'expiryDate', e.target.value)}
                        className="w-full py-1 px-1.5 bg-white border border-slate-300 rounded font-medium text-slate-800"
                        required
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={line.quantityPacks}
                        onChange={(e) => handleLineChange(idx, 'quantityPacks', e.target.value)}
                        className="w-14 text-center py-1 px-1 bg-white border border-slate-300 rounded font-bold"
                        required
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min={0}
                        value={line.freeQuantityPacks}
                        onChange={(e) => handleLineChange(idx, 'freeQuantityPacks', e.target.value)}
                        className="w-14 text-center py-1 px-1 bg-white border border-slate-300 rounded text-slate-600"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="text"
                        value={line.purchaseRateRupees}
                        onChange={(e) => handleLineChange(idx, 'purchaseRateRupees', e.target.value)}
                        className="w-16 text-right py-1 px-1 bg-white border border-slate-300 rounded font-bold text-slate-800"
                        required
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <input
                        type="text"
                        value={line.mrpRupees}
                        onChange={(e) => handleLineChange(idx, 'mrpRupees', e.target.value)}
                        className="w-16 text-right py-1 px-1 bg-white border border-slate-300 rounded font-bold text-slate-800"
                        required
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <select
                        value={line.taxRatePercent}
                        onChange={(e) => handleLineChange(idx, 'taxRatePercent', e.target.value)}
                        className="py-1 px-1 bg-white border border-slate-300 rounded"
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={line.rackLocation}
                        onChange={(e) => handleLineChange(idx, 'rackLocation', e.target.value)}
                        placeholder="Rack A1"
                        className="w-full py-1 px-1 bg-white border border-slate-300 rounded text-slate-700"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Submit Bar */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Posting Goods Receipt...'
                  : isOwner
                  ? 'Approve & Post Purchase Invoice (Stock + AP)'
                  : 'Submit Purchase Entry (Staff Queued)'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: SUPPLIER RETURNS & DEBIT NOTES (PUR-006 / ACC-007) */}
      {activeTab === 'RETURNS' && (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* Header Action Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search debit notes or supplier..."
                  value={debitNoteSearchTerm}
                  onChange={(e) => setDebitNoteSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>
              <button
                onClick={fetchDebitNotes}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition"
                title="Refresh Debit Notes"
              >
                <RefreshCw className={`w-4 h-4 ${loadingDebitNotes ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <button
              onClick={() => {
                setShowReturnForm(true);
                if (returnLines.length === 0) handleAddReturnLine();
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Issue Supplier Debit Note</span>
            </button>
          </div>

          {/* Debit Notes List */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full min-w-[720px] text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Debit Note #</th>
                    <th className="py-2.5 px-3">Supplier Name</th>
                    <th className="py-2.5 px-3">Return Reason</th>
                    <th className="py-2.5 px-2 text-center">Items</th>
                    <th className="py-2.5 px-3 text-right">Debit Amount</th>
                    <th className="py-2.5 px-3 text-right">GST Reversal</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Issued By</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingDebitNotes ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        Loading debit notes...
                      </td>
                    </tr>
                  ) : debitNotes.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No supplier debit notes issued yet.
                      </td>
                    </tr>
                  ) : (
                    debitNotes
                      .filter((dn) => {
                        const t = debitNoteSearchTerm.toLowerCase();
                        return (
                          (dn.debitNoteNumber || '').toLowerCase().includes(t) ||
                          (dn.supplierName || '').toLowerCase().includes(t) ||
                          (dn.reason || '').toLowerCase().includes(t)
                        );
                      })
                      .map((dn) => (
                        <tr key={dn.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-4 font-mono font-bold text-purple-800">
                            {dn.debitNoteNumber}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {dn.supplierName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs" title={dn.reason}>
                            {dn.reason}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-700">
                            {dn.lineCount || 1}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 tabular-nums">
                            {formatPaiseToINR(dn.totalAmountPaise)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-purple-700 tabular-nums">
                            {formatPaiseToINR(dn.totalTaxPaise)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              {dn.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-medium">
                            {dn.createdByName}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleOpenDebitNoteVoucher(dn.id)}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-purple-100 text-purple-700 font-bold transition flex items-center gap-1 mx-auto"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Voucher</span>
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

      {/* MODAL: CREATE DEBIT NOTE (PUR-006) */}
      {showReturnForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-purple-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                <h3 className="font-bold text-sm">Issue Supplier Return & Debit Note (PUR-006 / ACC-007)</h3>
              </div>
              <button onClick={() => setShowReturnForm(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Supplier *</label>
                  <select
                    value={returnSupplierId}
                    onChange={(e) => setReturnSupplierId(e.target.value)}
                    className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                    required
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reason for Return *</label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                  >
                    <option value="Damaged / broken packaging">Damaged / broken packaging</option>
                    <option value="Near-expiry distributor return">Near-expiry distributor return</option>
                    <option value="Batch recall notification">Batch recall notification</option>
                    <option value="Short supply / overcharge discrepancy">Short supply / overcharge discrepancy</option>
                    <option value="Excess unsold inventory">Excess unsold inventory</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Debit Note No (Auto or Custom)</label>
                  <input
                    type="text"
                    value={returnCustomDocNumber}
                    onChange={(e) => setReturnCustomDocNumber(e.target.value)}
                    placeholder="Leave empty for auto-generated"
                    className="w-full py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono"
                  />
                </div>
              </div>

              {/* Return Batches Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-700">Stock Batches to Return</span>
                  <button
                    type="button"
                    onClick={handleAddReturnLine}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Batch Line</span>
                  </button>
                </div>

                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Batch & Medicine</th>
                      <th className="py-2 px-2 text-center w-24">In Stock</th>
                      <th className="py-2 px-2 text-center w-24">Return Qty</th>
                      <th className="py-2 px-2 text-right w-24">Return Rate (₹)</th>
                      <th className="py-2 px-2 text-center w-20">GST %</th>
                      <th className="py-2 px-2 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {returnLines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <select
                            value={line.batchId}
                            onChange={(e) => handleReturnLineChange(idx, 'batchId', e.target.value)}
                            className="w-full py-1 px-1.5 bg-white border border-slate-300 rounded font-semibold text-slate-800"
                          >
                            {availableBatches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.brandName} - Batch: {b.batchNumber} (Stock: {b.quantity})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-slate-600">
                          {line.availableStock} loose
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min={1}
                            max={line.availableStock}
                            value={line.quantityUnits}
                            onChange={(e) => handleReturnLineChange(idx, 'quantityUnits', parseInt(e.target.value, 10) || 1)}
                            className="w-16 text-center py-1 bg-white border border-slate-300 rounded font-bold text-purple-700"
                            required
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="text"
                            value={line.returnRateRupees}
                            onChange={(e) => handleReturnLineChange(idx, 'returnRateRupees', e.target.value)}
                            className="w-20 text-right py-1 px-1 bg-white border border-slate-300 rounded font-bold text-slate-800"
                            required
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <select
                            value={line.taxRatePercent}
                            onChange={(e) => handleReturnLineChange(idx, 'taxRatePercent', Number(e.target.value))}
                            className="py-1 px-1 bg-white border border-slate-300 rounded"
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={12}>12%</option>
                            <option value={18}>18%</option>
                          </select>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveReturnLine(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between text-xs font-bold text-purple-900">
                <span>Total Debit Amount (Stock Reduction & Supplier Payable Credit)</span>
                <span className="text-base font-black">
                  ₹
                  {returnLines
                    .reduce((sum, l) => {
                      const gross = Number(l.quantityUnits || 0) * parseFloat(l.returnRateRupees || '0');
                      const tax = (gross * Number(l.taxRatePercent || 0)) / 100;
                      return sum + gross + tax;
                    }, 0)
                    .toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowReturnForm(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs shadow-md transition disabled:opacity-50"
                >
                  {isSubmittingReturn ? 'Posting Debit Note...' : 'Issue Supplier Debit Note & Deduct Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW DEBIT NOTE VOUCHER */}
      {viewingDebitNote && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm">Debit Note Document #{viewingDebitNote.debitNoteNumber}</h3>
              </div>
              <button onClick={() => setViewingDebitNote(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
              <div className="flex justify-between border-b pb-4">
                <div>
                  <h4 className="font-black text-base text-slate-800">ALGIONS PHARMACY</h4>
                  <p className="text-slate-500">Official Supplier Debit Note Voucher</p>
                  <p className="text-slate-500 mt-1 font-mono">Issued: {viewingDebitNote.createdAt.slice(0, 10)}</p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 bg-purple-100 text-purple-800 font-mono font-bold rounded border border-purple-200">
                    {viewingDebitNote.debitNoteNumber}
                  </span>
                  <p className="text-slate-500 text-[11px] mt-2">Issued by: {viewingDebitNote.createdByName}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Distributor</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{viewingDebitNote.supplierName}</p>
                  <p className="text-slate-500">GSTIN: {viewingDebitNote.supplierGstin || 'Not provided'}</p>
                  <p className="text-slate-500">Phone: {viewingDebitNote.supplierPhone || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Return Reason</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{viewingDebitNote.reason}</p>
                  <p className="text-purple-700 font-bold mt-1">General Ledger Code: 2000 (Accounts Payable Debit)</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Item & Strength</th>
                    <th className="py-2 px-2">Batch</th>
                    <th className="py-2 px-2 text-center">Returned Qty</th>
                    <th className="py-2 px-2 text-right">Return Rate</th>
                    <th className="py-2 px-2 text-center">GST %</th>
                    <th className="py-2 px-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingDebitNote.lines?.map((line: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-bold text-slate-800">{line.productName}</td>
                      <td className="py-2 px-2 font-mono">{line.batchNumber}</td>
                      <td className="py-2 px-2 text-center font-bold text-purple-700">{line.quantityUnits} loose</td>
                      <td className="py-2 px-2 text-right font-mono">{formatPaiseToINR(line.returnRatePaise)}</td>
                      <td className="py-2 px-2 text-center">{line.taxRatePercent}%</td>
                      <td className="py-2 px-3 text-right font-black font-mono">{formatPaiseToINR(line.totalPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 text-right font-semibold">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Value:</span>
                    <span>{formatPaiseToINR(viewingDebitNote.totalAmountPaise - viewingDebitNote.totalTaxPaise)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST Reversal:</span>
                    <span>{formatPaiseToINR(viewingDebitNote.totalTaxPaise)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-black text-sm border-t pt-1.5">
                    <span>Net Debit Note:</span>
                    <span className="text-purple-700">{formatPaiseToINR(viewingDebitNote.totalAmountPaise)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </button>
              <button
                onClick={() => setViewingDebitNote(null)}
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
