import React, { useState, useEffect } from 'react';
import { Boxes, AlertTriangle, Filter, Search } from 'lucide-react';
import { api } from '../api/client.js';
import { formatPaiseToINR, isBatchNearExpiry, isBatchExpired } from '@algions/domain';

export const StockCheckScreen: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'NEAR_EXPIRY' | 'EXPIRED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      setLoading(true);
      try {
        const res = await api.getBatches();
        setBatches(res.batches || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBatches();
  }, []);

  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      b.brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.rackLocation || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterMode === 'NEAR_EXPIRY') {
      return b.isNearExpiry;
    }
    if (filterMode === 'EXPIRED') {
      return b.isExpired;
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col p-6 bg-slate-100 overflow-hidden select-none">
      {/* Top Header & Filters */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Batch Stock & Inventory (I1)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Derived balance from immutable stock ledger • Real-time batch levels
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by medicine, batch, or rack..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex bg-slate-200 p-1 rounded-lg text-xs font-semibold text-slate-600">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 rounded-md transition ${
                filterMode === 'ALL' ? 'bg-white text-slate-800 shadow' : 'hover:text-slate-900'
              }`}
            >
              All Batches ({batches.length})
            </button>
            <button
              onClick={() => setFilterMode('NEAR_EXPIRY')}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                filterMode === 'NEAR_EXPIRY'
                  ? 'bg-amber-500 text-white shadow'
                  : 'text-amber-700 hover:text-amber-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Near Expiry (≤90d)</span>
            </button>
            <button
              onClick={() => setFilterMode('EXPIRED')}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                filterMode === 'EXPIRED'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-red-600 hover:text-red-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Expired</span>
            </button>
          </div>
        </div>
      </div>

      {/* Batches Table */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4">Medicine Name</th>
                <th className="py-2.5 px-3">Salt Composition</th>
                <th className="py-2.5 px-3">Batch Number</th>
                <th className="py-2.5 px-3">Rack Location</th>
                <th className="py-2.5 px-3">Expiry Date</th>
                <th className="py-2.5 px-3 text-right">MRP</th>
                <th className="py-2.5 px-3 text-right">Sale Rate</th>
                <th className="py-2.5 px-4 text-center">Available Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading stock records...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No batches match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      {b.brandName} <span className="font-normal text-slate-500">({b.strength})</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 italic">{b.genericName}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{b.batchNumber}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                        {b.rackLocation || 'Shelf'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {b.isExpired ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5" /> Expired: {b.expiryDate}
                        </span>
                      ) : b.isNearExpiry ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3.5 h-3.5" /> Exp: {b.expiryDate} ({b.daysUntilExpiry}d)
                        </span>
                      ) : (
                        <span className="text-slate-700 font-medium">{b.expiryDate}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
                      {formatPaiseToINR(b.mrpPaise)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-800">
                      {formatPaiseToINR(b.saleRatePaise)}
                    </td>
                    <td className="py-2.5 px-4 text-center font-black text-emerald-700 text-sm">
                      {b.quantity} loose
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
