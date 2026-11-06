import React, { useState, useEffect } from 'react';
import { Search, Boxes, MapPin, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { api } from '../api/client.js';
import { formatPaiseToINR, isBatchNearExpiry, isBatchExpired } from '@algions/domain';

interface MedicineSearchScreenProps {
  onSelectItemForBilling: (product: any, batch: any) => void;
}

export const MedicineSearchScreen: React.FC<MedicineSearchScreenProps> = ({
  onSelectItemForBilling,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await api.searchProducts(query);
        setResults(res.results || []);
        if (res.results?.length > 0 && !selectedProduct) {
          setSelectedProduct(res.results[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchResults, 150);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-100 select-none">
      {/* Left List */}
      <div className="w-[500px] flex flex-col bg-white border-r border-slate-200">
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by brand name, generic salt, or manufacturer..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Searching catalog...</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No medicines found matching "{query}"</div>
          ) : (
            results.map((item) => {
              const p = item.product;
              const isSelected = selectedProduct?.product.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProduct(item)}
                  className={`p-3 cursor-pointer transition ${
                    isSelected ? 'bg-teal-50/70 border-l-4 border-teal-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm">{p.brandName}</span>
                    <span className="text-xs font-bold text-slate-600">{p.strength}</span>
                  </div>
                  <div className="text-xs text-slate-500 italic mt-0.5">{p.genericName}</div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>{p.manufacturer}</span>
                    <span className={item.totalStockUnits > 0 ? 'text-emerald-700 font-bold' : 'text-rose-600'}>
                      {item.totalStockPacksFormatted} in stock
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Detail Pane */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        {selectedProduct ? (
          <div className="space-y-6 max-w-3xl">
            {/* Header info */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedProduct.product.brandName}</h2>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Composition: <span className="font-semibold text-teal-800">{selectedProduct.product.genericName}</span> ({selectedProduct.product.strength})
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
                    {selectedProduct.product.dosageForm}
                  </span>
                  <div className="text-xs text-slate-400 mt-1 font-mono">
                    HSN: {selectedProduct.product.hsnCode} • GST: {selectedProduct.product.taxRatePercent}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400">Manufacturer:</span>
                  <div className="font-bold text-slate-800">{selectedProduct.product.manufacturer}</div>
                </div>
                <div>
                  <span className="text-slate-400">Rack / Shelf Location:</span>
                  <div className="font-bold text-slate-800 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    <span>{selectedProduct.product.rackLocation || 'Not Assigned'}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Packaging:</span>
                  <div className="font-bold text-slate-800">
                    1 {selectedProduct.product.packUnitLabel} = {selectedProduct.product.unitsPerPack} {selectedProduct.product.looseUnitLabel}s
                  </div>
                </div>
              </div>
            </div>

            {/* Batches Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-teal-600" />
                  <h3 className="font-bold text-slate-800 text-sm">Available Batches (FEFO Sorted)</h3>
                </div>
              </div>

              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Batch No</th>
                    <th className="py-2.5 px-3">Expiry Date</th>
                    <th className="py-2.5 px-3 text-right">MRP</th>
                    <th className="py-2.5 px-3 text-right">Sale Rate</th>
                    <th className="py-2.5 px-3 text-center">Available Stock</th>
                    <th className="py-2.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedProduct.batches?.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No active stock for this product.
                      </td>
                    </tr>
                  ) : (
                    selectedProduct.batches?.map((b: any) => {
                      const isExpired = isBatchExpired(b.expiryDate);
                      const isNearExp = isBatchNearExpiry(b.expiryDate, 90);
                      return (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                            {b.batchNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            {isExpired ? (
                              <span className="text-red-600 font-bold">Expired: {b.expiryDate}</span>
                            ) : isNearExp ? (
                              <span className="text-amber-700 font-bold">Near Expiry: {b.expiryDate}</span>
                            ) : (
                              <span className="text-slate-700">{b.expiryDate}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
                            {formatPaiseToINR(b.mrpPaise)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-800">
                            {formatPaiseToINR(b.saleRatePaise)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                            {b.quantity} units
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => onSelectItemForBilling(selectedProduct.product, b)}
                              disabled={isExpired}
                              className="px-3 py-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded text-xs font-bold transition shadow"
                            >
                              Add to Bill
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
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            Select a medicine from the search list to inspect stock and batches.
          </div>
        )}
      </div>
    </div>
  );
};
