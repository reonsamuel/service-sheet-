import React, { useState, useEffect } from 'react';
import { LOCATIONS } from '../types';
import { EditIcon, XIcon } from './ui/Icons';

interface LocationSelectorProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({ label, value, onChange, placeholder }) => {
  const [isManual, setIsManual] = useState(false);

  // If the initial value is NOT in the list and is NOT empty, default to manual mode
  useEffect(() => {
    if (value && !LOCATIONS.includes(value)) {
      setIsManual(true);
    }
  }, []);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'OTHER_CUSTOM') {
      setIsManual(true);
      onChange(''); // Clear value so they can type
    } else {
      onChange(val);
    }
  };

  const switchToDropdown = () => {
    setIsManual(false);
    onChange('');
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-bold text-gray-900 dark:text-gray-100 tracking-wide uppercase">
          {label}
        </label>
        {isManual && (
          <button 
            onClick={switchToDropdown}
            className="text-xs text-blue-500 hover:underline flex items-center gap-1"
          >
            <XIcon className="w-3 h-3" /> Back to List
          </button>
        )}
      </div>

      {isManual ? (
        <div className="relative animate-fade-in">
             <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || "Enter custom location name..."}
                className="w-full px-3 py-2 border-2 border-blue-400 dark:border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 transition-all bg-white dark:bg-slate-800 dark:text-white"
                autoFocus
              />
        </div>
      ) : (
        <div className="relative">
          <select
            value={value}
            onChange={handleSelectChange}
            className="w-full px-3 py-2 border-2 border-gray-800 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-500 transition-all bg-white dark:bg-slate-800 dark:text-white hover:bg-yellow-50 dark:hover:bg-slate-700 appearance-none"
          >
            <option value="">-- Select Location --</option>
            {LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
            <option value="OTHER_CUSTOM" className="font-bold text-blue-600">-- OTHER / ADD NEW --</option>
          </select>
          {/* Custom Arrow */}
          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;
