import React, { useState } from 'react';
import { X, Printer, Barcode as BarcodeIcon, Tag, CheckCircle } from 'lucide-react';
import { formatPaiseToINR } from '@algions/domain';

interface BarcodeLabelPrintDialogProps {
  product: {
    brandName: string;
    genericName?: string;
    strength?: string;
    barcode?: string;
    mrpPaise?: number;
    batchNumber?: string;
    expiryDate?: string;
    rackLocation?: string;
  };
  onClose: () => void;
}

export const BarcodeLabelPrintDialog: React.FC<BarcodeLabelPrintDialogProps> = ({
  product,
  onClose,
}) => {
  const [labelType, setLabelType] = useState<'THERMAL' | 'A4_SHEET'>('THERMAL');
  const [copyCount, setCopyCount] = useState<number>(4);

  const barcodeValue = product.barcode || '8901031045022';
  const mrpText = product.mrpPaise ? formatPaiseToINR(product.mrpPaise) : '₹120.00';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarcodeIcon className="w-5 h-5 text-teal-400" />
            <h3 className="font-bold text-sm">Print Barcode & Shelf Rack Labels (PRN-006)</h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-slate-800 p-0.5 rounded-lg flex text-xs font-semibold">
              <button
                onClick={() => setLabelType('THERMAL')}
                className={`px-3 py-1 rounded transition ${
                  labelType === 'THERMAL' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Thermal (50x25mm)
              </button>
              <button
                onClick={() => setLabelType('A4_SHEET')}
                className={`px-3 py-1 rounded transition ${
                  labelType === 'A4_SHEET' ? 'bg-teal-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                A4 Sheet (24-Up)
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content & Options */}
        <div className="p-5 overflow-y-auto space-y-4 bg-slate-50 flex-1">
          {/* Controls Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-teal-600" />
                Copies to Print:
              </span>
              <div className="flex items-center gap-1.5">
                {[1, 4, 12, 24].map((n) => (
                  <button
                    key={n}
                    onClick={() => setCopyCount(n)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
                      copyCount === n
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {n} Labels
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              Barcode: <span className="font-bold text-slate-800">{barcodeValue}</span>
            </span>
          </div>

          {/* Live Preview Area */}
          <div className="p-4 bg-slate-200/60 rounded-xl border border-dashed border-slate-300 flex flex-wrap gap-4 justify-center items-center overflow-y-auto max-h-80">
            {Array.from({ length: Math.min(copyCount, 24) }).map((_, idx) => (
              <div
                key={idx}
                className="w-56 bg-white p-2.5 rounded-lg border border-slate-400 shadow-sm font-sans text-slate-900 flex flex-col justify-between"
                style={{ height: '110px' }}
              >
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-200 pb-0.5">
                  <span className="text-[9px] font-black tracking-wider uppercase text-slate-700">
                    ALGIONS PHARMACY
                  </span>
                  <span className="text-[9px] font-bold font-mono text-teal-800">
                    {product.rackLocation ? `RACK: ${product.rackLocation}` : 'COUNTER'}
                  </span>
                </div>

                {/* Drug Name & Info */}
                <div className="my-0.5">
                  <div className="font-black text-xs leading-tight truncate">
                    {product.brandName} {product.strength || ''}
                  </div>
                  <div className="text-[9px] text-slate-500 truncate font-medium">
                    {product.genericName || 'Prescription Drug'}
                  </div>
                </div>

                {/* Batch & Expiry */}
                <div className="flex justify-between text-[9px] font-mono text-slate-600">
                  <span>B: {product.batchNumber || 'BATCH-01'}</span>
                  <span>EXP: {product.expiryDate?.slice(0, 7) || '12/2027'}</span>
                </div>

                {/* Barcode & Price */}
                <div className="flex justify-between items-end pt-0.5 border-t border-slate-200">
                  {/* Visual Barcode Bars */}
                  <div className="flex flex-col">
                    <div className="flex items-end h-5 gap-[1.5px] overflow-hidden">
                      {Array.from({ length: 36 }).map((_, bIdx) => {
                        const h = (bIdx % 3 === 0 ? 18 : bIdx % 2 === 0 ? 14 : 10);
                        const w = bIdx % 4 === 0 ? 2 : 1;
                        return (
                          <div
                            key={bIdx}
                            className="bg-black"
                            style={{ height: `${h}px`, width: `${w}px` }}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[8px] font-mono tracking-widest text-slate-600 mt-0.5">
                      {barcodeValue}
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="text-[8px] text-slate-400 font-bold uppercase">MRP</div>
                    <div className="text-xs font-black text-slate-900 leading-none">
                      {mrpText}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            Standard 50mm x 25mm direct thermal sticker specification compatible with TSC, Zebra & TVS label printers.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs shadow transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print {copyCount} Labels</span>
          </button>
        </div>
      </div>
    </div>
  );
};
