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
} from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';
import { api } from '../api/client.js';

export const AccountingGstScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'GST' | 'DAY_BOOK' | 'ACCOUNTS'>('GST');
  const [gstData, setGstData] = useState<any | null>(null);
  const [dayBook, setDayBook] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [gRes, dRes, lRes] = await Promise.all([
        api.getGstSummary(),
        api.getDayBook(),
        api.getLedgers(),
      ]);
      setGstData(gRes);
      setDayBook(dRes.dayBook || []);
      setLedgers(lRes.accounts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
            GSTR-1 / 3B tax summaries • HSN code analytics • Real-time General Ledger & Day Book
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
              <span>Ledger Balances</span>
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
                {formatPaiseToINR(gstData.totalInvoiceValuePaise)}
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
    </div>
  );
};
