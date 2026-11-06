import React, { useRef } from 'react';
import { X, Printer, CheckCircle, Download } from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';

interface ReceiptPrintDialogProps {
  invoice: any;
  store: any;
  onClose: () => void;
}

export const ReceiptPrintDialog: React.FC<ReceiptPrintDialogProps> = ({
  invoice,
  store,
  onClose,
}) => {
  const isOfflineOrigin = Boolean(invoice.is_offline_origin || invoice.isOfflineOrigin);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm">Invoice Saved & Ready to Print</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 80mm ESC/POS Thermal Receipt Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
          <div
            ref={printRef}
            className="w-[320px] bg-white p-4 shadow-md border border-slate-300 font-mono text-xs text-slate-900 leading-tight"
          >
            {/* Offline Label banner if issued locally */}
            {isOfflineOrigin && (
              <div className="mb-2 p-1.5 text-center font-bold text-[10px] bg-amber-100 text-amber-900 border border-amber-300 rounded">
                *** OFFLINE – SAVED LOCALLY ***<br />
                PENDING CLOUD SYNCHRONIZATION
              </div>
            )}

            {/* Shop Header */}
            <div className="text-center border-b border-dashed border-slate-400 pb-2 mb-2">
              <div className="font-bold text-sm uppercase">{store?.legal_name || 'ALGIONS AI LABS PVT LTD'}</div>
              <div className="font-semibold text-xs">{store?.name || 'ALGIONS Health Pharmacy'}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">{store?.address || 'Sector 14, Delhi - 110001'}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">Phone: {store?.phone || '+91 98765 43210'}</div>
              <div className="text-[10px] font-bold mt-1">GSTIN: {store?.gstin || '07AAAAA0000A1Z5'}</div>
              <div className="text-[10px] text-slate-600">DL 20B: {store?.dl_number_20b || 'DL-20B-12345/2026'}</div>
              <div className="text-[10px] text-slate-600">DL 21B: {store?.dl_number_21b || 'DL-21B-67890/2026'}</div>
            </div>

            {/* Invoice Meta */}
            <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-[11px]">
              <div className="flex justify-between font-bold">
                <span>Inv: {invoice.fullInvoiceNumber || invoice.full_invoice_number}</span>
                <span>Date: {(invoice.occurredAtLocal || invoice.created_at || '').slice(0, 10)}</span>
              </div>
              <div className="flex justify-between text-slate-600 text-[10px] mt-0.5">
                <span>Counter: {invoice.deviceId || 'DEV-PRIMARY-01'}</span>
                <span>Time: {(invoice.occurredAtLocal || invoice.created_at || '').slice(11, 19)}</span>
              </div>
              {invoice.customer_name && (
                <div className="text-[10px] text-slate-700 mt-1">
                  Customer: <b>{invoice.customer_name}</b> {invoice.customer_phone ? `(${invoice.customer_phone})` : ''}
                </div>
              )}
            </div>

            {/* Itemized Table */}
            <table className="w-full text-[10px] mb-2 border-b border-dashed border-slate-400 pb-2">
              <thead>
                <tr className="border-b border-slate-300 text-left font-bold">
                  <th className="py-1">Item</th>
                  <th className="py-1 text-center">Batch/Exp</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right">Amt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-slate-200">
                {(invoice.lines || []).map((l: any, i: number) => (
                  <tr key={i} className="py-1">
                    <td className="py-1 font-bold">
                      {l.product_name || l.productName}
                      <div className="text-[9px] font-normal text-slate-500">
                        MRP: {formatPaiseToINR(l.mrp_paise || l.mrpPaise)}
                      </div>
                    </td>
                    <td className="py-1 text-center font-mono">
                      {l.batch_number || l.batchNumber}<br />
                      <span className="text-[9px] text-slate-500">{l.expiry_date || l.expiryDate}</span>
                    </td>
                    <td className="py-1 text-center font-bold">{l.quantity}</td>
                    <td className="py-1 text-right font-bold tabular-nums">
                      {formatPaiseToINR(l.final_line_total_paise || l.finalLineTotalPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Financial Summary */}
            <div className="text-[11px] space-y-1 border-b border-dashed border-slate-400 pb-2 mb-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="tabular-nums font-semibold">
                  {formatPaiseToINR(invoice.subtotal_paise || invoice.subtotalPaise)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>CGST:</span>
                <span className="tabular-nums">
                  {formatPaiseToINR(invoice.cgst_total_paise || invoice.cgstTotalPaise)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>SGST:</span>
                <span className="tabular-nums">
                  {formatPaiseToINR(invoice.sgst_total_paise || invoice.sgstTotalPaise)}
                </span>
              </div>
              {(invoice.round_off_paise || invoice.roundOffPaise) !== 0 && (
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Round Off:</span>
                  <span className="tabular-nums">
                    {formatPaiseToINR(invoice.round_off_paise || invoice.roundOffPaise)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-slate-800 pt-1 text-slate-900">
                <span>GRAND TOTAL:</span>
                <span className="tabular-nums font-black">
                  {formatPaiseToINR(invoice.grand_total_paise || invoice.grandTotalPaise)}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[9px] text-slate-500 space-y-1">
              {isOfflineOrigin ? (
                <div className="font-bold text-slate-700">IRN: Pending portal sync (Offline sale)</div>
              ) : (
                <div className="font-bold text-slate-700">Payment: {(invoice.payments || [])[0]?.mode || 'CASH'}</div>
              )}
              <div>Prescription medicines dispensed by registered pharmacist.</div>
              <div>Wish you a speedy recovery!</div>
              <div className="font-mono text-[8px] text-slate-400 pt-1">
                ID: {invoice.id}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
          >
            New Sale (Esc)
          </button>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print Thermal Receipt (F10)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
