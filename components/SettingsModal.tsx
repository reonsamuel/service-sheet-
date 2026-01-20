import React, { useState, useEffect } from 'react';
import { Technician } from '../types';
import { XIcon, UserIcon, MoonIcon, SunIcon, CheckIcon, CarIcon, SettingsIcon, LockIcon, TrashIcon } from './ui/Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Technician;
  onUpdateProfile: (updatedTech: Technician) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  currentUser, 
  onUpdateProfile,
  theme,
  onToggleTheme
}) => {
  const [formData, setFormData] = useState<Technician>(currentUser);
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'templates'>('profile');
  const [isSaved, setIsSaved] = useState(false);
  
  // Reset Confirmation State
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    setFormData(currentUser);
  }, [currentUser]);

  const handleChange = (field: keyof Technician, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdateProfile(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleVehicleSwap = (type: 'spare' | 'rental' | 'custom', customValue?: string) => {
      let newVehicle = '';
      if (type === 'spare') newVehicle = 'SPARE-001';
      else if (type === 'rental') newVehicle = 'RENTAL-AB';
      else if (type === 'custom' && customValue) newVehicle = customValue;

      if (newVehicle) {
          const updated = { ...formData, vehicleNumber: newVehicle };
          setFormData(updated);
          onUpdateProfile(updated);
          setIsSaved(true);
          setTimeout(() => setIsSaved(false), 2000);
      }
  };

  const executeFactoryReset = () => {
      localStorage.clear();
      window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border-2 border-gray-800 dark:border-slate-700 transition-colors">
        
        {/* Header */}
        <div className="bg-gray-100 dark:bg-slate-800 p-4 border-b dark:border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2 text-gray-800 dark:text-white">
            <SettingsIcon className="w-6 h-6" />
            <h2 className="text-xl font-bold uppercase tracking-wide">Settings</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <XIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b dark:border-slate-700">
            <button 
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${activeTab === 'profile' ? 'border-b-4 border-red-600 text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
                Profile
            </button>
            <button 
                onClick={() => setActiveTab('templates')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${activeTab === 'templates' ? 'border-b-4 border-red-600 text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
                Vehicles
            </button>
            <button 
                onClick={() => setActiveTab('appearance')}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${activeTab === 'appearance' ? 'border-b-4 border-red-600 text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
                System
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
            
            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div className="space-y-6">
                    <div className="space-y-4">
                         <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider">General Information</h3>
                         <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Display Name</label>
                            <input 
                                type="text" 
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                className="w-full p-3 rounded-lg border-2 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-red-500 focus:outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Vehicle Number (Default)</label>
                            <input 
                                type="text" 
                                value={formData.vehicleNumber}
                                onChange={(e) => handleChange('vehicleNumber', e.target.value)}
                                className="w-full p-3 rounded-lg border-2 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-red-500 focus:outline-none transition-colors"
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t dark:border-slate-800 space-y-4">
                        <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider flex items-center gap-2">
                             <LockIcon className="w-4 h-4" />
                             Security
                        </h3>
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-1">Change Login PIN</label>
                            <input 
                                type="text" 
                                value={formData.pin}
                                maxLength={6}
                                onChange={(e) => handleChange('pin', e.target.value)}
                                className="w-full p-3 rounded-lg border-2 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-red-500 focus:outline-none transition-colors font-mono tracking-widest text-lg"
                            />
                            <p className="text-[10px] text-gray-500 mt-1">This PIN is used for your next login.</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleSave}
                        className={`w-full py-4 font-bold rounded-lg shadow-md active:scale-95 transition-all flex justify-center items-center gap-2 mt-4 ${
                            isSaved ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                    >
                        {isSaved ? <CheckIcon className="w-5 h-5" /> : null}
                        {isSaved ? 'CHANGES SAVED!' : 'SAVE PROFILE CHANGES'}
                    </button>
                </div>
            )}

            {/* Vehicles Tab (Templates) */}
            {activeTab === 'templates' && (
                <div className="space-y-6">
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                            <strong>Template Issue:</strong> Use these shortcuts if your license plate has been switched (e.g., spare car, rental). This will instantly update your profile and current form.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <button 
                            onClick={() => handleVehicleSwap('spare')}
                            className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-600 rounded-xl hover:border-red-500 dark:hover:border-red-500 transition-all text-left group"
                        >
                            <div className="bg-gray-100 dark:bg-slate-700 p-3 rounded-full group-hover:bg-red-100 dark:group-hover:bg-red-900/30">
                                <CarIcon className="w-6 h-6 text-gray-600 dark:text-gray-300 group-hover:text-red-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white">Switch to Spare Unit</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Sets vehicle to SPARE-001</p>
                            </div>
                        </button>

                        <button 
                            onClick={() => handleVehicleSwap('rental')}
                            className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-600 rounded-xl hover:border-red-500 dark:hover:border-red-500 transition-all text-left group"
                        >
                             <div className="bg-gray-100 dark:bg-slate-700 p-3 rounded-full group-hover:bg-red-100 dark:group-hover:bg-red-900/30">
                                <CarIcon className="w-6 h-6 text-gray-600 dark:text-gray-300 group-hover:text-red-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white">Switch to Rental</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Sets vehicle to RENTAL-AB</p>
                            </div>
                        </button>
                    </div>

                    <div className="pt-4 border-t dark:border-slate-700">
                        <label className="block text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-2">Manual Custom Plate</label>
                        <div className="flex gap-2">
                            <input 
                                id="custom-plate"
                                type="text" 
                                placeholder="ENTER PLATE #"
                                className="flex-1 p-3 rounded-lg border-2 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-red-500 focus:outline-none transition-colors uppercase"
                            />
                            <button 
                                onClick={() => {
                                    const input = document.getElementById('custom-plate') as HTMLInputElement;
                                    if(input.value) handleVehicleSwap('custom', input.value);
                                }}
                                className="bg-gray-800 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white px-4 rounded-lg font-bold"
                            >
                                Set
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Appearance/System Tab */}
            {activeTab === 'appearance' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border-2 border-gray-200 dark:border-slate-600">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                {theme === 'light' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">Dark Mode</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Switch between light and dark themes</p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={onToggleTheme}
                            className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 focus:outline-none ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                            <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </button>
                    </div>

                    <div className="pt-8 mt-8 border-t dark:border-slate-800">
                        <h3 className="text-xs font-black uppercase text-red-500 tracking-wider mb-3">Danger Zone</h3>
                        
                        {!showResetConfirm ? (
                            <button 
                                onClick={() => setShowResetConfirm(true)}
                                className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-900 rounded-xl text-red-700 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                            >
                                <TrashIcon className="w-5 h-5" />
                                Factory Reset Device
                            </button>
                        ) : (
                            <div className="bg-red-100 dark:bg-red-900/30 border-2 border-red-500 rounded-xl p-4 animate-fade-in">
                                <p className="text-red-800 dark:text-red-200 font-bold mb-2 text-center">Are you absolutely sure?</p>
                                <p className="text-xs text-red-600 dark:text-red-300 mb-4 text-center">
                                    This will permanently delete all registered users, history, and local data.
                                </p>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setShowResetConfirm(false)}
                                        className="flex-1 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-bold rounded-lg shadow-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={executeFactoryReset}
                                        className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg shadow-sm hover:bg-red-700"
                                    >
                                        Confirm Reset
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {!showResetConfirm && (
                            <p className="text-xs text-gray-500 mt-2 text-center">Deletes all local users, history, and settings.</p>
                        )}
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;