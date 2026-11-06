import React from 'react';
import { Printer } from 'lucide-react';

interface FunctionKeysBarProps {
  onF2Search: () => void;
  onF3Customer: () => void;
  onF4Batch: () => void;
  onF5Hold: () => void;
  onF6Resume: () => void;
  onF7Discount: () => void;
  onF8PaymentSplit: () => void;
  onF9Substitutes: () => void;
  onF10SavePrint: () => void;
  onEscClear: () => void;
  isSaving?: boolean;
}

export const FunctionKeysBar: React.FC<FunctionKeysBarProps> = ({
  onF2Search,
  onF3Customer,
  onF4Batch,
  onF5Hold,
  onF6Resume,
  onF7Discount,
  onF8PaymentSplit,
  onF9Substitutes,
  onF10SavePrint,
  onEscClear,
  isSaving = false,
}) => {
  return (
    <footer className="h-12 bg-slate-800 border-t border-slate-700 px-4 flex items-center justify-between text-xs text-slate-300 select-none flex-shrink-0 z-10">
      {/* Keyboard function hints */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
        <button
          onClick={onF2Search}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F2</kbd>
          <span>Search</span>
        </button>

        <button
          onClick={onF3Customer}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F3</kbd>
          <span>Customer</span>
        </button>

        <button
          onClick={onF4Batch}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F4</kbd>
          <span>Batch</span>
        </button>

        <button
          onClick={onF5Hold}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F5</kbd>
          <span>Hold</span>
        </button>

        <button
          onClick={onF6Resume}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F6</kbd>
          <span>Resume</span>
        </button>

        <button
          onClick={onF7Discount}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F7</kbd>
          <span>Disc %</span>
        </button>

        <button
          onClick={onF8PaymentSplit}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F8</kbd>
          <span>Pay Split</span>
        </button>

        <button
          onClick={onF9Substitutes}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F9</kbd>
          <span>Substitutes</span>
        </button>

        <button
          onClick={onEscClear}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-slate-400 hover:text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded">Esc</kbd>
          <span>Clear</span>
        </button>
      </div>

      {/* Primary Action Button Save & Print (F10) */}
      <button
        onClick={onF10SavePrint}
        disabled={isSaving}
        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
      >
        <Printer className="w-4 h-4" />
        <span>Save & Print</span>
        <kbd className="px-1.5 py-0.5 text-[10px] bg-teal-800 rounded text-teal-100 font-normal">F10</kbd>
      </button>
    </footer>
  );
};
