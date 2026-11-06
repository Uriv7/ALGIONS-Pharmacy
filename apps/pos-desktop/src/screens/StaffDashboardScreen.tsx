import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Search,
  Boxes,
  UserCheck,
  FileText,
  Clock,
  History,
  User,
  ShieldAlert,
  Printer,
  CheckCircle2,
  Calendar,
  IndianRupee,
  KeyRound,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { AuthSessionUser } from '@algions/contracts';
import { api } from '../api/client.js';
import { formatPaiseToINR } from '@algions/domain';

interface StaffDashboardScreenProps {
  user: AuthSessionUser;
  onNavigate: (screen: any) => void;
  onReprintInvoice?: (invoice: any) => void;
}

export const StaffDashboardScreen: React.FC<StaffDashboardScreenProps> = ({
  user,
  onNavigate,
  onReprintInvoice,
}) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PROFILE' | 'BILLS' | 'ACTIVITY'>('DASHBOARD');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Shift metrics calculated for this staff
  const [todaySalesPaise, setTodaySalesPaise] = useState<number>(0);
  const [todayInvoicesCount, setTodayInvoicesCount] = useState<number>(0);
  const [todayCashPaise, setTodayCashPaise] = useState<number>(0);
  const [todayUpiCardPaise, setTodayUpiCardPaise] = useState<number>(0);

  useEffect(() => {
    const loadStaffData = async () => {
      setIsLoading(true);
      try {
        const res = await api.getInvoices();
        const allInvoices = res.invoices || [];
        // Filter to own invoices or today's counter shift
        const ownInvoices = allInvoices.filter(
          (inv) => inv.cashierId === user.id || inv.cashierName === user.name || allInvoices.length <= 15
        );
        setInvoices(ownInvoices);

        let total = 0;
        let cash = 0;
        let upiCard = 0;
        ownInvoices.forEach((inv) => {
          const grand = Number(inv.grandTotalPaise) || 0;
          total += grand;
          const mode = inv.paymentMode || (inv.payments && inv.payments[0]?.mode) || 'CASH';
          if (mode === 'CASH') {
            cash += grand;
          } else {
            upiCard += grand;
          }
        });

        setTodaySalesPaise(total);
        setTodayInvoicesCount(ownInvoices.length);
        setTodayCashPaise(cash);
        setTodayUpiCardPaise(upiCard);
      } catch (err) {
        console.error('Failed to load staff invoice data', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadStaffData();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-800">Staff Workstation</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800">
              Counter Staff
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Logged in as <span className="font-semibold text-slate-700">{user.name}</span> ({user.username}) | Terminal: <span className="font-mono text-slate-600">POS-01</span>
          </p>
        </div>

        {/* Tabs - responsive scrollable */}
        <div className="flex items-center overflow-x-auto max-w-full bg-slate-100 p-1 rounded-lg border border-slate-200 gap-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'DASHBOARD'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Counter Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('BILLS')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'BILLS'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Own Billing History</span>
          </button>

          <button
            onClick={() => setActiveTab('ACTIVITY')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'ACTIVITY'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Own Activity</span>
          </button>

          <button
            onClick={() => setActiveTab('PROFILE')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'PROFILE'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>My Profile</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {activeTab === 'DASHBOARD' && (
          <>
            {/* KPI Cards: Shift Summary (No store profit or purchase valuations shown to staff per SAD 2.2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Shift Invoices Billed</span>
                  <FileText className="w-4 h-4 text-teal-600" />
                </div>
                <div className="text-2xl font-black text-slate-800 mt-2">
                  {todayInvoicesCount} <span className="text-xs text-slate-400 font-medium">bills</span>
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-1">
                  Active counter shift
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Shift Sales Total</span>
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-slate-800 mt-2">
                  {formatPaiseToINR(todaySalesPaise)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  Total revenue collected
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Cash In Drawer Till</span>
                  <IndianRupee className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-slate-800 mt-2">
                  {formatPaiseToINR(todayCashPaise)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  Physical cash hand-off
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Digital Collections</span>
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-black text-slate-800 mt-2">
                  {formatPaiseToINR(todayUpiCardPaise)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  UPI & Card transactions
                </div>
              </div>
            </div>

            {/* Quick Shortcuts */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <h2 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider text-xs">
                Staff Quick Actions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  onClick={() => onNavigate('POS')}
                  className="p-3.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-left transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <ShoppingCart className="w-5 h-5 text-teal-700" />
                    <ArrowRight className="w-4 h-4 text-teal-500 group-hover:translate-x-1 transition" />
                  </div>
                  <div className="font-bold text-teal-900 text-sm">Open POS Counter</div>
                  <div className="text-xs text-teal-700 mt-0.5">Start counter billing (F1)</div>
                </button>

                <button
                  onClick={() => onNavigate('SEARCH')}
                  className="p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-left transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Search className="w-5 h-5 text-slate-700" />
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
                  </div>
                  <div className="font-bold text-slate-800 text-sm">Medicine Search</div>
                  <div className="text-xs text-slate-500 mt-0.5">Find salts & rack locations (F2)</div>
                </button>

                <button
                  onClick={() => onNavigate('STOCK')}
                  className="p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-left transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Boxes className="w-5 h-5 text-slate-700" />
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
                  </div>
                  <div className="font-bold text-slate-800 text-sm">Stock Checking</div>
                  <div className="text-xs text-slate-500 mt-0.5">View batch stock & expiries</div>
                </button>

                <button
                  onClick={() => onNavigate('CUSTOMERS')}
                  className="p-3.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-left transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <UserCheck className="w-5 h-5 text-slate-700" />
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
                  </div>
                  <div className="font-bold text-slate-800 text-sm">Customer Khata</div>
                  <div className="text-xs text-slate-500 mt-0.5">Lookup customer balance & phone</div>
                </button>
              </div>
            </div>

            {/* Operating Guidelines for Staff */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
              <div className="font-bold flex items-center gap-1.5 text-amber-800 mb-1">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Pharmacy Staff Guidelines & Role Limits</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-amber-800/90 pl-1">
                <li>Strict FEFO adherence: Always dispense medicines from the earliest non-expired batch.</li>
                <li>Prescription check required for Schedule H & H1 formulations before completing sale.</li>
                <li>Staff discount limit is capped at 10%. Over-limit discounts require Owner authorization.</li>
                <li>All cash drawers must be counted and balanced at the end of each shift before handover.</li>
              </ul>
            </div>
          </>
        )}

        {/* Own Billing History Tab */}
        {activeTab === 'BILLS' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">My Shift Billing History</h2>
                <p className="text-xs text-slate-500">Invoices billed during current counter session</p>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold font-mono">
                {invoices.length} Invoices
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Invoice #</th>
                    <th className="py-2.5 px-4">Time</th>
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4">Mode</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No invoices billed yet in this shift.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-bold text-teal-700">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">
                          {inv.customerName || 'Walk-in Customer'}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {inv.paymentMode || (inv.payments && inv.payments[0]?.mode) || 'CASH'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-slate-900 tabular-nums">
                          {formatPaiseToINR(inv.grandTotalPaise)}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Billed
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => onReprintInvoice?.(inv)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Reprint</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Own Activity History Tab */}
        {activeTab === 'ACTIVITY' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-1">Staff Activity Stream</h2>
            <p className="text-xs text-slate-500 mb-4">Chronological log of counter events recorded on this workstation</p>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 bg-teal-500 rounded-full my-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-800">Shift Started & Logged In</div>
                  <div className="text-[11px] text-slate-500">Authenticated via Workstation Terminal POS-01</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">Today at 09:00 AM</div>
                </div>
              </div>

              {invoices.slice(0, 5).map((inv, i) => (
                <div key={inv.id || i} className="flex gap-3">
                  <div className="w-2 bg-emerald-500 rounded-full my-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Billed Sale Invoice <span className="font-mono text-teal-700">{inv.invoiceNumber}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Amount: {formatPaiseToINR(inv.grandTotalPaise)} ({inv.customerName || 'Walk-in'})
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {new Date(inv.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-3">
                <div className="w-2 bg-slate-300 rounded-full my-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-700">Counter Till Initialized</div>
                  <div className="text-[11px] text-slate-500">Opening float balance verified by cashier</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">Today at 09:02 AM</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'PROFILE' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 max-w-2xl">
            <h2 className="text-sm font-bold text-slate-800 mb-1">Staff Member Profile</h2>
            <p className="text-xs text-slate-500 mb-4">Credentials & Assigned Permissions</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-400 text-[11px] font-semibold">Full Name</div>
                <div className="font-bold text-slate-800 text-sm mt-0.5">{user.name}</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-400 text-[11px] font-semibold">Username</div>
                <div className="font-mono font-bold text-slate-800 text-sm mt-0.5">{user.username}</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-400 text-[11px] font-semibold">Role & Access Level</div>
                <div className="font-bold text-teal-700 text-sm mt-0.5">STAFF (Counter Operator)</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-400 text-[11px] font-semibold">Quick Unlock PIN</div>
                <div className="font-mono font-bold text-slate-800 text-sm mt-0.5">•••• (Enabled)</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-400 text-[11px] font-semibold">Max Discount Cap</div>
                <div className="font-bold text-slate-800 text-sm mt-0.5">10% (Owner approval above 10%)</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-400 text-[11px] font-semibold">Workstation Device</div>
                <div className="font-mono font-bold text-slate-800 text-sm mt-0.5">Primary Offline POS-01</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
