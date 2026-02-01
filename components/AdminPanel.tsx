import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, updateDoc, doc, deleteDoc, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase-config';
import { Technician, PasswordRequest } from '../types';
import { XIcon, ShieldIcon, CheckIcon, TrashIcon, UserIcon, RefreshIcon } from './ui/Icons';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Technician;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'users'>('requests');
  const [requests, setRequests] = useState<PasswordRequest[]>([]);
  const [users, setUsers] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // New User Form State
  const [showAddUser, setShowAddUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newVehicle, setNewVehicle] = useState('');
  const [newPin, setNewPin] = useState('');

  // 1. Fetch Password Requests
  useEffect(() => {
    if (!isOpen) return;
    
    const q = query(
        collection(db, 'password_requests'), 
        where('status', '==', 'pending')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const reqs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as PasswordRequest));
        setRequests(reqs.sort((a,b) => b.timestamp - a.timestamp));
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  // 2. Fetch Users
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = onSnapshot(collection(db, 'technicians'), (snapshot) => {
        const loaded = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Technician));
        setUsers(loaded.sort((a,b) => a.name.localeCompare(b.name)));
    });

    return () => unsubscribe();
  }, [isOpen]);

  const handleApproveReset = async (req: PasswordRequest) => {
      if (!confirm(`Reset PIN for ${req.techName} to '123456'?`)) return;

      try {
          // 1. Update Technician PIN
          await updateDoc(doc(db, 'technicians', req.techId), {
              pin: '123456'
          });

          // 2. Mark Request as Completed
          await updateDoc(doc(db, 'password_requests', req.id), {
              status: 'completed',
              resolvedAt: Date.now()
          });
      } catch (e) {
          alert("Error processing request");
          console.error(e);
      }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newName || !newVehicle || !newPin) return;

      try {
          await addDoc(collection(db, 'technicians'), {
              name: newName,
              vehicleNumber: newVehicle.toUpperCase(),
              pin: newPin,
              role: 'user'
          });
          setNewName('');
          setNewVehicle('');
          setNewPin('');
          setShowAddUser(false);
      } catch (e) {
          alert("Failed to create user");
      }
  };

  const handleDeleteUser = async (id: string, name: string) => {
      if (confirm(`Permanently delete user: ${name}?`)) {
          try {
              await deleteDoc(doc(db, 'technicians', id));
          } catch (e) {
              alert("Error deleting user");
          }
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
      <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border-2 border-slate-700 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-yellow-500 rounded-lg text-black">
                <ShieldIcon className="w-6 h-6" />
            </div>
            <div>
                <h2 className="text-xl font-bold uppercase tracking-widest">Admin Panel</h2>
                <p className="text-xs text-slate-400">Authenticated: {currentUser.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <XIcon className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900">
            <button 
                onClick={() => setActiveTab('requests')}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide transition-colors ${activeTab === 'requests' ? 'border-b-4 border-yellow-500 text-yellow-500 bg-slate-800' : 'text-slate-400 hover:bg-slate-800'}`}
            >
                Requests {requests.length > 0 && <span className="ml-2 px-2 py-0.5 bg-red-600 text-white rounded-full text-xs">{requests.length}</span>}
            </button>
            <button 
                onClick={() => setActiveTab('users')}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide transition-colors ${activeTab === 'users' ? 'border-b-4 border-yellow-500 text-yellow-500 bg-slate-800' : 'text-slate-400 hover:bg-slate-800'}`}
            >
                Manage Users
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
            
            {/* REQUESTS TAB */}
            {activeTab === 'requests' && (
                <div className="space-y-4">
                    {requests.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <CheckIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>No pending password reset requests.</p>
                        </div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <h3 className="font-bold text-white text-lg">{req.techName}</h3>
                                    <p className="text-slate-400 text-sm font-mono">{req.vehicleNumber}</p>
                                    <p className="text-xs text-yellow-500 mt-1">Requested: {new Date(req.timestamp).toLocaleString()}</p>
                                </div>
                                <button 
                                    onClick={() => handleApproveReset(req)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg flex items-center gap-2 transition-colors w-full md:w-auto justify-center"
                                >
                                    <RefreshIcon className="w-4 h-4" />
                                    Reset to 123456
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    {/* Create New User */}
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-300 uppercase text-sm">Create New Account</h3>
                            <button 
                                onClick={() => setShowAddUser(!showAddUser)}
                                className="text-yellow-500 text-xs font-bold uppercase hover:underline"
                            >
                                {showAddUser ? 'Cancel' : '+ Expand'}
                            </button>
                        </div>
                        
                        {showAddUser && (
                            <form onSubmit={handleCreateUser} className="space-y-3 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input 
                                        placeholder="Name" 
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-yellow-500 outline-none"
                                    />
                                    <input 
                                        placeholder="Vehicle (e.g. C-101)" 
                                        value={newVehicle}
                                        onChange={e => setNewVehicle(e.target.value)}
                                        className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-yellow-500 outline-none uppercase"
                                    />
                                    <input 
                                        placeholder="PIN (4-6 digits)" 
                                        value={newPin}
                                        onChange={e => setNewPin(e.target.value)}
                                        maxLength={6}
                                        className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-yellow-500 outline-none font-mono"
                                    />
                                </div>
                                <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-2 rounded">
                                    Create Account
                                </button>
                            </form>
                        )}
                    </div>

                    {/* User List */}
                    <div className="space-y-2">
                        {users.map(user => (
                            <div key={user.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${user.role === 'admin' ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-300'}`}>
                                        {user.role === 'admin' ? <ShieldIcon className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">{user.name} {currentUser.id === user.id && <span className="text-xs text-green-500">(You)</span>}</h4>
                                        <p className="text-xs text-slate-400 font-mono">{user.vehicleNumber} • PIN: <span className="tracking-widest">{user.pin}</span></p>
                                    </div>
                                </div>
                                {currentUser.id !== user.id && (
                                    <button 
                                        onClick={() => handleDeleteUser(user.id, user.name)}
                                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-slate-700 rounded-lg transition-colors"
                                        title="Delete User"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
