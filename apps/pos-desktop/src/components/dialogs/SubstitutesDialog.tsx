import React from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';

interface SubstitutesDialogProps {
  productName: string;
  genericName?: string;
  strength?: string;
  substitutes: any[];
  onSelectSubstitute: (substitute: any) => void;
  onClose: () => void;
}

export const SubstitutesDialog: React.FC<SubstitutesDialogProps> = ({
  productName,
  genericName,
  strength,
  substitutes,
  onSelectSubstitute,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Generic Substitutes (F9)</h3>
              <p className="text-xs text-slate-500 font-medium">
                Active Salt: <span className="font-bold text-teal-800">{genericName}</span> ({strength})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Substitutes List */}
        <div className="p-4 max-h-80 overflow-y-auto space-y-2.5">
          {substitutes.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No direct same-salt alternatives currently registered in stock.
            </div>
          ) : (
            substitutes.map((s) => (
              <div
                key={s.id}
                onClick={() => {
                  onSelectSubstitute(s);
                  onClose();
                }}
                className="p-3 rounded-lg border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 cursor-pointer transition flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-800 text-sm">{s.brandName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Mfg: <span className="font-medium text-slate-700">{s.manufacturer}</span>
                  </div>
                </div>

                <div className="text-right">
                  <button className="px-3 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition">
                    Replace
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
