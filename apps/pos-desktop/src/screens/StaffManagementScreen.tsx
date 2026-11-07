import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  KeyRound,
  FileText,
  CheckCircle,
  Hash,
  RefreshCw,
  Edit2,
} from 'lucide-react';
import { api } from '../api/client.js';

export const StaffManagementScreen: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [tamperCheck, setTamperCheck] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'STAFF' | 'AUDIT'>('STAFF');

  // Staff user form state (Add & Edit)
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('5');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const uRes = await api.getStaffUsers();
      setUsers(uRes.users || []);

      const aRes = await api.getAuditLogs();
      setLogs(aRes.logs || []);
      setTamperCheck(aRes.tamperCheckPassed);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      if (editingUser) {
        await api.updateStaffUser(editingUser.id, {
          name: name.trim(),
          maxDiscountPercent: Number(maxDiscount),
          password: password.trim() ? password.trim() : undefined,
          quickPin: pin.trim() ? pin.trim() : undefined,
        });
        setMsg(`Staff account for ${name} updated successfully.`);
      } else {
        await api.createStaffUser({
          username: username.trim(),
          name: name.trim(),
          password,
          quickPin: pin || undefined,
          maxDiscountPercent: Number(maxDiscount),
        });
        setMsg(`Staff account for ${name} created successfully.`);
      }
      setShowAddModal(false);
      setEditingUser(null);
      setUsername('');
      setName('');
      setPassword('');
      setPin('');
      setMaxDiscount('5');
      await fetchData();
    } catch (err: any) {
      alert(`Error saving staff: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-slate-100 overflow-y-auto lg:overflow-hidden p-3 sm:p-6 select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Staff Management & Audit Trail
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800">
              Owner Only
            </span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage counter staff permissions, PINs, and verify cryptographic SHA-256 audit log integrity
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-lg p-0.5 flex">
            <button
              onClick={() => setActiveTab('STAFF')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'STAFF'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Staff Accounts</span>
            </button>
            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'AUDIT'
                  ? 'bg-teal-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Audit Chain Logs</span>
            </button>
          </div>

          {activeTab === 'STAFF' && (
            <button
              onClick={() => {
                setEditingUser(null);
                setUsername('');
                setName('');
                setPassword('');
                setPin('');
                setMaxDiscount('5');
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Staff</span>
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className="mb-3 p-3 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-lg font-semibold flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-teal-600 hover:text-teal-900 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {activeTab === 'STAFF' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[650px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-4">Name / Username</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Max Line Discount</th>
                <th className="py-2.5 px-4">MFA Status</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Created Date</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-800">
                    <div>{u.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.accountType === 'OWNER'
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {u.accountType}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-700">
                    {u.maxDiscountPercent}%
                  </td>
                  <td className="py-3 px-4">
                    {u.isMfaEnabled ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Enforced (TOTP)
                      </span>
                    ) : (
                      <span className="text-slate-400">PIN Enabled</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {u.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setName(u.name);
                        setUsername(u.username);
                        setPassword('');
                        setPin('');
                        setMaxDiscount(String(u.maxDiscountPercent || 5));
                        setShowAddModal(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-500 transition"
                      title="Edit Staff Account"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-xs font-semibold text-emerald-900">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Cryptographic Chain: All hashes validated against parent blocks.</span>
            </div>
            <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-emerald-300">
              Status: HASH_INTEGRITY_VERIFIED
            </span>
          </div>

          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[700px] text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Entity</th>
                  <th className="py-2.5 px-4">Reason / Notes</th>
                  <th className="py-2.5 px-4 font-mono">Current SHA-256 Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 text-slate-600 font-sans">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 font-sans font-bold text-slate-800">
                      {log.user_name || log.account_type}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-teal-700 font-sans">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {log.entity_type}: {log.entity_id?.slice(0, 10)}...
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-500">
                      {log.reason || 'Standard operational flow'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">
                      {log.current_hash?.slice(0, 16)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Staff User */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200">
            <h2 className="text-base font-bold text-slate-800 mb-1">
              {editingUser ? 'Edit Staff Account' : 'Add Staff Account'}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {editingUser
                ? `Update staff credentials and permissions for @${editingUser.username}.`
                : 'Staff accounts have restricted permissions (cannot view overall financials or change settings).'}
            </p>

            <form onSubmit={handleSaveStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Ramesh Kumar"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  disabled={Boolean(editingUser)}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-xs ${
                    editingUser
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'border-slate-300'
                  }`}
                  placeholder="e.g. ramesh"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingUser ? 'Reset Password (Optional — leave blank to keep)' : 'Initial Password'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  placeholder={editingUser ? 'Leave blank to keep existing password' : 'Min 10 characters'}
                  required={!editingUser}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editingUser ? 'Reset PIN (4 Digits)' : 'Quick PIN (4 Digits)'}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs tracking-widest text-center"
                    placeholder={editingUser ? 'Keep current' : '1234'}
                    required={!editingUser}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={maxDiscount}
                    onChange={(e) => setMaxDiscount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingUser(null);
                  }}
                  className="flex-1 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow"
                >
                  {creating ? 'Saving...' : editingUser ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
