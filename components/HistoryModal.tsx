import React from 'react';
import { XIcon, TrashIcon, RefreshIcon, FolderIcon } from './ui/Icons';
import { ServiceFormData } from '../types';

interface HistoryItem {
  id: string;
  timestamp: number;
  data: ServiceFormData;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onLoad: (data: ServiceFormData, id: string) => void;
  onDelete: (id: string) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onLoad, onDelete }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden border-2 border-gray-800">
        
        {/* Header */}
        <div className="bg-gray-100 p-4 border-b-2 border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-2 text-gray-700">
            <FolderIcon className="w-6 h-6" />
            <h2 className="text-xl font-bold uppercase tracking-wide">History Folder</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <XIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <FolderIcon className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-semibold">No saved documents found.</p>
            </div>
          ) : (
            history.sort((a, b) => b.timestamp - a.timestamp).map((item) => (
              <div 
                key={item.id} 
                onClick={() => {
                   onLoad(item.data, item.id);
                   onClose();
                }}
                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center gap-4 group cursor-pointer hover:bg-blue-50/50"
                title="Tap to load this draft"
              >
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-800 truncate">
                    {item.data.shopName || 'Untitled Shop'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {new Date(item.timestamp).toLocaleDateString()} at {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-blue-600 font-semibold mt-1">
                    {item.data.callType || 'No Type Selected'}
                  </p>
                </div>
                
                <div className="flex gap-2">
                   {/* Visual indicator button for "Load", now redundant but keeps the UI clear */}
                   <div className="p-2 text-blue-300 group-hover:text-blue-600 transition-colors">
                     <RefreshIcon className="w-5 h-5" />
                   </div>

                   <button 
                     onClick={(e) => {
                       e.stopPropagation(); // Prevent loading when deleting
                       onDelete(item.id);
                     }}
                     className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 border border-red-200 z-10"
                     title="Delete"
                   >
                     <TrashIcon className="w-5 h-5" />
                   </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};

export default HistoryModal;