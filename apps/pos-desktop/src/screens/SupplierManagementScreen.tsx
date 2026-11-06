import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  DollarSign,
  RefreshCw,
  Phone,
  Building,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';
import { api } from '../api/client.js';
import { AuthSessionUser } from '@algions/contracts';

interface SupplierManagementScreenProps {
  user: AuthSessionUser;
}

export const SupplierManagementScreen: React.FC<SupplierManagementScreenProps> = ({ user }) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Supplier Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [creditPeriod, setCreditPeriod] = useState('21');
  const [saving, setSaving] = useState(false);

  // Pay Supplier Modal
  const [paySupplier, setPaySupplier] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('BANK');
  const [payNotes, setPayNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.getSuppliersList();
      setSuppliers(res.suppliers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createSupplier({
        name,
        gstin: gstin.toUpperCase(),
        phone: phone || undefined,
        address: address || undefined,
        creditPeriodDays: parseInt(creditPeriod, 10),
      });
      setShowAddModal(false);
      setName('');
      setGstin('');
      setPhone('');
      setAddress('');
      setMsg(`Supplier ${name} created successfully.`);
      fetchSuppliers();
    } catch (err: any) {
      alert(err.message || 'Error creating supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplier) return;
    setSubmittingPayment(true);
    try {
      const paise = Math.round(parseFloat(payAmount) * 100);
      await api.recordSupplierPayment(paySupplier.id, {
        amountPaise: paise,
        mode: payMode,
        notes: payNotes || `Payment to ${paySupplier.name} via ${payMode}`,
      });
      setPaySupplier(null);
      setPayAmount('');
      setPayNotes('');
      setMsg(`Payment of ₹${payAmount} recorded for ${paySupplier.name}. Payables adjusted.`);
      fetchSuppliers();
    } catch (err: any) {
      alert(err.message || 'Payment recording failed');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const filtered = suppliers.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(term) ||
      (s.gstin || '').toLowerCase().includes(term) ||
      (s.phone || '').toLowerCase().includes(term)
    );
  });

  const totalPayablePaise = suppliers.reduce(
    (sum, s) => sum + Math.max(0, Number(s.outstandingPayablePaise || 0)),
    0
  );

  return (
    <div className="flex-1 flex flex-col p-6 bg-slate-100 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-5 h-5 text-teal-600" />
            <span>Suppliers & Trade Payables (PUR-001 / PUR-008)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pharmaceutical distributors • GSTIN records • Payables settlement & payment ledger
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Payables:</span>
            <span className="text-sm font-black text-red-600">
              {formatPaiseToINR(totalPayablePaise)}
            </span>
          </div>

          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search supplier name or GSTIN..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>

          {user.accountType === 'OWNER' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg text-xs font-bold shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )}

          <button
            onClick={fetchSuppliers}
            className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 transition"
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

      {/* Supplier Table */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4">Supplier / Distributor Name</th>
                <th className="py-2.5 px-3">GSTIN</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Address</th>
                <th className="py-2.5 px-3 text-center">Credit Period</th>
                <th className="py-2.5 px-3 text-right">Outstanding Payable</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading suppliers...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No suppliers found.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const payable = Math.max(0, Number(s.outstandingPayablePaise || 0));
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-teal-800">
                        {s.gstin || 'Unregistered'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700">
                        {s.phone || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                        {s.address || '—'}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {s.creditPeriodDays} Days
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-black text-sm text-slate-900">
                        <span className={payable > 0 ? 'text-red-600' : 'text-slate-400'}>
                          {formatPaiseToINR(payable)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {payable > 0 ? (
                          <button
                            onClick={() => {
                              setPaySupplier(s);
                              setPayAmount((payable / 100).toFixed(2));
                            }}
                            className="px-3 py-1 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded text-[11px] font-bold shadow-sm transition"
                          >
                            Pay Supplier
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Supplier */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200">
            <h2 className="text-base font-bold text-slate-800 mb-1">Add Supplier / Distributor</h2>
            <p className="text-xs text-slate-500 mb-4">
              Register authorized pharmaceutical stockist for purchase inwarding.
            </p>

            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Distributor Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apollo Pharma Distributors"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN (15 Digits) *</label>
                <input
                  type="text"
                  maxLength={15}
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="07AAAAA0000A1Z5"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold tracking-wider"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Credit Period (Days)</label>
                  <input
                    type="number"
                    min="0"
                    value={creditPeriod}
                    onChange={(e) => setCreditPeriod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address / Warehouse</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow"
                >
                  {saving ? 'Saving...' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Supplier Payment */}
      {paySupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200">
            <h2 className="text-base font-bold text-slate-800 mb-1">Record Supplier Payment</h2>
            <p className="text-xs text-slate-500 mb-4">
              Disbursing payment to <strong>{paySupplier.name}</strong>.
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 flex justify-between items-center text-xs">
                <span className="font-semibold text-red-800">Total Outstanding Payable:</span>
                <span className="font-black text-sm text-red-900">
                  {formatPaiseToINR(paySupplier.outstandingPayablePaise)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount Paid (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-black text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Channel</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                >
                  <option value="BANK">Bank Transfer / NEFT / RTGS (1010)</option>
                  <option value="UPI">Business UPI (1010)</option>
                  <option value="CASH">Counter Cash Disbursement (1000)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bank Reference / UTR Number
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. UTR123456789 / Cheque #0045"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaySupplier(null)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow"
                >
                  {submittingPayment ? 'Posting...' : 'Post Disbursement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
