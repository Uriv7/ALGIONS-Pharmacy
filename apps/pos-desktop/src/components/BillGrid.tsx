import React, { useRef } from 'react';
import { Trash2, AlertTriangle, Search, Barcode } from 'lucide-react';
import { formatPaiseToINR, isBatchNearExpiry, isBatchExpired, formatPackQuantity } from '@algions/domain';

export interface BillGridLine {
  id: string; // client line id
  productId: string;
  productName: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  mrpPaise: number;
  saleRatePaise: number;
  quantity: number; // total loose units
  unitsPerPack: number;
  packUnitLabel?: string;
  looseUnitLabel?: string;
  discountPercent: number;
  taxRatePercent: number;
  availableStock: number;
  rackLocation?: string;
}

interface BillGridProps {
  lines: BillGridLine[];
  focusedIndex: number;
  searchInput: string;
  searchResults: any[];
  isSearching: boolean;
  onSearchChange: (val: string) => void;
  onSelectSearchResult: (result: any) => void;
  onLineClick: (index: number) => void;
  onQuantityChange: (index: number, newQty: number) => void;
  onDiscountChange: (index: number, newDiscount: number) => void;
  onRemoveLine: (index: number) => void;
  onBarcodeScanSubmit: (barcode: string) => void;
}

export const BillGrid: React.FC<BillGridProps> = ({
  lines,
  focusedIndex,
  searchInput,
  searchResults,
  isSearching,
  onSearchChange,
  onSelectSearchResult,
  onLineClick,
  onQuantityChange,
  onDiscountChange,
  onRemoveLine,
  onBarcodeScanSubmit,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchResults.length > 0) {
        onSelectSearchResult(searchResults[0]);
      } else if (searchInput.trim()) {
        onBarcodeScanSubmit(searchInput.trim());
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
      {/* Top Item Entry Bar */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3 relative">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scan barcode or type medicine brand / salt name (F2 to focus)..."
            className="w-full pl-9 pr-12 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 font-medium"
            autoFocus
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
            <Barcode className="w-5 h-5 text-slate-400" />
          </div>

          {/* Autocomplete Dropdown */}
          {searchInput.length >= 2 && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-72 overflow-y-auto z-30">
              {searchResults.map((res: any, idx) => {
                const p = res.product;
                const hasStock = res.totalStockUnits > 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectSearchResult(res)}
                    className={`px-3 py-2 border-b border-slate-100 flex items-center justify-between cursor-pointer transition ${
                      idx === 0 ? 'bg-teal-50/70 hover:bg-teal-100/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{p.brandName}</span>
                        <span className="text-xs text-slate-500">{p.strength}</span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                          {p.dosageForm}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 italic mt-0.5">
                        {p.genericName} • <span className="text-slate-400">{p.manufacturer}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-semibold">
                        {hasStock ? (
                          <span className="text-emerald-700 font-bold">
                            {res.totalStockPacksFormatted} in stock
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold">Out of stock</span>
                        )}
                      </div>
                      {res.nearestExpiryDate && (
                        <div className="text-[11px] text-slate-400">Exp: {res.nearestExpiryDate}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bill Items Grid (TanStack / Table style) */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead className="bg-slate-100 text-slate-600 sticky top-0 border-b border-slate-200 z-10 font-semibold select-none">
            <tr>
              <th className="py-2.5 px-3 w-8 text-center">#</th>
              <th className="py-2.5 px-3">Item Details</th>
              <th className="py-2.5 px-3 w-24">Batch</th>
              <th className="py-2.5 px-3 w-24">Expiry</th>
              <th className="py-2.5 px-3 w-20 text-right">MRP</th>
              <th className="py-2.5 px-3 w-24 text-center">Qty (Units)</th>
              <th className="py-2.5 px-3 w-20 text-right">Rate</th>
              <th className="py-2.5 px-3 w-16 text-center">Disc %</th>
              <th className="py-2.5 px-3 w-16 text-center">Tax %</th>
              <th className="py-2.5 px-3 w-24 text-right">Amount</th>
              <th className="py-2.5 px-2 w-8 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-16 text-center text-slate-400">
                  <div className="max-w-xs mx-auto">
                    <p className="text-sm font-semibold text-slate-600 mb-1">No items on bill</p>
                    <p className="text-xs text-slate-400">
                      Scan product barcode or press <kbd className="px-1 bg-slate-200 rounded font-bold">F2</kbd> to search medicine.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              lines.map((line, idx) => {
                const isFocused = idx === focusedIndex;
                const isExpired = isBatchExpired(line.expiryDate);
                const isNearExp = isBatchNearExpiry(line.expiryDate, 90);
                const grossLineAmount = line.saleRatePaise * line.quantity;
                const discountAmount = Math.round((grossLineAmount * line.discountPercent) / 100);
                const finalLineAmount = grossLineAmount - discountAmount;

                return (
                  <tr
                    key={line.id}
                    onClick={() => onLineClick(idx)}
                    className={`cursor-pointer transition ${
                      isFocused ? 'bg-teal-50/60 font-medium' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-800">{line.productName}</div>
                      <div className="text-[11px] text-slate-500">
                        {line.genericName} • {line.strength}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-700">{line.batchNumber}</td>
                    <td className="py-2 px-3">
                      {isExpired ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3" /> {line.expiryDate}
                        </span>
                      ) : isNearExp ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3 h-3" /> {line.expiryDate}
                        </span>
                      ) : (
                        <span className="text-slate-600">{line.expiryDate}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-600">
                      {formatPaiseToINR(line.mrpPaise)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="inline-flex items-center justify-center">
                        <input
                          type="number"
                          min={1}
                          max={line.availableStock}
                          value={line.quantity}
                          onChange={(e) => onQuantityChange(idx, parseInt(e.target.value, 10) || 1)}
                          className="w-14 text-center py-1 px-1 bg-white border border-slate-300 rounded font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {formatPackQuantity(line.quantity, line.unitsPerPack, line.packUnitLabel, line.looseUnitLabel)}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-700 font-medium">
                      {formatPaiseToINR(line.saleRatePaise)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={line.discountPercent}
                        onChange={(e) => onDiscountChange(idx, parseFloat(e.target.value) || 0)}
                        className="w-12 text-center py-1 px-1 bg-white border border-slate-300 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-600"
                      />
                    </td>
                    <td className="py-2 px-3 text-center text-slate-500">{line.taxRatePercent}%</td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-800 text-sm">
                      {formatPaiseToINR(finalLineAmount)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveLine(idx);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 transition rounded"
                        title="Delete line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
