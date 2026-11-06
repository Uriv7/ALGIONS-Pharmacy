import React, { useState } from 'react';
import { AlertOctagon, ShieldAlert, X } from 'lucide-react';
import { api } from '../../api/client.js';

interface VoidInvoiceDialogProps {
  invoice: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const VoidInvoiceDialog: React.FC<VoidInvoiceDialogProps> = ({
  invoice,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A mandatory reason is required to void an invoice.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.voidInvoice(invoice.id, reason.trim());
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to void invoice. Only Owner with step-up auth can void.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-red-200 overflow-hidden">
        <div className="p-4 bg-red-50 border-b border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
            <AlertOctagon className="w-5 h-5 text-red-600" />
            <span>Void & Reverse Invoice (Owner Only)</span>
          </div>
          <button onClick={onClose} className="text-red-400 hover:text-red-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleVoid} className="p-5 space-y-4">
          <div className="text-xs text-slate-600 leading-relaxed">
            Voiding invoice <strong className="font-mono text-slate-900">{invoice.full_invoice_number || invoice.fullInvoiceNumber}</strong> will atomically:
            <ul className="list-disc pl-5 mt-1.5 space-y-1 text-slate-500">
              <li>Restore all dispensed batch inventory via immutable <code className="text-red-600 font-mono">SALE_RETURN</code> movements.</li>
              <li>Post reverse double-entry accounting ledger entries.</li>
              <li>Append a cryptographic tamper-evident SHA-256 audit log entry.</li>
            </ul>
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Operational Reason for Void (Required for Audit Trail)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Accidental billing duplication / cashier mistake"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600 font-medium"
              required
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold rounded-lg text-xs shadow transition disabled:opacity-50"
            >
              {submitting ? 'Reversing...' : 'Confirm Void'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
