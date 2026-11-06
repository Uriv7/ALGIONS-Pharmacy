import React, { useState, useEffect } from 'react';
import {
  Pill,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Boxes,
  Barcode,
  Layers,
  MapPin,
  CheckCircle,
} from 'lucide-react';
import { api } from '../api/client.js';
import { AuthSessionUser } from '@algions/contracts';

interface MedicineMasterScreenProps {
  user: AuthSessionUser;
}

export const MedicineMasterScreen: React.FC<MedicineMasterScreenProps> = ({ user }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  // Form Fields
  const [brandName, setBrandName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [strength, setStrength] = useState('');
  const [dosageForm, setDosageForm] = useState('TABLET');
  const [manufacturer, setManufacturer] = useState('');
  const [barcode, setBarcode] = useState('');
  const [hsnCode, setHsnCode] = useState('3004');
  const [taxRate, setTaxRate] = useState('12');
  const [unitsPerPack, setUnitsPerPack] = useState('10');
  const [packLabel, setPackLabel] = useState('Strip');
  const [looseLabel, setLooseLabel] = useState('Tablet');
  const [rackLocation, setRackLocation] = useState('A-01');
  const [reorderLevel, setReorderLevel] = useState('20');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.getProductsList(searchTerm);
      setProducts(res.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [searchTerm]);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setBrandName('');
    setGenericName('');
    setStrength('');
    setDosageForm('TABLET');
    setManufacturer('');
    setBarcode('');
    setHsnCode('3004');
    setTaxRate('12');
    setUnitsPerPack('10');
    setPackLabel('Strip');
    setLooseLabel('Tablet');
    setRackLocation('A-01');
    setReorderLevel('20');
    setShowModal(true);
  };

  const handleOpenEdit = (p: any) => {
    setEditingProduct(p);
    setBrandName(p.brandName);
    setGenericName(p.genericName);
    setStrength(p.strength);
    setDosageForm(p.dosageForm);
    setManufacturer(p.manufacturer);
    setBarcode(p.barcodes?.[0] || '');
    setHsnCode(p.hsnCode);
    setTaxRate(p.taxRatePercent.toString());
    setUnitsPerPack(p.unitsPerPack.toString());
    setPackLabel(p.packUnitLabel);
    setLooseLabel(p.looseUnitLabel);
    setRackLocation(p.rackLocation || '');
    setReorderLevel(p.reorderLevel.toString());
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        brandName,
        genericName,
        strength,
        dosageForm,
        manufacturer,
        barcodes: barcode ? [barcode] : [],
        hsnCode,
        taxCategory: 'GST',
        taxRatePercent: parseFloat(taxRate),
        unitsPerPack: parseInt(unitsPerPack, 10),
        packUnitLabel: packLabel,
        looseUnitLabel: looseLabel,
        rackLocation: rackLocation || undefined,
        reorderLevel: parseInt(reorderLevel, 10),
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
        setMsg(`Medicine ${brandName} updated successfully.`);
      } else {
        await api.createProduct(payload);
        setMsg(`New medicine ${brandName} added to master catalogue.`);
      }
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      alert(err.message || 'Error saving product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate ${name}?`)) return;
    try {
      await api.deactivateProduct(id);
      setMsg(`${name} deactivated.`);
      fetchProducts();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate product');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 bg-slate-100 overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Pill className="w-5 h-5 text-teal-600" />
            <span>Medicine Master Catalog (MED-001 / MED-004)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Formulation directory • Pack & loose conversion • HSN & GST tax mappings
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search brand, generic salt, or manufacturer..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>

          {user.accountType === 'OWNER' && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-lg text-xs font-bold shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Medicine</span>
            </button>
          )}

          <button
            onClick={fetchProducts}
            className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-lg font-semibold flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-teal-600 hover:text-teal-900 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Catalog Table */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4">Brand & Strength</th>
                <th className="py-2.5 px-3">Generic Composition</th>
                <th className="py-2.5 px-3">Form</th>
                <th className="py-2.5 px-3">Manufacturer</th>
                <th className="py-2.5 px-3 text-center">Pack Config</th>
                <th className="py-2.5 px-3 text-center">HSN / GST</th>
                <th className="py-2.5 px-3 text-center">Rack</th>
                <th className="py-2.5 px-3 text-right">Current Stock</th>
                {user.accountType === 'OWNER' && <th className="py-2.5 px-4 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading medicine catalog...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No medicines found.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">{p.brandName}</div>
                      <div className="text-[11px] text-teal-700 font-medium">{p.strength}</div>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      {p.genericName}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {p.dosageForm}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {p.manufacturer}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-700">
                      1 {p.packUnitLabel} = {p.unitsPerPack} {p.looseUnitLabel}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600">
                      <div>HSN: {p.hsnCode}</div>
                      <div className="text-teal-700 font-bold">{p.taxRatePercent}% GST</div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                      {p.rackLocation || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black tabular-nums text-slate-900 text-sm">
                      {p.totalStock > 0 ? (
                        <span>{p.totalStock} {p.looseUnitLabel}s</span>
                      ) : (
                        <span className="text-red-500 font-bold">Out of Stock</span>
                      )}
                    </td>
                    {user.accountType === 'OWNER' && (
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-teal-700"
                            title="Edit Medicine"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeactivate(p.id, p.brandName)}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                            title="Deactivate"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add/Edit Product */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">
                {editingProduct ? 'Edit Medicine Master' : 'Add New Medicine Formulation'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name *</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. Dolo 650"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Strength *</label>
                  <input
                    type="text"
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    placeholder="e.g. 650mg"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Generic / Salt Composition *</label>
                <input
                  type="text"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                  placeholder="e.g. Paracetamol"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dosage Form</label>
                  <select
                    value={dosageForm}
                    onChange={(e) => setDosageForm(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                  >
                    <option value="TABLET">Tablet</option>
                    <option value="CAPSULE">Capsule</option>
                    <option value="SYRUP">Syrup / Suspension</option>
                    <option value="INJECTION">Injection</option>
                    <option value="OINTMENT">Ointment / Gel</option>
                    <option value="DROPS">Eye/Ear Drops</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturer *</label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="e.g. Micro Labs Ltd"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Units per Pack</label>
                  <input
                    type="number"
                    min="1"
                    value={unitsPerPack}
                    onChange={(e) => setUnitsPerPack(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pack Label</label>
                  <input
                    type="text"
                    value={packLabel}
                    onChange={(e) => setPackLabel(e.target.value)}
                    placeholder="Strip / Bottle"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Loose Label</label>
                  <input
                    type="text"
                    value={looseLabel}
                    onChange={(e) => setLooseLabel(e.target.value)}
                    placeholder="Tablet / ml"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder="3004"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GST Rate %</label>
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                  >
                    <option value="0">0% (Nil)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rack Location</label>
                  <input
                    type="text"
                    value={rackLocation}
                    onChange={(e) => setRackLocation(e.target.value)}
                    placeholder="A-01"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode / EAN (Optional)</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan or enter barcode"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Safety Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow"
                >
                  {submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
