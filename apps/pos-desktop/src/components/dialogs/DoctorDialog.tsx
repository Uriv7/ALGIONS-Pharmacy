import React, { useState, useEffect } from 'react';
import { X, Stethoscope, Search, Plus, Check, Building, Phone, Award } from 'lucide-react';
import { api } from '../../api/client.js';

export interface DoctorInfo {
  id?: string;
  name: string;
  regNumber?: string;
  hospitalClinic?: string;
  specialization?: string;
  phone?: string;
}

interface DoctorDialogProps {
  currentDoctor: DoctorInfo | null;
  onSelectDoctor: (doctor: DoctorInfo | null) => void;
  onClose: () => void;
}

export const DoctorDialog: React.FC<DoctorDialogProps> = ({
  currentDoctor,
  onSelectDoctor,
  onClose,
}) => {
  const [doctors, setDoctors] = useState<DoctorInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New Doctor form
  const [name, setName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [hospitalClinic, setHospitalClinic] = useState('');
  const [specialization, setSpecialization] = useState('General Medicine');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDoctors = async () => {
    setIsLoading(true);
    try {
      const res = await api.getDoctors();
      setDoctors(res.doctors || []);
    } catch {
      setDoctors([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const filteredDoctors = doctors.filter((doc) => {
    const term = searchTerm.toLowerCase();
    return (
      doc.name.toLowerCase().includes(term) ||
      (doc.regNumber || '').toLowerCase().includes(term) ||
      (doc.hospitalClinic || '').toLowerCase().includes(term) ||
      (doc.specialization || '').toLowerCase().includes(term)
    );
  });

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await api.createDoctor({
        name: name.trim(),
        regNumber: regNumber.trim() || undefined,
        hospitalClinic: hospitalClinic.trim() || undefined,
        specialization: specialization.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      onSelectDoctor({
        id: created.id,
        name: created.name,
        regNumber: created.regNumber,
        hospitalClinic: created.hospitalClinic,
        specialization: created.specialization,
        phone: created.phone,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register doctor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAdd = () => {
    if (!name.trim()) return;
    onSelectDoctor({
      name: name.trim(),
      regNumber: regNumber.trim() || undefined,
      hospitalClinic: hospitalClinic.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Prescribing Doctor (Rx / Schedule H)</h3>
              <p className="text-[11px] text-slate-500">
                Attach doctor's registration & clinic to comply with Pharmacy Schedule H norms
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setIsAddingNew(false)}
              className={`px-3 py-1 rounded-md transition ${
                !isAddingNew ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Select Registered Doctor
            </button>
            <button
              onClick={() => setIsAddingNew(true)}
              className={`px-3 py-1 rounded-md transition ${
                isAddingNew ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              + Add New Doctor
            </button>
          </div>

          {currentDoctor && (
            <button
              onClick={() => {
                onSelectDoctor(null);
                onClose();
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
            >
              Remove Doctor
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          {!isAddingNew ? (
            <div className="space-y-3">
              {/* Search bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by doctor name, reg number, or clinic..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
                  autoFocus
                />
              </div>

              {/* Doctors list */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-64 overflow-y-auto bg-white">
                {isLoading ? (
                  <div className="p-6 text-center text-xs text-slate-400">Loading doctor directory...</div>
                ) : filteredDoctors.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No doctors found matching "{searchTerm}". Click "+ Add New Doctor" to register.
                  </div>
                ) : (
                  filteredDoctors.map((doc) => {
                    const isSelected = currentDoctor?.id === doc.id || currentDoctor?.name === doc.name;
                    return (
                      <div
                        key={doc.id || doc.name}
                        onClick={() => {
                          onSelectDoctor(doc);
                          onClose();
                        }}
                        className={`p-3 cursor-pointer transition flex items-center justify-between ${
                          isSelected ? 'bg-teal-50 border-l-4 border-teal-600' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <span>{doc.name}</span>
                            {doc.specialization && (
                              <span className="text-[10px] text-teal-700 font-medium bg-teal-100/60 px-1.5 py-0.2 rounded">
                                {doc.specialization}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            {doc.regNumber && (
                              <span className="font-mono text-slate-600">Reg: {doc.regNumber}</span>
                            )}
                            {doc.hospitalClinic && (
                              <span>• {doc.hospitalClinic}</span>
                            )}
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <button className="px-2.5 py-1 rounded bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-600 text-[11px] font-bold transition">
                            Select
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateDoctor} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Doctor / Prescriber Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Rajesh Sharma, MBBS, MD"
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registration No (MCI / State)
                  </label>
                  <div className="relative">
                    <Award className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={regNumber}
                      onChange={(e) => setRegNumber(e.target.value)}
                      placeholder="e.g. DMC/2019/5482"
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Pediatrics / General"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hospital / Clinic Name
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={hospitalClinic}
                    onChange={(e) => setHospitalClinic(e.target.value)}
                    placeholder="e.g. Apollo Clinic / City Hospital"
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Doctor contact number"
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  className="flex-1 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Quick Attach Only
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSubmitting ? 'Registering...' : 'Save & Attach to Bill'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
