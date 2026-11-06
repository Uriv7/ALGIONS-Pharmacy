import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Calculator,
  AlertTriangle,
  CheckCircle,
  Printer,
  X,
  TrendingUp,
  Receipt,
  DollarSign,
  Clock,
} from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';
import { api } from '../../api/client.js';

interface ShiftClosingDialogProps {
  onClose: () => void;
}

export const ShiftClosingDialog: React.FC<ShiftClosingDialogProps> = ({ onClose }) => {
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Denominations count
  const [denominations, setDenominations] = useState<Record<string, number>>({
    '500': 0,
    '200': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    'coins': 0,
  });

  const [notes, setNotes] = useState('');
  const [closing, setClosing] = useState(false);
  const [closedVoucher, setClosedVoucher] = useState<any | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await api.getShiftSummary();
        setSummary(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  const handleDenomChange = (valStr: string, count: number) => {
    setDenominations((prev) => ({
      ...prev,
      [valStr]: Math.max(0, count),
    }));
  };

  // Calculate counted cash in paise
  const countedCashPaise =
    (denominations['500'] || 0) * 500 * 100 +
    (denominations['200'] || 0) * 200 * 100 +
    (denominations['100'] || 0) * 100 * 100 +
    (denominations['50'] || 0) * 50 * 100 +
    (denominations['20'] || 0) * 20 * 100 +
    (denominations['10'] || 0) * 10 * 100 +
    Math.round((denominations['coins'] || 0) * 100);

  const expectedCashPaise = summary?.expectedCashPaise || 0;
  const variancePaise = countedCashPaise - expectedCashPaise;

  const handleCloseShift = async () => {
    if (!window.confirm('Close cashier shift and record drawer balancing voucher? This action will be permanently recorded in the tamper-evident audit log.')) {
      return;
    }

    setClosing(true);
    try {
      const res = await api.closeShift({
        openingFloatPaise: summary?.openingFloatPaise || 200000,
        countedCashPaise,
        denominations,
        notes: notes.trim(),
      });
      setClosedVoucher(res);
    } catch (err: any) {
      alert(`Error closing shift: ${err.message}`);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="font-bold text-sm">Shift / Day-End Drawer Balancing (POS-016)</h3>
              <p className="text-[10px] text-slate-400">Cashier shift closing and physical cash drawer audit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs font-semibold">
            Loading shift sales & ledger figures...
          </div>
        ) : closedVoucher ? (
          /* Shift Closed Receipt / Slip View */
          <div className="p-6 overflow-y-auto flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800">Shift Closed Successfully</h4>
            <p className="text-xs text-slate-500 mb-6">
              Voucher ID: <span className="font-mono font-bold text-slate-700">{closedVoucher.shiftCloseId}</span>
            </p>

            <div className="w-full max-w-md bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2 mb-6 font-mono">
              <div className="flex justify-between border-b pb-1 font-bold">
                <span>Cashier:</span>
                <span>{closedVoucher.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{closedVoucher.shiftDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Opening Cash Float:</span>
                <span>{formatPaiseToINR(closedVoucher.openingFloatPaise)}</span>
              </div>
              <div className="flex justify-between text-teal-700 font-semibold">
                <span>+ Cash Sales:</span>
                <span>{formatPaiseToINR(closedVoucher.cashSalesPaise)}</span>
              </div>
              <div className="flex justify-between text-teal-700 font-semibold">
                <span>+ Khata Cash Receipts:</span>
                <span>{formatPaiseToINR(closedVoucher.customerKhataCashPaise)}</span>
              </div>
              <div className="flex justify-between text-red-600 font-semibold">
                <span>- Cash Expenses Paid:</span>
                <span>{formatPaiseToINR(closedVoucher.cashExpensesPaise)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>Expected Drawer Cash:</span>
                <span>{formatPaiseToINR(closedVoucher.expectedCashPaise)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-slate-900 border-t pt-1">
                <span>Physical Cash Counted:</span>
                <span>{formatPaiseToINR(closedVoucher.countedCashPaise)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 text-sm font-black">
                <span>Drawer Status / Variance:</span>
                <span
                  className={
                    closedVoucher.variancePaise === 0
                      ? 'text-emerald-600'
                      : closedVoucher.variancePaise > 0
                      ? 'text-blue-600'
                      : 'text-red-600'
                  }
                >
                  {closedVoucher.status} ({formatPaiseToINR(closedVoucher.variancePaise)})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Printer className="w-4 h-4" />
                <span>Print Shift Slip</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Drawer Balancing Input Form */
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Cashier & Bills</div>
                <div className="text-sm font-black text-slate-900 mt-1">{summary.cashierName}</div>
                <div className="text-[11px] text-slate-500">{summary.billsCount} bills today</div>
              </div>

              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                <div className="text-[10px] font-bold text-teal-600 uppercase">Cash Inflows</div>
                <div className="text-sm font-black text-teal-800 mt-1">
                  {formatPaiseToINR((summary.cashSalesPaise || 0) + (summary.customerKhataCashPaise || 0))}
                </div>
                <div className="text-[10px] text-teal-600">
                  Sales: {formatPaiseToINR(summary.cashSalesPaise)} • Khata: {formatPaiseToINR(summary.customerKhataCashPaise)}
                </div>
              </div>

              <div className="p-3 bg-slate-900 text-white rounded-xl">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Expected in Drawer</div>
                <div className="text-base font-black text-teal-400 mt-1">
                  {formatPaiseToINR(expectedCashPaise)}
                </div>
                <div className="text-[10px] text-slate-400">
                  Incl. ₹{(summary.openingFloatPaise / 100).toFixed(0)} opening float
                </div>
              </div>
            </div>

            {/* Denomination Counter */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-teal-600" />
                <span>Count Physical Currency in Drawer</span>
              </h4>

              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                {['500', '200', '100', '50', '20', '10'].map((val) => (
                  <div key={val} className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-200">
                    <span className="font-bold text-slate-700">₹{val} ×</span>
                    <input
                      type="number"
                      min="0"
                      value={denominations[val] || ''}
                      onChange={(e) => handleDenomChange(val, parseInt(e.target.value || '0', 10))}
                      placeholder="0"
                      className="w-12 text-center font-bold text-slate-900 border-b border-slate-300 focus:outline-none focus:border-teal-600"
                    />
                  </div>
                ))}

                <div className="col-span-2 flex items-center justify-between bg-white px-3 py-1.5 rounded border border-slate-200">
                  <span className="font-bold text-slate-700">Coins Total (₹)</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={denominations['coins'] || ''}
                    onChange={(e) => handleDenomChange('coins', parseFloat(e.target.value || '0'))}
                    placeholder="0"
                    className="w-20 text-center font-bold text-slate-900 border-b border-slate-300 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>
            </div>

            {/* Variance Bar */}
            <div
              className={`p-3 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                variancePaise === 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : variancePaise > 0
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider">
                  Total Counted Cash
                </div>
                <div className="text-xl font-black">{formatPaiseToINR(countedCashPaise)}</div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider">
                  Drawer Variance (Counted - Expected)
                </div>
                <div className="text-lg font-black">
                  {variancePaise === 0
                    ? '₹0.00 (Perfect Match)'
                    : variancePaise > 0
                    ? `+${formatPaiseToINR(variancePaise)} (Overage)`
                    : `${formatPaiseToINR(variancePaise)} (Shortage)`}
                </div>
              </div>
            </div>

            {/* Cashier Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Shift Handover / Discrepancy Remarks
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes (e.g. ₹50 loose change kept aside, minor discrepancy verified)"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseShift}
                disabled={closing}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{closing ? 'Balancing Drawer...' : 'Confirm & Close Shift'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
