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
  onF11CloseShift?: () => void;
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
  onF11CloseShift,
  onEscClear,
  isSaving = false,
}) => {
  return (
    <footer className="h-12 bg-slate-800 border-t border-slate-700 px-2 sm:px-4 flex items-center justify-between text-xs text-slate-300 select-none flex-shrink-0 z-10 gap-2">
      {/* Keyboard function hints */}
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 flex-1 min-w-0 mr-1 sm:mr-2">
        <button
          onClick={onF2Search}
          className="flex-shrink-0 flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F2</kbd>
          <span className="hidden md:inline">Search</span>
        </button>

        <button
          onClick={onF3Customer}
          className="flex-shrink-0 flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F3</kbd>
          <span className="hidden md:inline">Customer</span>
        </button>

        <button
          onClick={onF4Batch}
          className="flex-shrink-0 flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F4</kbd>
          <span className="hidden md:inline">Batch</span>
        </button>

        <button
          onClick={onF5Hold}
          className="flex-shrink-0 flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F5</kbd>
          <span className="hidden md:inline">Hold</span>
        </button>

        <button
          onClick={onF6Resume}
          className="flex-shrink-0 flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F6</kbd>
          <span className="hidden md:inline">Resume</span>
        </button>

        <button
          onClick={onF7Discount}
          className="flex-shrink-0 flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F7</kbd>
          <span className="hidden md:inline">Disc %</span>
        </button>

        <button
          onClick={onF8PaymentSplit}
          className="flex-shrink-0 flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F8</kbd>
          <span className="hidden md:inline">Pay Split</span>
        </button>

        <button
          onClick={onF9Substitutes}
          className="flex-shrink-0 flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-teal-400">F9</kbd>
          <span className="hidden md:inline">Substitutes</span>
        </button>

        {onF11CloseShift && (
          <button
            onClick={onF11CloseShift}
            className="flex-shrink-0 flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-amber-300"
            title="Shift & Drawer Balancing"
          >
            <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded text-amber-400">F11</kbd>
            <span className="hidden md:inline">Close Shift</span>
          </button>
        )}

        <button
          onClick={onEscClear}
          className="flex-shrink-0 flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 active:bg-slate-500 transition text-slate-400 hover:text-white"
        >
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 rounded">Esc</kbd>
          <span className="hidden md:inline">Clear</span>
        </button>
      </div>

      {/* Primary Action Button Save & Print (F10) */}
      <button
        onClick={onF10SavePrint}
        disabled={isSaving}
        className="flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md transition disabled:opacity-50 whitespace-nowrap"
      >
        <Printer className="w-4 h-4" />
        <span>Save & Print</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-teal-800 rounded text-teal-100 font-normal">F10</kbd>
      </button>
    </footer>
  );
};
