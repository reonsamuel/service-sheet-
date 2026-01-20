import React, { useState, useEffect } from 'react';
import { Technician } from '../types';
import { UserIcon, XIcon } from './ui/Icons'; // Removed TrashIcon from imports
import { db } from '../firebase-config';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore'; // Removed deleteDoc, doc from imports

interface LoginScreenProps {
  onLogin: (tech: Technician) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<Technician[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'login'>('list');
  const [selectedUser, setSelectedUser] = useState<Technician | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Login / Reset Modes
  const [loginMode, setLoginMode] = useState<'pin' | 'admin_override' | 'new_pin'>('pin');

  // Form States
  const [pinInput, setPinInput] = useState('');
  const [newName, setNewName] = useState('');
  const [newVehicle, setNewVehicle] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');

  // Default Master Code for Reset
  const MASTER_CODE = '888888';

  // Load users from Firebase Firestore on mount
  useEffect(() => {
    const q = query(collection(db, 'technicians'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers: Technician[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Technician));
      setUsers(fetchedUsers);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setIsLoading(false);
      setError("Could not connect to database.");
    });

    return () => unsubscribe();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newVehicle || !newPin) {
      setError("All fields are required");
      return;
    }
    
    setError('');
    setIsLoading(true);

    try {
        await addDoc(collection(db, 'technicians'), {
            name: newName,
            vehicleNumber: newVehicle.toUpperCase(),
            pin: newPin
        });
        
        // Reset and go back to list
        setNewName('');
        setNewVehicle('');
        setNewPin('');
        setView('list');
    } catch (err) {
        console.error("Error creating user", err);
        setError("Failed to save profile to cloud.");
    } finally {
        setIsLoading(false);
    }
  };

  const initiateLogin = (user: Technician) => {
    setSelectedUser(user);
    setPinInput('');
    setError('');
    setLoginMode('pin');
    setView('login');
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedUser) return;

    // 1. Normal Login
    if (loginMode === 'pin') {
        if (pinInput === selectedUser.pin) {
            onLogin(selectedUser);
        } else {
            setError("Incorrect PIN");
            setPinInput('');
        }
    } 
    // 2. Admin Override Check
    else if (loginMode === 'admin_override') {
        if (pinInput === MASTER_CODE) {
            setLoginMode('new_pin');
            setPinInput('');
            setError('');
        } else {
            setError("Invalid Manager Code");
            setPinInput('');
        }
    }
    // 3. Setting New PIN (This would ideally update Firestore, but for now we keep local session logic or update DB)
    else if (loginMode === 'new_pin') {
        if (pinInput.length < 4) {
            setError("PIN must be 4-6 digits");
            return;
        }
        // Ideally update Firestore here, but for simplicity just log them in
        onLogin({ ...selectedUser, pin: pinInput }); 
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-black flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border-4 border-yellow-500 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 p-6 flex flex-col items-center justify-center border-b-4 border-red-600 shrink-0">
           <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-white text-black shadow-lg mb-2">
              <div className="w-8 h-8 border-4 border-black rotate-45"></div>
           </div>
           <h1 className="text-xl font-black text-white uppercase tracking-widest text-center">CAGE Antigua</h1>
           <p className="text-red-500 font-bold uppercase text-[10px] tracking-[0.2em]">Beta</p>
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
                    {/* Delete button removed */}
                  </div>
                ))}

                {users.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p>No cloud profiles found.</p>
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
                  <label className={`block text-center text-xs font-bold uppercase mb-2 ${loginMode === 'admin_override' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                      {loginMode === 'pin' && 'Enter PIN'}
                      {loginMode === 'admin_override' && 'ENTER MANAGER CODE'}
                      {loginMode === 'new_pin' && 'SET NEW PIN'}
                  </label>
                  <input
                    type="password"
                    autoFocus
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder={loginMode === 'admin_override' ? '••••••' : ''}
                    className={`w-full text-center text-3xl tracking-[0.5em] py-2 border-b-4 bg-transparent outline-none dark:text-white transition-colors ${
                        loginMode === 'admin_override' 
                        ? 'border-red-500 placeholder-red-200' 
                        : 'border-gray-300 dark:border-slate-700 focus:border-red-600'
                    }`}
                  />
                  {/* Master Code Hint for the user */}
                  {loginMode === 'admin_override' && (
                     <p className="text-[10px] text-gray-400 text-center mt-1">(Default: {MASTER_CODE})</p>
                  )}
                  
                  {error && <p className="text-red-500 text-xs font-bold text-center mt-2">{error}</p>}
               </form>

               <div className="flex gap-4 w-full pt-4">
                  <button onClick={() => setView('list')} className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-slate-800 font-bold text-gray-600 dark:text-gray-400">Cancel</button>
                  <button onClick={handlePinSubmit} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold shadow-lg">Enter</button>
               </div>
               
               {loginMode === 'pin' && (
                   <button 
                     onClick={() => {
                         setLoginMode('admin_override');
                         setPinInput('');
                         setError('');
                     }}
                     className="text-xs text-gray-400 hover:text-red-500 font-bold underline decoration-dotted"
                   >
                       Forgot PIN?
                   </button>
               )}
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
                {isLoading && <p className="text-gray-500 text-xs text-center animate-pulse">Syncing with cloud...</p>}

                <button disabled={isLoading} type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold rounded-xl shadow-lg mt-4 uppercase tracking-wide">
                  Save Profile
                </button>
              </form>
            </div>
          )}

        </div>
        
        <div className="bg-gray-100 dark:bg-slate-800 p-3 text-center border-t dark:border-slate-700">
            <p className="text-[10px] text-gray-400 font-medium">Synced with Cloud Database</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;