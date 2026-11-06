import React, { useState, useEffect } from 'react';
import { X, UserPlus, Phone, User, Check, Search, CreditCard } from 'lucide-react';
import { api } from '../../api/client.js';
import { formatPaiseToINR } from '@algions/domain';

interface CustomerDialogProps {
  onSelectCustomer: (customer: { id?: string; name: string; phone: string; balancePaise: number; creditLimitPaise?: number }) => void;
  onClose: () => void;
}

export const CustomerDialog: React.FC<CustomerDialogProps> = ({ onSelectCustomer, onClose }) => {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const term = phone.trim() || name.trim();
    if (term.length >= 3) {
      setIsSearching(true);
      const timer = setTimeout(async () => {
        try {
          const res = await api.getCustomers(term);
          setSearchResults(res.customers || []);
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [phone, name]);

  const handleSelectExisting = (c: any) => {
    onSelectCustomer({
      id: c.id,
      name: c.name,
      phone: c.phone,
      balancePaise: c.currentBalancePaise || 0,
      creditLimitPaise: c.creditLimitPaise || 0,
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    onSelectCustomer({
      name: name.trim(),
      phone: phone.trim(),
      balancePaise: 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-teal-600" />
            <h3 className="font-bold text-slate-800 text-sm">Customer Details (F3)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>
          </div>

          {/* Autocomplete suggestions */}
          {searchResults.length > 0 && (
            <div className="border border-slate-200 rounded-lg max-h-36 overflow-y-auto divide-y divide-slate-100 bg-slate-50">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 bg-slate-100/70">
                Found Matching Customers ({searchResults.length}):
              </div>
              {searchResults.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelectExisting(c)}
                  className="px-3 py-2 hover:bg-teal-50 cursor-pointer flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-800">{c.name}</div>
                    <div className="text-[11px] text-slate-500">{c.phone}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-teal-700">Select</span>
                    {c.currentBalancePaise > 0 && (
                      <div className="text-[10px] text-red-600 font-bold">
                        Bal: {formatPaiseToINR(c.currentBalancePaise)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Attach Customer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
