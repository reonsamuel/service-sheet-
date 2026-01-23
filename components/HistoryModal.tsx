import React from 'react';
import { XIcon, TrashIcon, RefreshIcon, FolderIcon } from './ui/Icons';

interface HistoryItem {
  id: string;
  timestamp: number;
  data: any; // Allow generic data to handle both types
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onLoad: (data: any, id: string) => void;
  onDelete: (id: string) => void;
  title?: string;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onLoad, onDelete, title = "History Folder" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden border-2 border-gray-800 dark:border-slate-700 transition-colors">
        
        {/* Header */}
        <div className="bg-gray-100 dark:bg-slate-800 p-4 border-b-2 border-gray-200 dark:border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
            <FolderIcon className="w-6 h-6" />
            <h2 className="text-xl font-bold uppercase tracking-wide">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <XIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-slate-950">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-600">
              <FolderIcon className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-semibold">No saved documents found.</p>
            </div>
          ) : (
            history.sort((a, b) => b.timestamp - a.timestamp).map((item) => {
              // Determine display title based on data type
              const displayTitle = item.data.shopName || item.data.agentName || 'Untitled Document';
              const subTitle = item.data.callType || item.data.systemType || 'Record';

              return (
                <div 
                  key={item.id} 
                  onClick={() => {
                     onLoad(item.data, item.id);
                     onClose();
                  }}
                  className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center gap-4 group cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-700/50"
                  title="Tap to load this draft"
                >
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 truncate">
                      {displayTitle}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(item.timestamp).toLocaleDateString()} at {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1">
                      {subTitle}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                     <button 
                       onClick={(e) => {
                         e.stopPropagation(); // Prevent loading when deleting
                         onDelete(item.id);
                       }}
                       className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 z-10"
                       title="Delete"
                     >
                       <TrashIcon className="w-5 h-5" />
                     </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};

export default HistoryModal;
