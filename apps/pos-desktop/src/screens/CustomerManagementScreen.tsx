import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Phone,
  FileText,
  Clock,
  Calendar,
} from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';
import { api } from '../api/client.js';

export const CustomerManagementScreen: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [ageingData, setAgeingData] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'AGEING'>('DIRECTORY');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Add Customer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('5000');
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Settle Payment Modal
  const [settleCustomer, setSettleCustomer] = useState<any | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMode, setSettleMode] = useState('CASH');
  const [settleNotes, setSettleNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const [res, ageRes] = await Promise.all([
        api.getCustomers(searchTerm),
        api.getOutstandingAgeing().catch(() => ({ customers: null })),
      ]);
      setCustomers(res.customers || []);
      setAgeingData(ageRes?.customers || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchTerm]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCustomer(true);
    try {
      await api.createCustomer({
        name,
        phone,
        email: email || undefined,
        address: address || undefined,
        creditLimitPaise: Math.round(parseFloat(creditLimit || '0') * 100),
      });
      setShowAddModal(false);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setCreditLimit('5000');
      setMsg('Customer account created successfully.');
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to create customer');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleCustomer) return;
    setSubmittingPayment(true);
    try {
      const paise = Math.round(parseFloat(settleAmount) * 100);
      await api.recordCustomerPayment(settleCustomer.id, {
        amountPaise: paise,
        mode: settleMode,
        notes: settleNotes || `Credit payment received via ${settleMode}`,
      });
      setSettleCustomer(null);
      setSettleAmount('');
      setSettleNotes('');
      setMsg(`Payment of ₹${settleAmount} recorded. Outstanding balance adjusted.`);
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Payment recording failed');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const totalOutstandingPaise = customers.reduce(
    (sum, c) => sum + Number(c.outstanding_balance_paise || 0),
    0
  );

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-6 bg-slate-100 overflow-y-auto lg:overflow-hidden select-none">
      {/* Top Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            <span>Customer Khata & Credit Ledger (CUS-001 / CUS-003)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Customer directory • Credit limits • Settlement receipt posting
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Quick Metrics */}
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Receivables:</span>
            <span className="text-sm font-black text-amber-700">
              {formatPaiseToINR(totalOutstandingPaise)}
            </span>
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer name or phone..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg text-xs font-bold shadow transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
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

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setActiveTab('DIRECTORY')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
            activeTab === 'DIRECTORY'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customer Directory</span>
        </button>

        <button
          onClick={() => setActiveTab('AGEING')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
            activeTab === 'AGEING'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Receivables Ageing (ACC-006)</span>
          {ageingData?.rows?.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px]">
              {ageingData.rows.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'AGEING' ? (
        /* Receivables Ageing View (ACC-006) */
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {ageingData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                  0 – 30 Days (Current)
                </span>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {formatPaiseToINR(ageingData.buckets.days0_30Paise)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Within standard credit cycle</div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">
                  31 – 60 Days (Moderate)
                </span>
                <div className="text-lg font-black text-amber-700 mt-1">
                  {formatPaiseToINR(ageingData.buckets.days31_60Paise)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Payment follow-up recommended</div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-orange-600 uppercase tracking-wider">
                  61 – 90 Days (Overdue)
                </span>
                <div className="text-lg font-black text-orange-700 mt-1">
                  {formatPaiseToINR(ageingData.buckets.days61_90Paise)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Hold credit dispensing</div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">
                  90+ Days (Critical)
                </span>
                <div className="text-lg font-black text-rose-700 mt-1">
                  {formatPaiseToINR(ageingData.buckets.days90PlusPaise)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">High bad-debt risk</div>
              </div>
            </div>
          )}

          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full min-w-[700px] text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Customer Name</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Oldest Credit Date</th>
                    <th className="py-2.5 px-3 text-center">Overdue Days</th>
                    <th className="py-2.5 px-3 text-center">Ageing Bracket</th>
                    <th className="py-2.5 px-3 text-right">Outstanding Amount</th>
                    <th className="py-2.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!ageingData?.rows?.length ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <div className="text-xs font-bold text-slate-700">No overdue credit balances</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">All customer accounts are settled in full.</div>
                      </td>
                    </tr>
                  ) : (
                    ageingData.rows.map((row: any) => (
                      <tr key={row.id} className="hover:bg-slate-50 transition">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{row.name}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{row.phone}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {row.oldestInvoiceDate.slice(0, 10)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                          {row.ageDays} days
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.bucket === '90_PLUS'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : row.bucket === '61_90'
                                ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                : row.bucket === '31_60'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {row.bucket.replace('_', '–')} Days
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          {formatPaiseToINR(row.outstandingPaise)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => {
                              setSettleCustomer({ id: row.id, name: row.name, outstanding_balance_paise: row.outstandingPaise });
                              setSettleAmount((row.outstandingPaise / 100).toFixed(2));
                            }}
                            className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded text-[11px] font-bold transition"
                          >
                            Collect Payment
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
      ) : (
        /* Customer Table */
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full min-w-[700px] text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4">Customer Name</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Address</th>
                <th className="py-2.5 px-3 text-right">Credit Limit</th>
                <th className="py-2.5 px-3 text-right">Outstanding Balance</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading customer accounts...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No customers found matching search.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const outstanding = Number(c.outstanding_balance_paise || 0);
                  const limit = Number(c.credit_limit_paise || 0);
                  const hasDue = outstanding > 0;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 text-sm">{c.name}</div>
                        {c.email && (
                          <div className="text-[11px] text-slate-400">{c.email}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-700">
                        {c.phone}
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                        {c.address || '—'}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-slate-700">
                        {formatPaiseToINR(limit)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-black text-sm">
                        <span className={hasDue ? 'text-amber-700' : 'text-slate-400'}>
                          {formatPaiseToINR(outstanding)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {hasDue ? (
                          <button
                            onClick={() => {
                              setSettleCustomer(c);
                              setSettleAmount((outstanding / 100).toFixed(2));
                            }}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold shadow-sm transition"
                          >
                            Receive Payment
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Clear
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
      )}

      {/* Modal: Add Customer */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200">
            <h2 className="text-base font-bold text-slate-800 mb-1">Add Customer (Khata)</h2>
            <p className="text-xs text-slate-500 mb-4">
              Enables credit billing and prescription tracking for repeat customers.
            </p>

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Anand Mahindra"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (10 Digits)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Credit Limit (₹)</label>
                <input
                  type="number"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="5000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address (Optional)</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  placeholder="Street / locality"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow"
                >
                  {savingCustomer ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Payment / Settle Balance */}
      {settleCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200">
            <h2 className="text-base font-bold text-slate-800 mb-1">Record Credit Settlement</h2>
            <p className="text-xs text-slate-500 mb-4">
              Posting receipt against outstanding balance for <strong>{settleCustomer.name}</strong>.
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center text-xs">
                <span className="font-semibold text-amber-800">Current Outstanding:</span>
                <span className="font-black text-sm text-amber-900">
                  {formatPaiseToINR(settleCustomer.outstanding_balance_paise)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount Received (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-black text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={settleMode}
                  onChange={(e) => setSettleMode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                >
                  <option value="CASH">Cash in Hand (1000)</option>
                  <option value="UPI">UPI Payment (1010)</option>
                  <option value="BANK">Bank Transfer / Card (1010)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / Narration (Optional)
                </label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="e.g. UPI Ref / Cash receipt"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleCustomer(null)}
                  className="flex-1 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow"
                >
                  {submittingPayment ? 'Posting...' : 'Post Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
