import React, { useState, useEffect } from 'react';
import {
  FileText,
  Calculator,
  BookOpen,
  PieChart,
  RefreshCw,
  Building,
  CheckCircle,
  Hash,
  Receipt,
  ShieldAlert,
  Printer,
  Plus,
  ArrowRight,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';
import { api } from '../api/client.js';

export const AccountingGstScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'GST' | 'DAY_BOOK' | 'ACCOUNTS' | 'EXPENSES' | 'SCHEDULE_H1'>('GST');
  const [gstData, setGstData] = useState<any | null>(null);
  const [dayBook, setDayBook] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [scheduleH1List, setScheduleH1List] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Expense Form State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('TEA_REFRESHMENTS');
  const [payeeName, setPayeeName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK' | 'UPI'>('CASH');
  const [narration, setNarration] = useState('');
  const [postingExpense, setPostingExpense] = useState(false);
  const [expenseSuccessMsg, setExpenseSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [gRes, dRes, lRes, expRes, h1Res] = await Promise.all([
        api.getGstSummary(),
        api.getDayBook(),
        api.getLedgers(),
        api.getExpenses(),
        api.getScheduleH1Register(),
      ]);
      setGstData(gRes);
      setDayBook(dRes.dayBook || []);
      setLedgers(lRes.accounts || []);
      setExpenses(expRes.expenses || []);
      setScheduleH1List(h1Res.register || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const paise = Math.round(parseFloat(expenseAmount || '0') * 100);
    if (paise <= 0 || !payeeName.trim()) return;

    setPostingExpense(true);
    setExpenseSuccessMsg(null);
    try {
      await api.createExpense({
        category: expenseCategory,
        payeeName: payeeName.trim(),
        amountPaise: paise,
        paymentMode,
        narration: narration.trim(),
      });
      setExpenseSuccessMsg('Expense posted to General Ledger.');
      setExpenseAmount('');
      setPayeeName('');
      setNarration('');
      setShowExpenseModal(false);
      await fetchData();
    } catch (err: any) {
      alert(`Error creating expense: ${err.message}`);
    } finally {
      setPostingExpense(false);
    }
  };

  const handlePrintScheduleH1 = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col p-6 bg-slate-100 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-teal-600" />
            <span>GST Compliance & Double-Entry Accounting (GST-004 / ACC-005)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            GSTR-1 / 3B tax summaries • HSN code analytics • Day Book • Expenses • Schedule H1 Register
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="bg-white border border-slate-200 rounded-lg p-0.5 flex">
            <button
              onClick={() => setActiveTab('GST')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'GST'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>GST Summary</span>
            </button>

            <button
              onClick={() => setActiveTab('DAY_BOOK')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'DAY_BOOK'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Day Book</span>
            </button>

            <button
              onClick={() => setActiveTab('ACCOUNTS')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'ACCOUNTS'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Ledgers</span>
            </button>

            <button
              onClick={() => setActiveTab('EXPENSES')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'EXPENSES'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Expenses</span>
            </button>

            <button
              onClick={() => setActiveTab('SCHEDULE_H1')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'SCHEDULE_H1'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>Schedule H1</span>
            </button>
          </div>

          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* TAB 1: GST SUMMARY */}
      {activeTab === 'GST' && gstData && (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Top GST Metric Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Taxable Value
              </span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatPaiseToINR(gstData.totalTaxablePaise)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                CGST Collected (Output)
              </span>
              <div className="text-xl font-black text-teal-600 mt-1">
                {formatPaiseToINR(gstData.totalCGSTPaise)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                SGST Collected (Output)
              </span>
              <div className="text-xl font-black text-teal-600 mt-1">
                {formatPaiseToINR(gstData.totalSGSTPaise)}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Invoice Value
              </span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatPaiseToINR(gstData.totalInvoicePaise)}
              </div>
            </div>
          </div>

          {/* HSN Table */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between">
              <span>HSN / SAC Summary (GSTR-1 Format)</span>
              <span className="font-mono text-slate-500">Period: {gstData.periodStart} to {gstData.periodEnd}</span>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4">HSN Code</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-center">Total Quantity</th>
                    <th className="py-2.5 px-3 text-right">Taxable Value</th>
                    <th className="py-2.5 px-3 text-right">CGST</th>
                    <th className="py-2.5 px-3 text-right">SGST</th>
                    <th className="py-2.5 px-4 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gstData.hsnSummary?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No sales recorded for this GST period.
                      </td>
                    </tr>
                  ) : (
                    gstData.hsnSummary?.map((h: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-bold text-teal-800">
                          {h.hsnCode}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {h.description}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {h.totalUnits}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-800">
                          {formatPaiseToINR(h.taxablePaise)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
                          {formatPaiseToINR(h.cgstPaise)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
                          {formatPaiseToINR(h.sgstPaise)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums font-black text-slate-900">
                          {formatPaiseToINR(h.totalAmountPaise)}
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

      {/* TAB 2: DAY BOOK */}
      {activeTab === 'DAY_BOOK' && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
            Chronological General Ledger Postings (Double-Entry Balanced)
          </div>

          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4">Date / Time</th>
                  <th className="py-2.5 px-3">Account Code & Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Narration / Memo</th>
                  <th className="py-2.5 px-3 text-right">Debit (Dr)</th>
                  <th className="py-2.5 px-4 text-right">Credit (Cr)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dayBook.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No ledger transactions posted yet.
                    </td>
                  </tr>
                ) : (
                  dayBook.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                        {e.date}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        <span className="font-mono text-teal-700 font-bold mr-1.5">[{e.accountCode}]</span>
                        <span>{e.accountName}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          {e.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {e.narration}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900">
                        {e.debitPaise > 0 ? formatPaiseToINR(e.debitPaise) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-bold text-slate-900">
                        {e.creditPaise > 0 ? formatPaiseToINR(e.creditPaise) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CHART OF ACCOUNTS & BALANCES */}
      {activeTab === 'ACCOUNTS' && (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
            Chart of Accounts & Current Balances
          </div>

          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-4">Account Code</th>
                  <th className="py-2.5 px-3">Account Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Total Debit</th>
                  <th className="py-2.5 px-3 text-right">Total Credit</th>
                  <th className="py-2.5 px-4 text-right">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgers.map((a) => (
                  <tr key={a.accountCode} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-teal-800">
                      {a.accountCode}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">
                      {a.accountName}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {a.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                      {formatPaiseToINR(a.totalDebitPaise)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-600">
                      {formatPaiseToINR(a.totalCreditPaise)}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-black text-sm text-slate-900">
                      {formatPaiseToINR(a.balancePaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: EXPENSES (ACC-004) */}
      {activeTab === 'EXPENSES' && (
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Record daily pharmacy operating expenses (Rent, Electricity, Tea/Snacks, Supplies, Maintenance).
            </div>
            <button
              onClick={() => setShowExpenseModal(true)}
              className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Record Expense Voucher</span>
            </button>
          </div>

          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between items-center">
              <span>Operating Expense Vouchers (Debited to 5000 Series)</span>
              <span className="text-[11px] font-normal text-slate-500">
                Total Expenses: {formatPaiseToINR(expenses.reduce((acc, curr) => acc + (curr.amountPaise || 0), 0))}
              </span>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-3">Expense Head</th>
                    <th className="py-2.5 px-3">Narration / Payee</th>
                    <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">
                        No expense vouchers recorded yet.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp: any) => (
                      <tr key={exp.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {exp.date}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          <span className="font-mono text-teal-700 mr-1.5">[{exp.accountCode}]</span>
                          <span>{exp.accountName}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {exp.narration}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-900">
                          {formatPaiseToINR(exp.amountPaise)}
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

      {/* TAB 5: STATUTORY SCHEDULE H1 DRUG REGISTER (CUS-006 / QA-011) */}
      {activeTab === 'SCHEDULE_H1' && (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Statutory Schedule H1 & Antibiotic Dispensation Register</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Mandatory under Drugs & Cosmetics Rules, 1945 (Rule 65). Maintained for 3rd/4th generation antibiotics and controlled drugs.
              </p>
            </div>

            <button
              onClick={handlePrintScheduleH1}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Register (Inspector Copy)</span>
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10 text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Bill No</th>
                  <th className="py-2.5 px-3">Patient Name & Address</th>
                  <th className="py-2.5 px-3">Doctor & Reg No</th>
                  <th className="py-2.5 px-3">Drug & Formulation</th>
                  <th className="py-2.5 px-2">Batch No</th>
                  <th className="py-2.5 px-2">Expiry</th>
                  <th className="py-2.5 px-2 text-center">Qty</th>
                  <th className="py-2.5 px-3">Pharmacist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {scheduleH1List.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No Schedule H1 or restricted antibiotic dispensations recorded.
                    </td>
                  </tr>
                ) : (
                  scheduleH1List.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-amber-50/40">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {row.date?.slice(0, 10)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-teal-800">
                        {row.invoiceNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{row.patientName}</div>
                        <div className="text-[10px] text-slate-400">{row.patientPhone} • {row.patientAddress}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{row.doctorName}</div>
                        <div className="text-[10px] font-mono text-slate-500">Reg: {row.doctorRegNumber}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{row.drugName}</div>
                        <div className="text-[10px] text-slate-500">{row.genericName}</div>
                      </td>
                      <td className="py-2.5 px-2 font-mono font-semibold text-slate-700">
                        {row.batchNumber}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-slate-500">
                        {row.expiryDate}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-900">
                        {row.quantityDispensed}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-600 text-[11px]">
                        {row.pharmacistName}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-sm">Record Expense Voucher (ACC-004)</h3>
              </div>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expense Category
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="TEA_REFRESHMENTS">Tea, Coffee & Staff Refreshments [5005]</option>
                  <option value="PACKAGING">Bags, Thermal Rolls & Packaging [5003]</option>
                  <option value="ELECTRICITY">Electricity & Store Utilities [5002]</option>
                  <option value="RENT">Store Rent [5001]</option>
                  <option value="SALARY_ADVANCE">Staff Salary Advance [5004]</option>
                  <option value="MAINTENANCE">Store Repairs & Maintenance [5006]</option>
                  <option value="OTHER">Other Operating Expenses [5000]</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payee / Vendor Name
                </label>
                <input
                  type="text"
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  placeholder="e.g. Ramesh Tea Stall, BSES Rajdhani, Landlord"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="e.g. 250.00"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-teal-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Paid From
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="CASH">Cash in Hand [1000]</option>
                    <option value="BANK">Bank Account [1010]</option>
                    <option value="UPI">Store UPI [1010]</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Narration / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="Brief note or voucher details"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postingExpense}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  {postingExpense ? 'Posting Voucher...' : 'Post to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
