import React, { useState, useEffect } from 'react';
import { Technician } from '../types';
import { UserIcon, XIcon, RefreshIcon } from './ui/Icons';
import { db, auth } from '../firebase-config';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';

interface LoginScreenProps {
  onLogin: (tech: Technician) => void;
}

const LOCAL_TECHS_KEY = 'cage_technicians_local';

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<Technician[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'login'>('list');
  const [selectedUser, setSelectedUser] = useState<Technician | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Offline / Error States
  const [isOffline, setIsOffline] = useState(false);
  const [offlineReason, setOfflineReason] = useState('');
  
  // Form States
  const [pinInput, setPinInput] = useState('');
  const [newName, setNewName] = useState('');
  const [newVehicle, setNewVehicle] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  
  // Refresh Trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Helper to load local users
  const loadLocalUsers = () => {
      try {
          const localData = localStorage.getItem(LOCAL_TECHS_KEY);
          if (localData) {
              const parsed = JSON.parse(localData);
              // Sort Client-Side
              parsed.sort((a: Technician, b: Technician) => a.name.localeCompare(b.name));
              setUsers(parsed);
          } else {
              setUsers([]);
          }
      } catch (e) {
          console.error("Local load failed", e);
          setUsers([]);
      }
      setIsLoading(false);
  };

  // Load users from Firebase Firestore on mount
  useEffect(() => {
    setIsLoading(true);
    setError('');
    
    // Attempt to authenticate anonymously
    const ensureAuth = async () => {
        if (!auth.currentUser) {
            try {
                await auth.signInAnonymously();
            } catch (err: any) {
                console.warn("Auth failed, switching to offline mode:", err.code);
                setIsOffline(true);
            }
        }
    };

    ensureAuth();

    // Modular Syntax with Fallback
    const unsubscribe = onSnapshot(collection(db, 'technicians'), (snapshot) => {
      const fetchedUsers: Technician[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Technician));
      
      fetchedUsers.sort((a, b) => a.name.localeCompare(b.name));
      
      setUsers(fetchedUsers);
      setIsLoading(false);
      setIsOffline(false); // If we got here, we are online
      setOfflineReason('');
      setError('');
    }, (err: any) => {
      console.warn("Firestore access failed, using local storage:", err.code);
      setIsOffline(true);
      loadLocalUsers();
    });

    return () => unsubscribe();
  }, [refreshKey]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newVehicle || !newPin) {
      setError("All fields are required");
      return;
    }
    
    setError('');
    setIsLoading(true);

    const newTechData = {
        name: newName,
        vehicleNumber: newVehicle.toUpperCase(),
        pin: newPin,
        role: 'user'
    };

    try {
        if (isOffline) throw new Error("Offline Mode"); 

        await addDoc(collection(db, 'technicians'), newTechData);
        setNewName('');
        setNewVehicle('');
        setNewPin('');
        setView('list');
    } catch (err: any) {
        console.warn("Cloud save failed, saving locally", err);
        
        // Local Save Fallback
        const localId = 'local_' + Date.now();
        const newTechWithId = { id: localId, ...newTechData };
        
        const currentLocal = JSON.parse(localStorage.getItem(LOCAL_TECHS_KEY) || '[]');
        const updatedLocal = [...currentLocal, newTechWithId];
        localStorage.setItem(LOCAL_TECHS_KEY, JSON.stringify(updatedLocal));
        
        setUsers(prev => [...prev, newTechWithId as any].sort((a,b) => a.name.localeCompare(b.name)));
        
        setNewName('');
        setNewVehicle('');
        setNewPin('');
        setView('list');
        
        if (!isOffline) {
            alert("Connection Issue: Profile saved to this device only.");
        }
    } finally {
        setIsLoading(false);
    }
  };

  const initiateLogin = (user: Technician) => {
    setSelectedUser(user);
    setPinInput('');
    setError('');
    setView('login');
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedUser) return;

    if (pinInput === selectedUser.pin) {
        onLogin(selectedUser);
    } else {
        setError("Incorrect PIN");
        setPinInput('');
    }
  };

  const handleRequestReset = async () => {
    if (!selectedUser) return;
    
    if (confirm(`Send password reset request for ${selectedUser.name} to Admin?`)) {
        try {
            await addDoc(collection(db, 'password_requests'), {
                techId: selectedUser.id,
                techName: selectedUser.name,
                vehicleNumber: selectedUser.vehicleNumber,
                status: 'pending',
                timestamp: Date.now()
            });
            alert("Request sent! Admin has been notified.");
            setView('list');
        } catch (e) {
            alert("Failed to send request. Check connection.");
        }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-black flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border-4 border-yellow-500 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 p-6 flex flex-col items-center justify-center border-b-4 border-red-600 shrink-0 relative">
           <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-white text-black shadow-lg mb-2">
              <div className="w-8 h-8 border-4 border-black rotate-45"></div>
           </div>
           <h1 className="text-xl font-black text-white uppercase tracking-widest text-center">CAGE Antigua</h1>
           <div className="flex gap-2 items-center">
               <p className="text-red-500 font-bold uppercase text-[10px] tracking-[0.2em]">Beta</p>
               {isOffline && (
                   <span className="text-yellow-400 font-bold uppercase text-[10px] tracking-[0.2em] border border-yellow-400 px-1 rounded">
                     Offline Mode
                   </span>
               )}
           </div>
           
           <button 
             onClick={() => setRefreshKey(prev => prev + 1)}
             className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
             title="Refresh Connection"
           >
              <RefreshIcon className="w-5 h-5" />
           </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-950 p-6">
          
          {isLoading && view !== 'create' && (
              <div className="flex justify-center items-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
          )}

          {/* VIEW: USER LIST */}
          {view === 'list' && !isLoading && (
            <div className="space-y-4">
              <h2 className="text-center text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Select Profile</h2>
              
              <div className="grid gap-3">
                {users.map(user => (
                  <div 
                    key={user.id}
                    onClick={() => initiateLogin(user)}
                    className="bg-white dark:bg-slate-800 p-4 rounded-xl border-2 border-gray-200 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-500 cursor-pointer flex justify-between items-center group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-100 dark:bg-slate-700 p-2 rounded-full text-gray-600 dark:text-gray-300">
                        <UserIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 dark:text-white">{user.name}</h3>
                        <p className="text-xs text-gray-500 font-mono">{user.vehicleNumber}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {users.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p>No profiles found.</p>
                    <p className="text-sm">Create one below.</p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setView('create')}
                className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 dark:border-slate-700 text-gray-500 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors uppercase text-sm"
              >
                + Create New Profile
              </button>
            </div>
          )}

          {/* VIEW: LOGIN (PIN) */}
          {view === 'login' && selectedUser && (
            <div className="h-full flex flex-col items-center justify-center space-y-6">
               <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">{selectedUser.name}</h3>
                  <p className="text-sm text-gray-500">{selectedUser.vehicleNumber}</p>
               </div>

               <form onSubmit={handlePinSubmit} className="w-full max-w-[240px]">
                  <label className="block text-center text-xs font-bold uppercase mb-2 text-gray-400">
                      Enter PIN
                  </label>
                  <input
                    type="password"
                    autoFocus
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="w-full text-center text-3xl tracking-[0.5em] py-2 border-b-4 bg-transparent outline-none dark:text-white transition-colors border-gray-300 dark:border-slate-700 focus:border-red-600"
                  />
                  {error && <p className="text-red-500 text-xs font-bold text-center mt-2">{error}</p>}
               </form>

               <div className="flex gap-4 w-full pt-4">
                  <button onClick={() => setView('list')} className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-slate-800 font-bold text-gray-600 dark:text-gray-400">Cancel</button>
                  <button onClick={handlePinSubmit} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold shadow-lg">Enter</button>
               </div>
               
               <button 
                 onClick={handleRequestReset}
                 className="text-xs text-gray-400 hover:text-red-500 font-bold underline decoration-dotted mt-4"
               >
                   Forgot PIN? Request Reset
               </button>
            </div>
          )}

          {/* VIEW: CREATE USER */}
          {view === 'create' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white uppercase">New Technician</h2>
                <button onClick={() => setView('list')}>
                  <XIcon className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                   <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-lg dark:text-white" placeholder="John Doe" />
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vehicle #</label>
                   <input required type="text" value={newVehicle} onChange={e => setNewVehicle(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-lg dark:text-white uppercase" placeholder="C-100" />
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Create PIN (4-6 digits)</label>
                   <input required type="number" pattern="[0-9]*" inputMode="numeric" maxLength={6} value={newPin} onChange={e => setNewPin(e.target.value)} className="w-full p-3 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-lg dark:text-white font-mono tracking-widest" placeholder="1234" />
                </div>

                {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
                {isLoading && <p className="text-gray-500 text-xs text-center animate-pulse">Saving...</p>}

                <button disabled={isLoading} type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-xl shadow-lg mt-4 uppercase tracking-wide">
                  Save Profile
                </button>
              </form>
            </div>
          )}

        </div>
        
        <div className="bg-gray-100 dark:bg-slate-800 p-3 text-center border-t dark:border-slate-700">
            <p className="text-[10px] text-gray-400 font-medium">
               {isOffline ? 'Storage: Local Device Only' : 'Synced with Cloud Database'}
            </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
