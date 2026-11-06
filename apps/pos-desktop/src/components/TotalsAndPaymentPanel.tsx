import React from 'react';
import { User, Phone, MapPin, CreditCard, Banknote, QrCode, Building, CheckCircle2 } from 'lucide-react';
import { formatPaiseToINR, CalculatedInvoiceTotals } from '@algions/domain';
import { BillGridLine } from './BillGrid.js';

interface TotalsAndPaymentPanelProps {
  customer: { id?: string; name: string; phone: string; balancePaise: number } | null;
  focusedLine: BillGridLine | null;
  totals: CalculatedInvoiceTotals;
  billDiscountPercent: number;
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'BANK' | 'CREDIT';
  cashReceivedInput: string;
  onSelectCustomerClick: () => void;
  onBillDiscountChange: (val: number) => void;
  onPaymentModeChange: (mode: 'CASH' | 'UPI' | 'CARD' | 'BANK' | 'CREDIT') => void;
  onCashReceivedChange: (val: string) => void;
  onQuickCashAmount: (amountPaise: number) => void;
}

export const TotalsAndPaymentPanel: React.FC<TotalsAndPaymentPanelProps> = ({
  customer,
  focusedLine,
  totals,
  billDiscountPercent,
  paymentMode,
  cashReceivedInput,
  onSelectCustomerClick,
  onBillDiscountChange,
  onPaymentModeChange,
  onCashReceivedChange,
  onQuickCashAmount,
}) => {
  const cashGivenPaise = Math.round((parseFloat(cashReceivedInput) || 0) * 100);
  const changeToReturnPaise = Math.max(0, cashGivenPaise - totals.grandTotalPaise);

  return (
    <div className="w-[380px] bg-slate-50 flex flex-col justify-between overflow-y-auto border-l border-slate-200 p-4 select-none flex-shrink-0">
      {/* 1. Customer Card (F3) */}
      <div className="mb-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Customer Details
          </div>
          <button
            onClick={onSelectCustomerClick}
            className="text-xs text-teal-600 font-semibold hover:text-teal-700 hover:underline"
          >
            {customer ? 'Change (F3)' : '+ Add Customer (F3)'}
          </button>
        </div>

        {customer ? (
          <div>
            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{customer.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{customer.phone}</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic">
            Counter Cash Sale (Walk-in Customer)
          </div>
        )}
      </div>

      {/* 2. Focused Line Batch & Stock Info */}
      {focusedLine && (
        <div className="mb-3 bg-white p-3 rounded-xl border border-teal-100 bg-teal-50/40 text-xs">
          <div className="font-bold text-teal-900 truncate">{focusedLine.productName}</div>
          <div className="grid grid-cols-2 gap-2 mt-1.5 text-[11px] text-slate-600">
            <div>
              <span className="text-slate-400">Batch:</span>{' '}
              <span className="font-mono font-semibold">{focusedLine.batchNumber}</span>
            </div>
            <div>
              <span className="text-slate-400">Rack:</span>{' '}
              <span className="font-semibold text-slate-800">{focusedLine.rackLocation || 'Shelf'}</span>
            </div>
            <div>
              <span className="text-slate-400">Available:</span>{' '}
              <span className="font-bold text-emerald-700">{focusedLine.availableStock} loose</span>
            </div>
            <div>
              <span className="text-slate-400">Expiry:</span>{' '}
              <span className="font-semibold">{focusedLine.expiryDate}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Financial Totals Breakdown */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm mb-3">
        <div className="space-y-1.5 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Gross Total ({totals.itemCount} items):</span>
            <span className="tabular-nums font-semibold">{formatPaiseToINR(totals.grossTotalPaise)}</span>
          </div>

          {totals.lineDiscountTotalPaise > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Item Discounts:</span>
              <span className="tabular-nums">-{formatPaiseToINR(totals.lineDiscountTotalPaise)}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <span>Bill Discount (F7):</span>
              <input
                type="number"
                min={0}
                max={50}
                value={billDiscountPercent}
                onChange={(e) => onBillDiscountChange(parseFloat(e.target.value) || 0)}
                className="w-10 text-center py-0.5 px-1 bg-slate-100 border border-slate-300 rounded text-xs font-bold"
              />
              <span>%</span>
            </span>
            <span className="tabular-nums font-medium text-emerald-600">
              -{formatPaiseToINR(totals.billDiscountPaise)}
            </span>
          </div>

          <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-100">
            <span>Taxable Value:</span>
            <span className="tabular-nums">{formatPaiseToINR(totals.taxableTotalPaise)}</span>
          </div>

          <div className="flex justify-between text-slate-500 text-[11px]">
            <span>CGST (Output):</span>
            <span className="tabular-nums">+{formatPaiseToINR(totals.cgstTotalPaise)}</span>
          </div>

          <div className="flex justify-between text-slate-500 text-[11px]">
            <span>SGST (Output):</span>
            <span className="tabular-nums">+{formatPaiseToINR(totals.sgstTotalPaise)}</span>
          </div>

          {totals.roundOffPaise !== 0 && (
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Round Off:</span>
              <span className="tabular-nums">
                {totals.roundOffPaise > 0 ? '+' : ''}
                {formatPaiseToINR(totals.roundOffPaise)}
              </span>
            </div>
          )}
        </div>

        {/* Grand Total (32px bold per FES 3.1) */}
        <div className="mt-3 pt-3 border-t-2 border-slate-800 flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Net Payable:</span>
          <span className="text-2xl font-black text-teal-800 tabular-nums">
            {formatPaiseToINR(totals.grandTotalPaise)}
          </span>
        </div>
      </div>

      {/* 4. Payment Method & Split Panel (F8) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Payment Method (F8)
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <button
              onClick={() => onPaymentModeChange('CASH')}
              className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition border ${
                paymentMode === 'CASH'
                  ? 'bg-teal-600 text-white border-teal-600 shadow'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span>Cash</span>
            </button>

            <button
              onClick={() => onPaymentModeChange('UPI')}
              className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition border ${
                paymentMode === 'UPI'
                  ? 'bg-teal-600 text-white border-teal-600 shadow'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>UPI / QR</span>
            </button>

            <button
              onClick={() => onPaymentModeChange('CARD')}
              className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition border ${
                paymentMode === 'CARD'
                  ? 'bg-teal-600 text-white border-teal-600 shadow'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Card</span>
            </button>
          </div>

          {/* Cash Received & Change Return Calculator */}
          {paymentMode === 'CASH' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Cash Received:</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={cashReceivedInput}
                    onChange={(e) => onCashReceivedChange(e.target.value)}
                    placeholder={(totals.grandTotalPaise / 100).toFixed(0)}
                    className="w-28 pl-6 pr-2 py-1 text-right bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex gap-1.5 justify-end">
                {[100, 200, 500, 2000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => onQuickCashAmount(amt * 100)}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 transition"
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>

              {changeToReturnPaise > 0 && (
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between text-xs text-emerald-800 font-bold">
                  <span>Change to Return:</span>
                  <span className="text-sm font-black text-emerald-700">
                    {formatPaiseToINR(changeToReturnPaise)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
