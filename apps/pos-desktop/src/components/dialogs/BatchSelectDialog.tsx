import React from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatPaiseToINR, isBatchExpired, isBatchNearExpiry } from '@algions/domain';

interface BatchSelectDialogProps {
  productName: string;
  batches: any[];
  selectedBatchId: string;
  onSelectBatch: (batch: any) => void;
  onClose: () => void;
}

export const BatchSelectDialog: React.FC<BatchSelectDialogProps> = ({
  productName,
  batches,
  selectedBatchId,
  onSelectBatch,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Select Batch (F4)</h3>
            <p className="text-xs text-slate-500 font-medium">{productName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Batch List */}
        <div className="p-3 max-h-80 overflow-y-auto space-y-2">
          {batches.map((b) => {
            const isExpired = isBatchExpired(b.expiryDate);
            const isNearExp = isBatchNearExpiry(b.expiryDate, 90);
            const isSelected = b.id === selectedBatchId;

            return (
              <div
                key={b.id}
                onClick={() => {
                  if (!isExpired) {
                    onSelectBatch(b);
                    onClose();
                  }
                }}
                className={`p-3 rounded-lg border transition flex items-center justify-between ${
                  isExpired
                    ? 'bg-red-50 border-red-200 opacity-60 cursor-not-allowed'
                    : isSelected
                    ? 'bg-teal-50 border-teal-600 ring-2 ring-teal-600/30 cursor-pointer'
                    : 'bg-white border-slate-200 hover:border-teal-400 cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800 text-sm">{b.batchNumber}</span>
                    {isSelected && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-teal-600 text-white font-bold">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                    <span>
                      Stock: <b className="text-slate-800 font-bold">{b.quantity} loose</b>
                    </span>
                    <span>
                      Rack: <b className="text-slate-700">{b.rackLocation || 'Shelf'}</b>
                    </span>
                    <span>
                      MRP: <b className="text-slate-700">{formatPaiseToINR(b.mrpPaise)}</b>
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  {isExpired ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700">
                      <AlertTriangle className="w-3.5 h-3.5" /> Expired: {b.expiryDate}
                    </span>
                  ) : isNearExp ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5" /> Exp: {b.expiryDate}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-700">
                      Exp: {b.expiryDate}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-700 transition"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
