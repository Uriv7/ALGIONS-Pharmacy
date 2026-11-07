import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, CheckCircle, AlertTriangle, ShieldCheck, User, FileText, Search, RefreshCw, Truck } from 'lucide-react';
import { api } from '../api/client.js';
import { formatPaiseToINR, toPaise } from '@algions/domain';
import { AuthSessionUser } from '@algions/contracts';

interface PurchaseEntryScreenProps {
  user?: AuthSessionUser;
  onSuccess: () => void;
}

export const PurchaseEntryScreen: React.FC<PurchaseEntryScreenProps> = ({ user, onSuccess }) => {
  const isOwner = user?.accountType === 'OWNER';
  const [activeTab, setActiveTab] = useState<'NEW_ENTRY' | 'HISTORY'>('NEW_ENTRY');

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

  // Line items
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

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      fetchHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    const init = async () => {
      try {
        const suppRes = await api.getSuppliers();
        setSuppliers(suppRes.suppliers || []);
        if (suppRes.suppliers?.length > 0) {
          setSelectedSupplierId(suppRes.suppliers[0].id);
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

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-6 bg-slate-100 overflow-y-auto select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Purchase Goods Receipt (U1)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record supplier invoice, generate batches, and post positive stock movements atomically
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
      <div className="flex items-center gap-2 mb-4">
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
      </div>

      {activeTab === 'HISTORY' ? (
        /* Purchase Invoices Archive */
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                placeholder="Search by invoice number or distributor..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <button
              onClick={fetchHistory}
              className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 transition self-start sm:self-auto"
              title="Refresh Purchase Invoices"
            >
              <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full min-w-[700px] text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4">Supplier Invoice #</th>
                  <th className="py-2.5 px-3">Distributor Name</th>
                  <th className="py-2.5 px-3">Invoice Date</th>
                  <th className="py-2.5 px-3 text-right">Inward Total</th>
                  <th className="py-2.5 px-3 text-right">GST Input Credit</th>
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
      ) : (
        /* Form for New Entry */
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
    </div>
  );
};
