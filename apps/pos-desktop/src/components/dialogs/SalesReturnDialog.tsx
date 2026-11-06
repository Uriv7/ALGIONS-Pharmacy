import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, Check, X, ShieldAlert } from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';
import { api } from '../../api/client.js';

interface SalesReturnDialogProps {
  invoice: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const SalesReturnDialog: React.FC<SalesReturnDialogProps> = ({
  invoice,
  onClose,
  onSuccess,
}) => {
  const [returnItems, setReturnItems] = useState<
    {
      lineId: string;
      batchId: string;
      productName: string;
      batchNumber: string;
      originalQty: number;
      returnQty: number;
      unitPricePaise: number;
      isSellable: boolean;
      returnReason: string;
    }[]
  >(
    (invoice.lines || []).map((line: any) => ({
      lineId: line.id,
      batchId: line.batchId || line.batch_id,
      productName: line.productName || line.product_name,
      batchNumber: line.batchNumber || line.batch_number,
      originalQty: line.quantity,
      returnQty: 0,
      unitPricePaise: line.saleRatePaise || line.sale_rate_paise || line.mrpPaise || line.mrp_paise,
      isSellable: true,
      returnReason: 'Customer Return',
    }))
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQtyChange = (idx: number, qty: number) => {
    setReturnItems((prev) => {
      const copy = [...prev];
      copy[idx]!.returnQty = Math.max(0, Math.min(qty, copy[idx]!.originalQty));
      return copy;
    });
  };

  const handleSellableChange = (idx: number, isSellable: boolean) => {
    setReturnItems((prev) => {
      const copy = [...prev];
      copy[idx]!.isSellable = isSellable;
      return copy;
    });
  };

  const handleReasonChange = (idx: number, reason: string) => {
    setReturnItems((prev) => {
      const copy = [...prev];
      copy[idx]!.returnReason = reason;
      return copy;
    });
  };

  const selectedReturns = returnItems.filter((i) => i.returnQty > 0);
  const totalRefundPaise = selectedReturns.reduce(
    (sum, item) => sum + item.returnQty * item.unitPricePaise,
    0
  );

  const handleSubmitReturn = async () => {
    if (selectedReturns.length === 0) {
      setError('Please select at least one item and quantity to return.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.createSalesReturn({
        originalInvoiceId: invoice.id,
        items: selectedReturns.map((i) => ({
          batchId: i.batchId,
          quantity: i.returnQty,
          isSellable: i.isSellable,
          returnReason: i.returnReason,
        })),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to process sales return.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-teal-600" />
              <span>Process Sales Return (RET-001)</span>
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Original Invoice: {invoice.full_invoice_number || invoice.fullInvoiceNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Return Items Table */}
        <div className="p-4 flex-1 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] pb-2">
                <th className="pb-2">Medicine / Batch</th>
                <th className="pb-2 text-center">Billed Qty</th>
                <th className="pb-2 text-center">Return Qty</th>
                <th className="pb-2 text-center">Condition</th>
                <th className="pb-2 text-right">Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returnItems.map((item, idx) => (
                <tr key={item.lineId} className="hover:bg-slate-50/50">
                  <td className="py-2.5">
                    <div className="font-bold text-slate-800">{item.productName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Batch: {item.batchNumber}
                    </div>
                  </td>
                  <td className="py-2.5 text-center font-semibold text-slate-600">
                    {item.originalQty}
                  </td>
                  <td className="py-2.5 text-center">
                    <input
                      type="number"
                      min={0}
                      max={item.originalQty}
                      value={item.returnQty}
                      onChange={(e) => handleQtyChange(idx, parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 text-center font-bold text-xs border border-slate-300 rounded focus:ring-2 focus:ring-teal-600 focus:outline-none"
                    />
                  </td>
                  <td className="py-2.5 text-center">
                    <select
                      value={item.isSellable ? 'SELLABLE' : 'DAMAGED'}
                      onChange={(e) => handleSellableChange(idx, e.target.value === 'SELLABLE')}
                      className="px-2 py-1 text-[11px] font-semibold border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      <option value="SELLABLE">Sellable (Restock)</option>
                      <option value="DAMAGED">Damaged / Expired (Quarantine)</option>
                    </select>
                  </td>
                  <td className="py-2.5 text-right font-bold text-slate-800">
                    {formatPaiseToINR(item.returnQty * item.unitPricePaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Refund Summary */}
          <div className="mt-4 p-3 bg-teal-50 rounded-xl border border-teal-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-teal-900">Total Refund / Credit Note</div>
              <div className="text-[11px] text-teal-700">
                {selectedReturns.length} item(s) selected for return
              </div>
            </div>
            <div className="text-lg font-black text-teal-900">
              {formatPaiseToINR(totalRefundPaise)}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitReturn}
            disabled={submitting || selectedReturns.length === 0}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold rounded-lg text-xs shadow transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{submitting ? 'Processing...' : 'Confirm Return & Issue Credit'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
