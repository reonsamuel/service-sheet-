import React from 'react';
import { Technician } from '../types';
import { WrenchIcon, ClipboardListIcon, UserIcon, LogoutIcon, SettingsIcon } from './ui/Icons';

interface DashboardProps {
  currentUser: Technician;
  onSelectService: () => void;
  onSelectPM: () => void;
  onLogout: () => void;
  onOpenSettings: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser, onSelectService, onSelectPM, onLogout, onOpenSettings }) => {
  return (
    <div className="min-h-screen bg-orange-50 dark:bg-slate-950 p-4 md:p-8 flex flex-col items-center">
      {/* Header Bar */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-12 relative z-10">
        <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-black text-black shadow-lg">
                <div className="w-6 h-6 border-2 border-black rotate-45"></div>
             </div>
             <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">CAGE Antigua</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest">Tech Portal</p>
             </div>
        </div>
        
        <div className="flex gap-2">
           <button 
              type="button"
              onClick={onOpenSettings}
              className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-500 transition-all group"
              title="Settings"
           >
              <SettingsIcon className="w-6 h-6 text-gray-400 group-hover:text-red-500 transition-colors" />
           </button>
           <button 
              type="button"
              onClick={onLogout}
              className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-500 transition-all group"
              title="Logout"
           >
              <LogoutIcon className="w-6 h-6 text-gray-400 group-hover:text-red-500 transition-colors" />
           </button>
        </div>
      </div>

      {/* Welcome Message */}
      <div className="text-center mb-12 animate-fade-in">
         <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Welcome, {currentUser.name}</h2>
         <div className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 shadow-sm">
            <UserIcon className="w-4 h-4 text-red-500" />
            <span className="text-sm font-mono text-gray-600 dark:text-gray-300 uppercase">{currentUser.vehicleNumber}</span>
         </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
         {/* Service Sheet Card */}
         <button 
            type="button"
            onClick={onSelectService}
            className="group relative bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-gray-200 dark:border-slate-800 shadow-xl hover:shadow-2xl hover:border-red-500 dark:hover:border-red-600 hover:-translate-y-2 transition-all duration-300 text-left overflow-hidden"
         >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <WrenchIcon className="w-32 h-32 text-red-500" />
            </div>
            
            <div className="relative z-10">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <WrenchIcon className="w-8 h-8 text-red-600 dark:text-red-400 group-hover:text-white" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-2">Service Sheets</h3>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Create new service calls, repair logs, and maintenance reports.</p>
                <div className="mt-8 flex items-center gap-2 text-red-600 dark:text-red-400 font-bold uppercase text-sm group-hover:underline decoration-2 underline-offset-4">
                    Open Form <span>&rarr;</span>
                </div>
            </div>
         </button>

         {/* PM Sheet Card */}
         <button 
            type="button"
            onClick={onSelectPM}
            className="group relative bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-gray-200 dark:border-slate-800 shadow-xl hover:shadow-2xl hover:border-blue-500 dark:hover:border-blue-500 hover:-translate-y-2 transition-all duration-300 text-left overflow-hidden"
         >
             <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <ClipboardListIcon className="w-32 h-32 text-blue-500" />
            </div>

            <div className="relative z-10">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <ClipboardListIcon className="w-8 h-8 text-blue-600 dark:text-blue-400 group-hover:text-white" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase mb-2">PM Check Lists</h3>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Preventative maintenance checks, cleaning logs, and system audits.</p>
                <div className="mt-8 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold uppercase text-sm group-hover:underline decoration-2 underline-offset-4">
                    Open Form <span>&rarr;</span>
                </div>
            </div>
         </button>
      </div>
      
      <div className="mt-12 text-center text-gray-400 text-xs uppercase tracking-widest">
         &copy; 2025 CAGE Antigua Technical Operations
      </div>
    </div>
  );
};

export default Dashboard;