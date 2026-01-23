import React, { useState, useEffect } from 'react';
import { Technician } from './types';
import LoginScreen from './components/LoginScreen';
import SettingsModal from './components/SettingsModal';
import Dashboard from './components/Dashboard';
import ServiceForm from './components/ServiceForm';
import PMForm from './components/PMForm';
import { auth, db } from './firebase-config';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Technician | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Navigation State
  const [view, setView] = useState<'dashboard' | 'service' | 'pm'>('dashboard');
  
  // Settings & Theme
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Initialize App
  useEffect(() => {
    const initApp = async () => {
        // 1. Theme
        const savedTheme = localStorage.getItem('cage_theme') as 'light' | 'dark';
        if (savedTheme) setTheme(savedTheme);

        // 2. Authenticate
        try {
            if (!auth.currentUser) await auth.signInAnonymously();
        } catch (err) {
            console.warn("Authentication failed, assuming offline mode", err);
        }

        // 3. Auto Login attempt
        const lastUserId = localStorage.getItem('cage_last_user_id');
        if (lastUserId) {
            try {
                // Try Cloud first
                const userDoc = await getDoc(doc(db, 'technicians', lastUserId));
                if (userDoc.exists()) {
                    const userData = userDoc.data() as Omit<Technician, 'id'>;
                    setCurrentUser({ id: userDoc.id, ...userData });
                } else {
                    // Try Local
                     const localTechs = JSON.parse(localStorage.getItem('cage_technicians_local') || '[]');
                     const localUser = localTechs.find((t: Technician) => t.id === lastUserId);
                     if (localUser) setCurrentUser(localUser);
                }
            } catch (e) {
                console.error("Auto-login failed", e);
                // Try Local fallback if cloud error
                 const localTechs = JSON.parse(localStorage.getItem('cage_technicians_local') || '[]');
                 const localUser = localTechs.find((t: Technician) => t.id === lastUserId);
                 if (localUser) setCurrentUser(localUser);
            }
        }
        setIsInitializing(false);
    };

    initApp();
  }, []);

  // Effect to apply theme class
  useEffect(() => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('cage_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
      setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogin = (tech: Technician) => {
    setCurrentUser(tech);
    localStorage.setItem('cage_last_user_id', tech.id);
    setView('dashboard'); // Always go to dashboard on login
  };

  const handleUpdateProfile = async (updatedTech: Technician) => {
      // Update session
      setCurrentUser(updatedTech);

      // 1. Try Firestore
      try {
        const userRef = doc(db, 'technicians', updatedTech.id);
        await updateDoc(userRef, {
            name: updatedTech.name,
            vehicleNumber: updatedTech.vehicleNumber,
            pin: updatedTech.pin
        });
      } catch (e) {
          console.warn("Failed to update profile in cloud, trying local", e);
          // 2. Local Fallback
          try {
             const localTechs = JSON.parse(localStorage.getItem('cage_technicians_local') || '[]');
             const idx = localTechs.findIndex((t: Technician) => t.id === updatedTech.id);
             if (idx >= 0) {
                 localTechs[idx] = updatedTech;
                 localStorage.setItem('cage_technicians_local', JSON.stringify(localTechs));
             }
          } catch (localErr) {
              console.error("Failed local update", localErr);
          }
      }
  };

  const handleLogout = () => {
      // Direct logout without confirmation to prevent blocking issues
      setCurrentUser(null);
      localStorage.removeItem('cage_last_user_id');
      setView('dashboard');
      auth.signOut().catch(console.error);
  };

  const handleDeleteAccount = async () => {
      if (!currentUser) return;
      if (window.confirm("WARNING: Are you sure you want to delete your account? This cannot be undone.")) {
          try {
              await deleteDoc(doc(db, 'technicians', currentUser.id));
          } catch (e) { console.warn("Cloud delete failed", e); }

          try {
              const localTechs = JSON.parse(localStorage.getItem('cage_technicians_local') || '[]');
              const filtered = localTechs.filter((t: Technician) => t.id !== currentUser.id);
              localStorage.setItem('cage_technicians_local', JSON.stringify(filtered));
          } catch(e) { console.error(e) }

          handleLogout();
          setShowSettings(false);
      }
  };

  // ---------------- RENDER ----------------

  if (isInitializing) {
      return (
          <div className="min-h-screen bg-black flex items-center justify-center">
              <div className="text-white text-center">
                  <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="uppercase font-bold tracking-widest text-sm">Loading System...</p>
              </div>
          </div>
      );
  }

  if (!currentUser) {
      return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-orange-50 dark:bg-slate-950 font-sans transition-colors duration-300">
        
        {view === 'dashboard' && (
            <Dashboard 
                currentUser={currentUser} 
                onSelectService={() => setView('service')}
                onSelectPM={() => setView('pm')}
                onLogout={handleLogout}
                onOpenSettings={() => setShowSettings(true)}
            />
        )}

        {view === 'service' && (
            <ServiceForm 
                currentUser={currentUser} 
                onBack={() => setView('dashboard')} 
            />
        )}

        {view === 'pm' && (
            <PMForm 
                currentUser={currentUser} 
                onBack={() => setView('dashboard')} 
            />
        )}

      {currentUser && (
        <SettingsModal 
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            currentUser={currentUser}
            onUpdateProfile={handleUpdateProfile}
            onDeleteAccount={handleDeleteAccount}
            theme={theme}
            onToggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}