import React, { useRef, useState } from 'react';
import { X, Printer, CheckCircle, FileText, LayoutTemplate } from 'lucide-react';
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
  const [printFormat, setPrintFormat] = useState<'THERMAL' | 'A4'>('THERMAL');
  const isOfflineOrigin = Boolean(invoice.is_offline_origin || invoice.isOfflineOrigin);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className={`bg-white rounded-2xl shadow-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] ${
        printFormat === 'A4' ? 'max-w-3xl' : 'max-w-md'
      }`}>
        {/* Modal Header */}
        <div className="px-4 py-3 bg-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm">Invoice Finalized & Ready for Print</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Format Switcher */}
            <div className="bg-slate-700 p-0.5 rounded-lg flex text-xs font-semibold">
              <button
                onClick={() => setPrintFormat('THERMAL')}
                className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
                  printFormat === 'THERMAL' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Thermal 80mm</span>
              </button>
              <button
                onClick={() => setPrintFormat('A4')}
                className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
                  printFormat === 'A4' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>A4 Tax Invoice</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex justify-center">
          {printFormat === 'THERMAL' ? (
            /* 80mm ESC/POS Thermal Receipt */
            <div
              ref={printRef}
              className="w-[320px] bg-white p-4 shadow-md border border-slate-300 font-mono text-xs text-slate-900 leading-tight"
            >
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
          ) : (
            /* A4 GST TAX INVOICE FORMAT */
            <div
              ref={printRef}
              className="w-full bg-white p-6 shadow-md border border-slate-300 font-sans text-xs text-slate-900 leading-normal"
            >
              <div className="border border-slate-800 p-4">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div>
                    <h1 className="text-lg font-black text-slate-900 uppercase">
                      {store?.legal_name || 'ALGIONS AI LABS PRIVATE LIMITED'}
                    </h1>
                    <div className="text-xs font-bold text-slate-700">{store?.name || 'ALGIONS Health Pharmacy'}</div>
                    <div className="text-[11px] text-slate-600 max-w-sm mt-0.5">{store?.address || 'Sector 14, Delhi - 110001'}</div>
                    <div className="text-[11px] text-slate-600">Phone: {store?.phone || '+91 98765 43210'} | Email: contact@algions.com</div>
                    <div className="text-[11px] font-bold mt-1 text-slate-800">
                      GSTIN: {store?.gstin || '07AAAAA0000A1Z5'}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      Drug License No: {store?.dl_number_20b || 'DL-20B-12345/2026'}, {store?.dl_number_21b || 'DL-21B-67890/2026'}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="px-3 py-1 bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded">
                      TAX INVOICE
                    </span>
                    <div className="mt-2 text-xs font-bold text-slate-900">
                      Invoice No: <span className="font-mono text-teal-800">{invoice.fullInvoiceNumber || invoice.full_invoice_number}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Date: {(invoice.occurredAtLocal || invoice.created_at || '').slice(0, 10)}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Time: {(invoice.occurredAtLocal || invoice.created_at || '').slice(11, 19)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                      POS Counter: {invoice.deviceId || 'DEV-PRIMARY-01'}
                    </div>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="grid grid-cols-2 gap-4 py-2 border-b border-slate-800 text-[11px]">
                  <div>
                    <span className="font-bold text-slate-800 uppercase tracking-wide">Billed To (Customer):</span>
                    <div className="font-semibold text-slate-900 mt-0.5">{invoice.customer_name || 'Cash Customer'}</div>
                    {invoice.customer_phone && <div className="text-slate-600">Phone: {invoice.customer_phone}</div>}
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 uppercase tracking-wide">Prescription / Doctor:</span>
                    <div className="text-slate-700 mt-0.5">{invoice.doctor_name || 'Self / Over-The-Counter'}</div>
                  </div>
                </div>

                {/* Table */}
                <table className="w-full text-[11px] my-3 border border-slate-300">
                  <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 text-[10px]">
                    <tr>
                      <th className="p-1.5 text-left">S.No</th>
                      <th className="p-1.5 text-left">Description of Goods</th>
                      <th className="p-1.5 text-center">HSN</th>
                      <th className="p-1.5 text-center">Batch</th>
                      <th className="p-1.5 text-center">Expiry</th>
                      <th className="p-1.5 text-center">Qty</th>
                      <th className="p-1.5 text-right">MRP</th>
                      <th className="p-1.5 text-right">Taxable</th>
                      <th className="p-1.5 text-center">GST %</th>
                      <th className="p-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(invoice.lines || []).map((l: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="p-1.5 text-center font-bold text-slate-500">{i + 1}</td>
                        <td className="p-1.5 font-bold text-slate-900">{l.product_name || l.productName}</td>
                        <td className="p-1.5 text-center font-mono text-[10px]">{l.hsn_code || '3004'}</td>
                        <td className="p-1.5 text-center font-mono font-bold">{l.batch_number || l.batchNumber}</td>
                        <td className="p-1.5 text-center font-mono">{l.expiry_date || l.expiryDate}</td>
                        <td className="p-1.5 text-center font-bold">{l.quantity}</td>
                        <td className="p-1.5 text-right font-medium">{formatPaiseToINR(l.mrp_paise || l.mrpPaise)}</td>
                        <td className="p-1.5 text-right">{formatPaiseToINR(l.taxable_amount_paise || l.taxableAmountPaise || l.final_line_total_paise || l.finalLineTotalPaise)}</td>
                        <td className="p-1.5 text-center font-semibold">{l.tax_rate_percent || l.taxRatePercent || 12}%</td>
                        <td className="p-1.5 text-right font-bold tabular-nums">{formatPaiseToINR(l.final_line_total_paise || l.finalLineTotalPaise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals & GST Summary */}
                <div className="flex justify-between border-t border-slate-800 pt-2 text-[11px]">
                  <div className="text-[10px] text-slate-600 max-w-sm">
                    <strong>Terms & Conditions:</strong><br />
                    1. Goods once sold will be taken back within 7 days in original condition.<br />
                    2. Medicines requiring cold storage (&lt;8°C) are non-returnable.<br />
                    3. All disputes subject to local jurisdiction only.
                  </div>

                  <div className="w-64 space-y-1 text-right">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Subtotal:</span>
                      <span className="font-semibold">{formatPaiseToINR(invoice.subtotal_paise || invoice.subtotalPaise)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST:</span>
                      <span>{formatPaiseToINR(invoice.cgst_total_paise || invoice.cgstTotalPaise)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST:</span>
                      <span>{formatPaiseToINR(invoice.sgst_total_paise || invoice.sgstTotalPaise)}</span>
                    </div>
                    {(invoice.round_off_paise || invoice.roundOffPaise) !== 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>Round Off:</span>
                        <span>{formatPaiseToINR(invoice.round_off_paise || invoice.roundOffPaise)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-black border-t border-slate-800 pt-1 text-slate-900">
                      <span>Grand Total:</span>
                      <span>{formatPaiseToINR(invoice.grand_total_paise || invoice.grandTotalPaise)}</span>
                    </div>
                  </div>
                </div>

                {/* Signatory */}
                <div className="mt-8 pt-4 border-t border-dashed border-slate-400 flex justify-between items-end text-[10px]">
                  <div>Pharmacist License Reg. No: <strong>DEL/PHARM/77889</strong></div>
                  <div className="text-center">
                    <div className="w-40 border-b border-slate-800 mb-1" />
                    <span className="font-bold">For ALGIONS AI LABS PVT LTD</span><br />
                    <span>Authorized Signatory</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
          >
            Done (Esc)
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs shadow transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print {printFormat === 'THERMAL' ? 'Thermal Receipt (F10)' : 'A4 Invoice'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
