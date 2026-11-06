import React from 'react';
import { X, Play, Trash2, Clock } from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';

interface HeldBillsDialogProps {
  heldBills: any[];
  onResume: (bill: any) => void;
  onDiscard: (id: string) => void;
  onClose: () => void;
}

export const HeldBillsDialog: React.FC<HeldBillsDialogProps> = ({
  heldBills,
  onResume,
  onDiscard,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-slate-800 text-sm">Held Bills (F6)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 max-h-80 overflow-y-auto space-y-2">
          {heldBills.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No bills currently on hold. Press F5 during billing to park an active bill.
            </div>
          ) : (
            heldBills.map((b) => (
              <div
                key={b.id}
                className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-800 text-sm">
                    {b.customerName || 'Walk-in Customer'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {b.lines?.length || 0} items • Held at {new Date(b.heldAt).toLocaleTimeString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onResume(b);
                      onClose();
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                  <button
                    onClick={() => onDiscard(b.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                    title="Discard held bill"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
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
