import React, { useState, useEffect } from 'react';
import { XIcon, CheckIcon } from './ui/Icons';

interface TimePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (time: string) => void;
  initialValue?: string;
}

const TimePicker: React.FC<TimePickerProps> = ({ isOpen, onClose, onSave, initialValue }) => {
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('PM');

  useEffect(() => {
    if (isOpen) {
      if (initialValue) {
        // Try parsing "h:mm A" first
        const amPmMatch = initialValue.match(/(\d+):(\d+)\s?(AM|PM)/i);
        if (amPmMatch) {
          setSelectedHour(parseInt(amPmMatch[1], 10));
          setSelectedMinute(parseInt(amPmMatch[2], 10));
          setPeriod(amPmMatch[3].toUpperCase() as 'AM' | 'PM');
          return;
        }

        // Fallback to "HH:mm"
        const [hStr, mStr] = initialValue.split(':');
        let h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        
        if (!isNaN(h) && !isNaN(m)) {
            const isPm = h >= 12;
            if (h > 12) h -= 12;
            if (h === 0) h = 12;
            
            setSelectedHour(h);
            setSelectedMinute(m);
            setPeriod(isPm ? 'PM' : 'AM');
        }
      } else {
        // Default to PM as requested
        setSelectedHour(12);
        setSelectedMinute(0);
        setPeriod('PM'); 
      }
    }
  }, [isOpen, initialValue]);

  const handleSave = () => {
    const timeString = `${selectedHour}:${selectedMinute.toString().padStart(2, '0')} ${period}`;
    onSave(timeString);
    onClose();
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-t-2xl shadow-2xl p-6 animate-slide-up flex flex-col h-[50vh] border-t-4 border-red-600">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <span className="text-sm font-bold text-gray-500">CANCEL</span>
          </button>
          <span className="text-xl font-bold text-gray-800 uppercase tracking-wider">Select Time</span>
          <button onClick={handleSave} className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transform transition active:scale-95">
            <CheckIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex gap-2 overflow-hidden items-center justify-center">
          {/* Hours */}
          <div className="flex-1 h-full flex flex-col items-center">
            <span className="text-xs font-bold text-gray-400 mb-2 uppercase">Hour</span>
            <div className="w-full flex-1 overflow-y-auto no-scrollbar snap-y snap-mandatory border-y-2 border-orange-100 rounded-lg bg-orange-50/30">
              <div className="py-[60%]"></div>
              {hours.map((h) => (
                <div
                  key={h}
                  onClick={() => setSelectedHour(h)}
                  className={`h-12 flex items-center justify-center snap-center cursor-pointer transition-all ${
                    selectedHour === h ? 'text-3xl font-bold text-red-600 scale-110' : 'text-xl text-gray-400'
                  }`}
                >
                  {h}
                </div>
              ))}
              <div className="py-[60%]"></div>
            </div>
          </div>

          <div className="text-2xl font-bold text-gray-300 pb-4">:</div>

          {/* Minutes */}
          <div className="flex-1 h-full flex flex-col items-center">
            <span className="text-xs font-bold text-gray-400 mb-2 uppercase">Minute</span>
            <div className="w-full flex-1 overflow-y-auto no-scrollbar snap-y snap-mandatory border-y-2 border-orange-100 rounded-lg bg-orange-50/30">
              <div className="py-[60%]"></div>
              {minutes.map((m) => (
                <div
                  key={m}
                  onClick={() => setSelectedMinute(m)}
                  className={`h-12 flex items-center justify-center snap-center cursor-pointer transition-all ${
                    selectedMinute === m ? 'text-3xl font-bold text-red-600 scale-110' : 'text-xl text-gray-400'
                  }`}
                >
                  {m.toString().padStart(2, '0')}
                </div>
              ))}
              <div className="py-[60%]"></div>
            </div>
          </div>

          {/* AM/PM */}
          <div className="flex-1 h-full flex flex-col items-center justify-center gap-4 ml-2">
             <button
               onClick={() => setPeriod('AM')}
               className={`w-16 py-3 rounded-xl font-bold transition-all border-2 ${
                 period === 'AM' 
                   ? 'bg-red-600 text-white border-red-600 shadow-md scale-105' 
                   : 'bg-white text-gray-400 border-gray-200 hover:border-red-200'
               }`}
             >
               AM
             </button>
             <button
               onClick={() => setPeriod('PM')}
               className={`w-16 py-3 rounded-xl font-bold transition-all border-2 ${
                 period === 'PM' 
                   ? 'bg-red-600 text-white border-red-600 shadow-md scale-105' 
                   : 'bg-white text-gray-400 border-gray-200 hover:border-red-200'
               }`}
             >
               PM
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimePicker;