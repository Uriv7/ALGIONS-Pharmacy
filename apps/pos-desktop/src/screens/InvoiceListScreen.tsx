import React, { useState, useEffect } from 'react';
import { FileText, Printer, Search, RefreshCw } from 'lucide-react';
import { api } from '../api/client.js';
import { formatPaiseToINR } from '@algions/domain';
import { StatusChip } from '@algions/ui';

interface InvoiceListScreenProps {
  onReprintInvoice: (invoiceId: string) => void;
}

export const InvoiceListScreen: React.FC<InvoiceListScreenProps> = ({ onReprintInvoice }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.getInvoices();
      setInvoices(res.invoices || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const filtered = invoices.filter((inv) => {
    const term = searchTerm.toLowerCase();
    return (
      (inv.full_invoice_number || '').toLowerCase().includes(term) ||
      (inv.customer_name || '').toLowerCase().includes(term) ||
      (inv.status || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex-1 flex flex-col p-6 bg-slate-100 overflow-hidden select-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Sales Invoices & History (P3)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable invoice archive • Single-click reprint and tax receipt audit
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search invoice number or customer..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>

          <button
            onClick={fetchInvoices}
            className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh Invoices"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4">Invoice No</th>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3 text-center">Items</th>
                <th className="py-2.5 px-3 text-right">Grand Total</th>
                <th className="py-2.5 px-3 text-center">Origin</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-4 text-center">Reprint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading invoices...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No invoices recorded yet.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 font-mono font-bold text-teal-800">
                      {inv.full_invoice_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-medium">
                      {(inv.occurred_at_local || inv.created_at || '').slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {inv.customer_name || 'Walk-in Cash Sale'}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600">
                      {inv.item_count} items
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900 text-sm">
                      {formatPaiseToINR(inv.grand_total_paise)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {inv.is_offline_origin ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          OFFLINE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ONLINE
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.status === 'POSTED'
                            ? 'bg-slate-100 text-slate-700'
                            : inv.status === 'VOIDED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => onReprintInvoice(inv.id)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-teal-700 transition"
                        title="Reprint receipt (ESC/POS)"
                      >
                        <Printer className="w-4 h-4" />
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
  );
};
