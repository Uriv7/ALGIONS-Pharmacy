import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle,
  HelpCircle,
  ShieldAlert,
  RefreshCw,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api/client.js';

export const ExceptionsScreen: React.FC = () => {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedException, setSelectedException] = useState<any | null>(null);
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState('ACCEPT_OFFLINE_OVERRIDE');
  const [resolving, setResolving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchExceptions = async () => {
    setLoading(true);
    try {
      const res = await api.getReconciliationExceptions();
      setExceptions(res.exceptions || []);
      if (res.exceptions?.length > 0 && !selectedException) {
        setSelectedException(res.exceptions[0]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, []);

  const handleResolve = async () => {
    if (!selectedException) return;
    setResolving(true);
    setMsg(null);
    try {
      await api.resolveException(selectedException.id, {
        resolutionNotes: notes || `Resolved via Owner console with action ${action}`,
        action,
      });
      setMsg('Exception resolved successfully. Store mode updated.');
      setSelectedException(null);
      await fetchExceptions();
    } catch (err: any) {
      setMsg(`Error resolving exception: ${err.message}`);
    } finally {
      setResolving(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-slate-100 overflow-hidden p-6 select-none">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Reconciliation Exceptions Queue
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
              {exceptions.filter((e) => e.status === 'PENDING').length} Pending
            </span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Owner authorization required to resolve offline inventory and sequence divergence
          </p>
        </div>
        <button
          onClick={fetchExceptions}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-lg font-semibold">
          {msg}
        </div>
      )}

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Left: Exception List */}
        <div className="w-1/3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
            Exceptions Log
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading exceptions...</div>
            ) : exceptions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-700">Zero Exceptions</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Cloud ledger and primary workstation are in complete sync.
                </div>
              </div>
            ) : (
              exceptions.map((ex) => (
                <div
                  key={ex.id}
                  onClick={() => setSelectedException(ex)}
                  className={`p-3 cursor-pointer transition flex items-center justify-between ${
                    selectedException?.id === ex.id
                      ? 'bg-teal-50 border-l-4 border-teal-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <AlertCircle
                        className={`w-3.5 h-3.5 ${
                          ex.status === 'PENDING' ? 'text-red-500' : 'text-slate-400'
                        }`}
                      />
                      <span>{ex.exceptionType}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Entity: {ex.entityId.slice(0, 16)}...
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ex.status === 'PENDING'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {ex.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Detailed Inspection & Resolution */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col p-6 overflow-y-auto">
          {selectedException ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    {selectedException.exceptionType}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Logged at {new Date(selectedException.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    selectedException.status === 'PENDING'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {selectedException.status}
                </span>
              </div>

              {/* Exception Payload Details */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono text-xs">
                <div className="text-[11px] text-slate-400 font-sans font-bold uppercase mb-2">
                  Divergence Payload Snapshot
                </div>
                <pre className="text-slate-800 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(selectedException.details, null, 2)}
                </pre>
              </div>

              {selectedException.status === 'PENDING' ? (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <ShieldAlert className="w-4 h-4 text-teal-600" />
                    <span>Owner Override Action (Step-Up Authenticated)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Resolution Strategy
                    </label>
                    <select
                      value={action}
                      onChange={(e) => setAction(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      <option value="ACCEPT_OFFLINE_OVERRIDE">
                        Accept Offline Sale & Adjust Cloud Stock (Recommended)
                      </option>
                      <option value="MARK_FOR_AUDIT">
                        Log Discrepancy & Continue Operations
                      </option>
                      <option value="MANUAL_LEDGER_REVERSAL">
                        Reverse and Post Compensating Journal Entry
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Audit Notes (Required)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Enter operational reason for override..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>

                  <button
                    onClick={handleResolve}
                    disabled={resolving}
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold rounded-lg text-xs shadow transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {resolving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>Authorize & Resolve Exception</span>
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200 text-xs text-emerald-800 font-medium">
                  <strong>Resolved:</strong> {selectedException.resolutionNotes || 'Authorized'}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
              Select an exception from the list to inspect details and resolve divergence.
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
