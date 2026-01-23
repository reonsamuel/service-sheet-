import React, { useState, useEffect } from 'react';
import { db } from '../firebase-config';
import { collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { SavedSignature } from '../types';
import { XIcon, TrashIcon, CheckIcon, LockIcon } from './ui/Icons';

interface SignatureManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentSignature: string | null;
  onSelect: (signatureData: string) => void;
}

const SignatureManager: React.FC<SignatureManagerProps> = ({ isOpen, onClose, currentSignature, onSelect }) => {
  const [signatures, setSignatures] = useState<SavedSignature[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [mode, setMode] = useState<'list' | 'save'>('list');

  useEffect(() => {
    let unsubscribe: () => void;

    if (isOpen) {
      setLoading(true);
      setMode('list');
      setNewName('');

      const q = query(collection(db, 'saved_signatures'), orderBy('name'));
      unsubscribe = onSnapshot(q, (snapshot) => {
          const loaded = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as SavedSignature));
          setSignatures(loaded);
          setLoading(false);
      }, (error) => {
          console.error("Error watching signatures", error);
          setLoading(false);
      });
    }

    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  const handleSave = async () => {
    if (!currentSignature || !newName.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'saved_signatures'), {
        name: newName.trim(),
        signatureData: currentSignature,
        createdAt: Date.now()
      });
      // Mode switches back automatically via snapshot, but we reset input here
      setMode('list');
      setNewName('');
    } catch (e) {
      alert("Failed to save signature");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this saved signature?")) {
      try {
        await deleteDoc(doc(db, 'saved_signatures', id));
      } catch (e) {
        console.error("Failed to delete", e);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border-2 border-slate-700 shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2 text-white">
            <LockIcon className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-bold uppercase tracking-widest">Agent Vault</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <XIcon className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
          
          {/* Toggle View */}
          <div className="flex gap-2 mb-6">
            <button 
              onClick={() => setMode('list')}
              className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg border ${mode === 'list' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-transparent text-slate-400 border-slate-700'}`}
            >
              Load Stored
            </button>
            <button 
              onClick={() => setMode('save')}
              disabled={!currentSignature}
              className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg border ${mode === 'save' ? 'bg-green-500 text-black border-green-500' : 'bg-transparent text-slate-400 border-slate-700'} ${!currentSignature ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Save Current
            </button>
          </div>

          {loading ? (
             <div className="text-center py-8 text-slate-500 animate-pulse">Accessing Vault...</div>
          ) : (
            <>
              {mode === 'list' && (
                <div className="space-y-3">
                  {signatures.length === 0 ? (
                    <div className="text-center py-10 text-slate-600 text-sm">Vault is empty.</div>
                  ) : (
                    signatures.map((sig) => (
                      <div 
                        key={sig.id}
                        onClick={() => {
                          onSelect(sig.signatureData);
                          onClose();
                        }}
                        className="bg-slate-800 p-3 rounded-xl border border-slate-700 hover:border-yellow-500 cursor-pointer flex justify-between items-center group transition-all"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                           <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center p-1">
                              <img src={sig.signatureData} className="max-w-full max-h-full" alt="Sig" />
                           </div>
                           <span className="font-bold text-slate-200 truncate">{sig.name}</span>
                        </div>
                        <button 
                          onClick={(e) => handleDelete(sig.id, e)}
                          className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {mode === 'save' && (
                <div className="space-y-4">
                   <div className="bg-white rounded-xl p-4 flex items-center justify-center h-32 border-2 border-dashed border-slate-600">
                      {currentSignature && <img src={currentSignature} className="max-h-full" alt="Current" />}
                   </div>
                   
                   <div>
                     <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Assign Name</label>
                     <input 
                       type="text" 
                       value={newName}
                       onChange={(e) => setNewName(e.target.value)}
                       placeholder="e.g. Island Provision Manager"
                       className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-green-500 outline-none"
                     />
                   </div>

                   <button 
                     onClick={handleSave}
                     disabled={!newName.trim()}
                     className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                   >
                     <CheckIcon className="w-5 h-5" />
                     Save to Vault
                   </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default SignatureManager;
