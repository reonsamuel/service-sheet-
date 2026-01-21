import React, { useState, useEffect } from 'react';
import { jsPDF } from "jspdf";
import { ServiceFormData, INITIAL_DATA, CallType, AssessmentType, Technician } from './types';
import SignaturePad from './components/SignaturePad';
import TimePicker from './components/TimePicker';
import HistoryModal from './components/HistoryModal';
import LoginScreen from './components/LoginScreen';
import SettingsModal from './components/SettingsModal';
import { PenIcon, ClockIcon, CalendarIcon, CameraIcon, SendIcon, XIcon, SaveIcon, FolderIcon, CheckIcon, LogoutIcon, UserIcon, SettingsIcon } from './components/ui/Icons';
import { auth, storage, db } from './firebase-config';
import { signInAnonymously } from 'firebase/auth';
import { ref, uploadBytes } from 'firebase/storage';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';

// Reusable components for the form
const Label: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <label className={`block text-sm font-bold text-gray-900 dark:text-gray-100 mb-1 tracking-wide uppercase ${className}`}>{children}</label>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full px-3 py-2 border-2 border-gray-800 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-500 transition-all bg-white dark:bg-slate-800 dark:text-white hover:bg-yellow-50 dark:hover:bg-slate-700 ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';

const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className = '', rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={`w-full px-3 py-2 border-2 border-gray-800 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-500 transition-all bg-white dark:bg-slate-800 dark:text-white hover:bg-yellow-50 dark:hover:bg-slate-700 resize-none ${className}`}
    {...props}
  />
));
TextArea.displayName = 'TextArea';

const Checkbox: React.FC<{ 
  label: string; 
  checked: boolean; 
  onChange: () => void; 
}> = ({ 
  label, 
  checked, 
  onChange 
}) => (
  <div 
    onClick={onChange}
    className={`flex items-center space-x-2 cursor-pointer p-3 rounded-lg border-2 transition-all ${checked ? 'bg-orange-100 dark:bg-red-900/30 border-red-600 dark:border-red-500' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 hover:border-orange-300 dark:hover:border-slate-500'}`}
  >
    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? 'bg-red-600 border-red-600' : 'bg-white dark:bg-slate-700 border-gray-400 dark:border-slate-500'}`}>
      {checked && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
    </div>
    <span className={`text-sm font-bold ${checked ? 'text-red-900 dark:text-red-300' : 'text-gray-700 dark:text-gray-300'}`}>{label}</span>
  </div>
);

interface HistoryItem {
  id: string;
  timestamp: number;
  data: ServiceFormData;
}

const LOCAL_REPORTS_KEY = 'cage_service_reports_local';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Technician | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [formData, setFormData] = useState<ServiceFormData>(INITIAL_DATA);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null); // Track ID of currently edited doc
  const [activeSignatureField, setActiveSignatureField] = useState<'tech' | 'agent' | 'official' | null>(null);
  const [activeTimeField, setActiveTimeField] = useState<'arrival' | 'departure' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'local'>('idle');
  
  // Settings & Theme
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Initialize App
  useEffect(() => {
    const initApp = async () => {
        // 1. Theme
        const savedTheme = localStorage.getItem('cage_theme') as 'light' | 'dark';
        if (savedTheme) setTheme(savedTheme);

        // 2. Authenticate
        try {
            if (!auth.currentUser) await signInAnonymously(auth);
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
                    setFormData(prev => ({
                        ...prev,
                        techName: userData.name,
                        vehicleNumber: userData.vehicleNumber
                    }));
                } else {
                    // Try Local
                     const localTechs = JSON.parse(localStorage.getItem('cage_technicians_local') || '[]');
                     const localUser = localTechs.find((t: Technician) => t.id === lastUserId);
                     if (localUser) {
                         setCurrentUser(localUser);
                         setFormData(prev => ({
                            ...prev,
                            techName: localUser.name,
                            vehicleNumber: localUser.vehicleNumber
                        }));
                     }
                }
            } catch (e) {
                console.error("Auto-login failed", e);
                // Try Local fallback if cloud error
                 const localTechs = JSON.parse(localStorage.getItem('cage_technicians_local') || '[]');
                 const localUser = localTechs.find((t: Technician) => t.id === lastUserId);
                 if (localUser) {
                     setCurrentUser(localUser);
                     setFormData(prev => ({
                        ...prev,
                        techName: localUser.name,
                        vehicleNumber: localUser.vehicleNumber
                    }));
                 }
            }
        }
        setIsInitializing(false);
    };

    initApp();
  }, []);

  // Load History when user changes
  useEffect(() => {
    if (currentUser) {
        loadHistory();
    } else {
        setHistory([]);
    }
  }, [currentUser]);

  // Effect to apply theme class
  useEffect(() => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('cage_theme', theme);
  }, [theme]);

  const loadHistory = async () => {
    if (!currentUser) return;
    
    let combinedHistory: HistoryItem[] = [];

    // 1. Local Storage
    try {
        const localData = localStorage.getItem(LOCAL_REPORTS_KEY);
        if (localData) {
            const parsed = JSON.parse(localData);
            // Filter for current user
            const usersLocalReports = parsed.filter((item: any) => item.data.techId === currentUser.id);
            combinedHistory = [...usersLocalReports];
        }
    } catch (e) {
        console.error("Error loading local history", e);
    }

    // 2. Cloud Firestore
    try {
        const q = query(
            collection(db, 'service_reports'), 
            where('techId', '==', currentUser.id)
        );
        const snapshot = await getDocs(q);

        const cloudItems: HistoryItem[] = snapshot.docs.map(doc => ({
            id: doc.id,
            timestamp: doc.data().timestamp?.toMillis() || Date.now(),
            data: doc.data() as ServiceFormData
        }));
        
        combinedHistory = [...combinedHistory, ...cloudItems];
    } catch (e) {
        console.warn("Failed to load cloud history, showing local only", e);
    }

    // Sort Newest first
    combinedHistory.sort((a, b) => b.timestamp - a.timestamp);
    
    // Remove duplicates if any (based on ID)
    const uniqueHistory = Array.from(new Map(combinedHistory.map(item => [item.id, item])).values());
    
    setHistory(uniqueHistory);
  };

  const toggleTheme = () => {
      setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogin = (tech: Technician) => {
    setCurrentUser(tech);
    localStorage.setItem('cage_last_user_id', tech.id);
    setFormData(prev => ({
        ...prev,
        techName: tech.name,
        vehicleNumber: tech.vehicleNumber,
        techSignature: null 
    }));
    setCurrentDocId(null);
  };

  const handleUpdateProfile = async (updatedTech: Technician) => {
      // Update session
      setCurrentUser(updatedTech);
      setFormData(prev => ({
          ...prev,
          techName: updatedTech.name,
          vehicleNumber: updatedTech.vehicleNumber
      }));

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

  const handleLogout = async (skipConfirm = false) => {
      if (skipConfirm || window.confirm("Are you sure you want to log out?")) {
          setCurrentUser(null);
          localStorage.removeItem('cage_last_user_id');
          setFormData(INITIAL_DATA);
          setCurrentDocId(null);
      }
  };

  const handleDeleteAccount = async () => {
      if (!currentUser) return;
      if (window.confirm("WARNING: Are you sure you want to delete your account? This cannot be undone.")) {
          try {
              // Delete user document from Cloud
              await deleteDoc(doc(db, 'technicians', currentUser.id));
          } catch (e) {
              console.warn("Cloud delete failed", e);
          }

          try {
              // Delete from Local
              const localTechs = JSON.parse(localStorage.getItem('cage_technicians_local') || '[]');
              const filtered = localTechs.filter((t: Technician) => t.id !== currentUser.id);
              localStorage.setItem('cage_technicians_local', JSON.stringify(filtered));
          } catch(e) { console.error(e) }

          // Logout immediately
          setCurrentUser(null);
          localStorage.removeItem('cage_last_user_id');
          setFormData(INITIAL_DATA);
          setCurrentDocId(null);
          setShowSettings(false);
      }
  };

  const handleInputChange = (field: keyof ServiceFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTimeClick = (field: 'arrival' | 'departure') => {
    setActiveTimeField(field);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange('receiptImage', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    handleInputChange('receiptImage', null);
  };

  const saveToLocalStorage = (data: ServiceFormData, id: string) => {
      const allReports = JSON.parse(localStorage.getItem(LOCAL_REPORTS_KEY) || '[]');
      
      const newReport = {
          id: id,
          timestamp: Date.now(),
          data: { ...data, techId: currentUser?.id }
      };

      const existingIndex = allReports.findIndex((r: any) => r.id === id);
      if (existingIndex >= 0) {
          allReports[existingIndex] = newReport;
      } else {
          allReports.push(newReport);
      }
      
      localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(allReports));
  };

  const handleSave = async () => {
    if (saveStatus !== 'idle' || !currentUser) return;

    setSaveStatus('saving');
    
    // Determine ID
    let docId = currentDocId;
    if (!docId) docId = 'local_draft_' + Date.now();
    setCurrentDocId(docId); // Lock to this ID for future saves

    try {
        // Try Cloud First
        if (docId.startsWith('local_')) {
            // It was a local draft, try to promote to cloud if we can?
            // Actually, if we have a cloud ID, use it. If not, try addDoc to get one.
            // But if permissions fail, addDoc throws.
             const docRef = await addDoc(collection(db, 'service_reports'), {
                ...formData,
                techId: currentUser.id,
                timestamp: serverTimestamp()
            });
            // Update to real ID
            setCurrentDocId(docRef.id);
            docId = docRef.id;
        } else {
            // Update existing cloud doc
            const docRef = doc(db, 'service_reports', docId);
            await updateDoc(docRef, {
                ...formData,
                timestamp: serverTimestamp()
            });
        }
        setSaveStatus('success');
    } catch (e) {
        console.warn("Cloud save failed, saving locally", e);
        // Fallback to local
        saveToLocalStorage(formData, docId);
        setSaveStatus('local');
    }

    // Reload history
    await loadHistory();

    setTimeout(() => {
      setSaveStatus('idle');
    }, 2000);
  };

  const deleteHistoryItem = async (id: string) => {
    if(window.confirm("Delete this draft permanently?")) {
        // Try Cloud Delete
        try {
            await deleteDoc(doc(db, 'service_reports', id));
        } catch (e) {
            console.warn("Cloud delete failed", e);
        }

        // Try Local Delete
        const allReports = JSON.parse(localStorage.getItem(LOCAL_REPORTS_KEY) || '[]');
        const filtered = allReports.filter((r: any) => r.id !== id);
        localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(filtered));

        // Update UI
        setHistory(prev => prev.filter(item => item.id !== id));
            
        // If deleting currently loaded doc, clear the ID
        if (id === currentDocId) {
            setCurrentDocId(null);
            // Optionally clear form? No, keeps data as template.
        }
    }
  };

  const loadHistoryItem = (data: ServiceFormData, id: string) => {
    if (window.confirm("Loading this document will replace your current unsaved changes. Continue?")) {
      setFormData(data);
      setCurrentDocId(id); // Set the ID so saving updates THIS document
    }
  };

  /**
   * Generates the PDF blob.
   */
  const generatePDFBlob = async (data: ServiceFormData): Promise<{blob: Blob, doc: jsPDF}> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    // --- Header ---
    doc.setFillColor(180, 20, 20); // Dark Red
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 200); // Yellowish
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("CAGE Antigua-Barbuda", margin, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Technical Operations Service Call Sheet", margin, 28);
    
    yPos = 50;
    let hasImage = false;
    
    if (data.receiptImage) {
        try {
            const imgWidth = 80;
            const imgHeight = 80;
            const xPos = pageWidth - imgWidth - margin;
            doc.addImage(data.receiptImage, 'JPEG', xPos, yPos, imgWidth, imgHeight, undefined, 'FAST');
            doc.setDrawColor(50);
            doc.setLineWidth(0.5);
            doc.rect(xPos, yPos, imgWidth, imgHeight);
            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text("Attached Receipt / Proof", xPos, yPos + imgHeight + 5);
            hasImage = true;
        } catch (e) {
            console.error("Error adding image to PDF", e);
        }
    }

    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setLineWidth(0.1);
    
    const leftColX = margin;
    const addField = (label: string, value: string, x: number, y: number) => {
        doc.setFont("helvetica", "bold");
        doc.text(label + ":", x, y);
        doc.setFont("helvetica", "normal");
        const val = value || "N/A";
        doc.text(val, x + doc.getTextWidth(label + ":") + 2, y);
    };

    let infoY = yPos;
    const lineHeight = 7;

    addField("Call Type", data.callType || "N/A", leftColX, infoY); infoY += lineHeight;
    addField("Shop Name", data.shopName, leftColX, infoY); infoY += lineHeight;
    addField("Date", data.date, leftColX, infoY); infoY += lineHeight;
    addField("System Type", data.systemType, leftColX, infoY); infoY += lineHeight;
    addField("Terminal #", data.terminalNumber, leftColX, infoY); infoY += lineHeight;
    addField("Tech Name", data.techName, leftColX, infoY); infoY += lineHeight;
    addField("Vehicle #", data.vehicleNumber, leftColX, infoY); infoY += lineHeight;
    addField("Arrival", data.arrivalTime, leftColX, infoY); infoY += lineHeight;
    addField("Departure", data.departureTime, leftColX, infoY); infoY += lineHeight;

    yPos = Math.max(infoY + 10, hasImage ? 50 + 80 + 15 : infoY + 10);

    const addSection = (title: string, content: string) => {
        if (yPos > 260) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.setFillColor(245, 245, 245); 
        doc.rect(margin, yPos - 4, pageWidth - (margin*2), 6, 'F');
        doc.text(title, margin + 2, yPos);
        yPos += 6;
        doc.setFont("helvetica", "normal");
        const splitText = doc.splitTextToSize(content || "No details provided.", pageWidth - (margin*2));
        doc.text(splitText, margin, yPos);
        yPos += (splitText.length * 5) + 6;
    };

    addSection("Fault Reported", data.faultReported);
    addSection("Fault Encountered", data.faultEncountered);
    addSection("Repairs Made", data.repairsMade);
    addSection("Parts Used", data.partsUsed);
    addSection("Other Comments", data.otherComments);

    if (yPos > 260) { doc.addPage(); yPos = 20; }
    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Agent Assessment: " + (data.agentAssessment || "N/A"), margin, yPos);
    yPos += 15;
    
    if (yPos > 230) {
        doc.addPage();
        yPos = 30;
    }

    const sigWidth = 50;
    const sigHeight = 25;
    
    doc.setFontSize(8);
    doc.text("Technician Signature", margin, yPos);
    if (data.techSignature) {
        doc.addImage(data.techSignature, 'PNG', margin, yPos + 2, sigWidth, sigHeight);
    }
    doc.text("Date: " + data.techSignDate, margin, yPos + sigHeight + 8);
    
    const midX = pageWidth / 2 - (sigWidth / 2);
    doc.text("Agent Signature", midX, yPos);
    if (data.agentSignature) {
        doc.addImage(data.agentSignature, 'PNG', midX, yPos + 2, sigWidth, sigHeight);
    }
    doc.text("Date: " + data.agentSignDate, midX, yPos + sigHeight + 8);
    
    const rightX = pageWidth - margin - sigWidth;
    doc.text("Dispatcher / Supervisor", rightX, yPos);
    if (data.officialDispatcherSignature) {
        doc.addImage(data.officialDispatcherSignature, 'PNG', rightX, yPos + 2, sigWidth, sigHeight);
    }
    doc.text("Date: " + data.officialDispatcherDate, rightX, yPos + sigHeight + 8);

    return { blob: doc.output('blob'), doc: doc };
  };

  const handleOfflineSubmit = (pdfDoc: jsPDF, fileName: string) => {
      // 1. Download
      pdfDoc.save(fileName);
      
      // 2. Local Save (Backup)
      handleSave();

      // 3. Email
      const emailData = {
        subject: `Service Call Sheet - ${formData.shopName} - ${formData.date}`,
        body: `Service Call Sheet attached.\n\nTech: ${formData.techName}\nShop: ${formData.shopName}`
      };
      
      const subject = encodeURIComponent(emailData.subject);
      const body = encodeURIComponent(emailData.body);
      
      setTimeout(() => {
          if (confirm("PDF Downloaded! Do you want to open your email app now?")) {
            window.location.href = `mailto:?subject=${subject}&body=${body}`;
          }
      }, 1000);
      
      setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!formData.techSignature) {
        alert("Please sign the document before submitting.");
        return;
    }
    if (!currentUser) {
        alert("You must be logged in to submit.");
        return;
    }
    
    setIsSubmitting(true);
    
    try {
        const fileName = `ServiceCall_${formData.shopName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        const { blob: pdfBlob, doc: pdfDoc } = await generatePDFBlob(formData);

        // --- CLOUD UPLOAD ATTEMPT ---
        try {
            if (storage && navigator.onLine) {
                 const storageRef = ref(storage, `service_sheets/${currentUser.id}/${fileName}`);
                 await uploadBytes(storageRef, pdfBlob);
            }
        } catch (e) {
            console.log("Cloud upload skipped or failed", e);
        }
        
        // --- OFFLINE / EMAIL HANDOFF ---
        handleOfflineSubmit(pdfDoc, fileName);

    } catch (error: any) {
        console.error("Submission failed", error);
        alert("Error generating document: " + error.message);
    } finally {
        setIsSubmitting(false);
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
    <div className="min-h-screen bg-orange-50 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 shadow-2xl rounded-xl overflow-hidden border-2 border-black dark:border-slate-700 transition-colors">
        
        {/* Header */}
        <div className="bg-red-700 dark:bg-red-900 p-4 md:p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-black dark:border-slate-800 relative transition-colors">
          
          {/* User Info & Actions (Top Right) */}
          {/* Increased Z-Index to 50 to ensure it's always above other content */}
          <div className="absolute top-4 right-4 flex gap-2 z-50">
            <button 
                onClick={() => setShowSettings(true)}
                className="bg-white/20 hover:bg-white/30 p-2 md:p-3 rounded-lg transition-colors flex items-center gap-2 border border-white/30 backdrop-blur-sm shadow-md"
                title="Settings"
            >
                <SettingsIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </button>
            <button 
                onClick={() => setShowHistory(true)}
                className="bg-white/20 hover:bg-white/30 p-2 md:p-3 rounded-lg transition-colors flex items-center gap-2 border border-white/30 backdrop-blur-sm shadow-md"
                title="Open History"
            >
                <FolderIcon className="w-5 h-5 md:w-6 md:h-6 text-yellow-300" />
            </button>
             <button 
                onClick={() => handleLogout()}
                className="bg-white/20 hover:bg-red-900/50 p-2 md:p-3 rounded-lg transition-colors flex items-center gap-2 border border-white/30 backdrop-blur-sm shadow-md"
                title="Logout"
            >
                <LogoutIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </button>
          </div>

          {/* Logo Section - Added more top margin on mobile to prevent overlap */}
          <div className="flex items-center gap-4 w-full md:w-auto mt-12 md:mt-0">
             {/* Logo Placeholder */}
            <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-black text-black shadow-lg flex-shrink-0">
              <div className="w-8 h-8 border-4 border-black rotate-45"></div>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase text-yellow-400 drop-shadow-sm">CAGE Antigua-Barbuda</h1>
              <p className="text-orange-200 text-xs md:text-sm font-bold tracking-wider">Technical Operations</p>
              
              {/* User Badge */}
              <div className="mt-1 inline-flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded text-xs font-medium text-white/90">
                 <UserIcon className="w-3 h-3" />
                 <span>{currentUser.name} ({currentUser.vehicleNumber})</span>
              </div>
            </div>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-wide uppercase border-b-4 border-yellow-400 pb-1 text-white text-center md:text-right w-full md:w-auto mt-4 md:mt-0">Service Call Sheet</h2>
        </div>

        {/* Form Content */}
        <div className="p-6 md:p-10 space-y-8">
          
          {/* Top Row: Call Type & Receipt */}
          <div className="flex flex-col-reverse md:flex-row gap-6 justify-between items-start">
              {/* Call Type Section */}
              <div className="flex-1 w-full bg-yellow-50 dark:bg-slate-800 p-6 rounded-lg border-2 border-orange-200 dark:border-slate-600 shadow-sm transition-colors">
                <Label className="mb-4 text-lg text-red-700 dark:text-red-400">Call Type</Label>
                <div className="flex flex-wrap gap-4">
                  {['New Service Call', 'Repeat Call', 'Schedule Maintenance'].map((type) => (
                    <Checkbox
                      key={type}
                      label={type}
                      checked={formData.callType === type}
                      onChange={() => handleInputChange('callType', type as CallType)}
                    />
                  ))}
                </div>
              </div>

              {/* Receipt / Proof Section (Top Right) */}
              <div className="w-full md:w-64 flex-shrink-0">
                 <Label className="mb-2 text-right md:text-left">Receipt / Proof of Visit</Label>
                 <div className="relative w-full h-40 border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-lg hover:border-red-500 hover:bg-red-50 dark:hover:bg-slate-700 transition-all bg-gray-50 dark:bg-slate-800 overflow-hidden group">
                    <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        onChange={handleImageUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    
                    {formData.receiptImage ? (
                        <div className="w-full h-full relative">
                            <img src={formData.receiptImage} alt="Receipt" className="w-full h-full object-cover" />
                            <button 
                                onClick={removeImage}
                                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700 z-20"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-red-500 dark:group-hover:text-red-400">
                            <CameraIcon className="w-10 h-10 mb-2" />
                            <span className="text-xs font-bold uppercase text-center px-4">Tap to capture image</span>
                        </div>
                    )}
                 </div>
              </div>
          </div>

          {/* Section 2: Basic Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label>Shop Name</Label>
              <Input 
                value={formData.shopName}
                onChange={(e) => handleInputChange('shopName', e.target.value)}
                placeholder="Enter shop name"
              />
            </div>
            <div>
              <Label>System Type</Label>
              <Input 
                value={formData.systemType}
                onChange={(e) => handleInputChange('systemType', e.target.value)}
                placeholder="Enter system type"
              />
            </div>

            <div>
              <Label>Terminal #</Label>
              <Input 
                value={formData.terminalNumber}
                onChange={(e) => handleInputChange('terminalNumber', e.target.value)}
                placeholder="Ex. 12345"
              />
            </div>
            <div>
              <Label>Date</Label>
              <div className="relative">
                <Input 
                  type="date" 
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="pl-10"
                />
                <CalendarIcon className="absolute left-3 top-2.5 w-5 h-5 text-red-600 pointer-events-none" />
              </div>
            </div>

            <div>
              <Label>Arrival Time</Label>
              <div className="relative cursor-pointer group" onClick={() => handleTimeClick('arrival')}>
                <Input 
                  value={formData.arrivalTime}
                  readOnly
                  placeholder="Tap to set time"
                  className="pl-10 cursor-pointer pointer-events-none group-hover:bg-yellow-50 dark:group-hover:bg-slate-700" 
                />
                <ClockIcon className="absolute left-3 top-2.5 w-5 h-5 text-red-600" />
              </div>
            </div>
            <div>
              <Label>Departure Time</Label>
               <div className="relative cursor-pointer group" onClick={() => handleTimeClick('departure')}>
                <Input 
                  value={formData.departureTime}
                  readOnly
                  placeholder="Tap to set time"
                  className="pl-10 cursor-pointer pointer-events-none group-hover:bg-yellow-50 dark:group-hover:bg-slate-700"
                />
                <ClockIcon className="absolute left-3 top-2.5 w-5 h-5 text-red-600" />
              </div>
            </div>

            <div>
              <Label>Vehicle #</Label>
              <Input 
                value={formData.vehicleNumber}
                readOnly
                className="bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 cursor-not-allowed" // Visual cue that it's auto-filled
              />
            </div>
            <div>
              <Label>Tech's Name</Label>
              <Input 
                value={formData.techName}
                readOnly
                className="bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 cursor-not-allowed" // Visual cue that it's auto-filled
              />
            </div>
          </div>

          {/* Section 3: Details */}
          <div className="space-y-6">
            <div>
              <Label>Fault Reported</Label>
              <TextArea 
                value={formData.faultReported}
                onChange={(e) => handleInputChange('faultReported', e.target.value)}
                placeholder="Describe the reported fault..."
                className="bg-red-50/30 dark:bg-red-900/10 focus:bg-white dark:focus:bg-slate-800"
              />
            </div>
            
            <div>
              <Label>Fault Encountered</Label>
              <TextArea 
                value={formData.faultEncountered}
                onChange={(e) => handleInputChange('faultEncountered', e.target.value)}
                placeholder="Describe what was actually found..."
              />
            </div>

            <div>
              <Label>Repairs Made</Label>
              <TextArea 
                value={formData.repairsMade}
                onChange={(e) => handleInputChange('repairsMade', e.target.value)}
                placeholder="List repairs completed..."
                className="bg-green-50/30 dark:bg-green-900/10 focus:bg-white dark:focus:bg-slate-800"
              />
            </div>

            <div>
              <Label>Parts Used / Replaced</Label>
              <TextArea 
                value={formData.partsUsed}
                onChange={(e) => handleInputChange('partsUsed', e.target.value)}
                placeholder="List any parts..."
              />
            </div>

            <div>
              <Label>Other Comments</Label>
              <TextArea 
                value={formData.otherComments}
                onChange={(e) => handleInputChange('otherComments', e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Section 4: Assessment */}
          <div className="bg-orange-50 dark:bg-slate-800 p-6 rounded-lg border-2 border-orange-200 dark:border-slate-600 transition-colors">
            <Label className="mb-4 text-lg text-red-700 dark:text-red-400">Agent's Assessment</Label>
            <div className="flex flex-wrap gap-6">
              {['Excellent', 'Satisfactory', 'Unsatisfactory'].map((rating) => (
                <Checkbox
                  key={rating}
                  label={rating}
                  checked={formData.agentAssessment === rating}
                  onChange={() => handleInputChange('agentAssessment', rating as AssessmentType)}
                />
              ))}
            </div>
          </div>

          {/* Section 5: Signatures */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            
            {/* Tech Signature */}
            <div className="space-y-4">
              <Label>Tech's Signature</Label>
              <div 
                onClick={() => setActiveSignatureField('tech')}
                className="border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 hover:bg-red-50 dark:hover:bg-slate-700 transition-all group relative overflow-hidden bg-white dark:bg-slate-800"
              >
                {formData.techSignature ? (
                  <img src={formData.techSignature} alt="Tech Signature" className="h-full object-contain p-2 dark:invert" />
                ) : (
                  <>
                    <PenIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 group-hover:text-red-500 mb-2" />
                    <span className="text-gray-400 dark:text-gray-500 font-bold text-sm group-hover:text-red-600 dark:group-hover:text-red-400">TAP TO SIGN</span>
                  </>
                )}
              </div>
              <div>
                 <Label>Date</Label>
                 <Input 
                   type="date"
                   value={formData.techSignDate}
                   onChange={(e) => handleInputChange('techSignDate', e.target.value)}
                 />
              </div>
            </div>

            {/* Agent Signature */}
            <div className="space-y-4">
              <Label>Agent's Signature</Label>
              <div 
                onClick={() => setActiveSignatureField('agent')}
                className="border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 hover:bg-red-50 dark:hover:bg-slate-700 transition-all group relative overflow-hidden bg-white dark:bg-slate-800"
              >
                 {formData.agentSignature ? (
                  <img src={formData.agentSignature} alt="Agent Signature" className="h-full object-contain p-2 dark:invert" />
                ) : (
                  <>
                    <PenIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 group-hover:text-red-500 mb-2" />
                    <span className="text-gray-400 dark:text-gray-500 font-bold text-sm group-hover:text-red-600 dark:group-hover:text-red-400">TAP TO SIGN</span>
                  </>
                )}
              </div>
              <div>
                 <Label>Date</Label>
                 <Input 
                   type="date"
                   value={formData.agentSignDate}
                   onChange={(e) => handleInputChange('agentSignDate', e.target.value)}
                 />
              </div>
            </div>
          </div>
          
          <hr className="border-gray-200 dark:border-slate-700 my-6" />

          {/* Official Use */}
          <div className="bg-gray-100 dark:bg-slate-800 p-6 rounded-lg border-2 border-gray-300 dark:border-slate-600 transition-colors">
            <h3 className="text-xs uppercase font-black text-gray-500 dark:text-gray-400 tracking-wider mb-4 border-b-2 border-gray-300 dark:border-slate-600 pb-2">Official Use Only</h3>
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="flex-1 w-full">
                 <Label>Received by (Dispatcher / Supervisor)</Label>
                 <div 
                  onClick={() => setActiveSignatureField('official')}
                  className="mt-2 border-2 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 h-16 rounded-md flex items-center justify-center cursor-pointer hover:border-red-500 transition-colors"
                 >
                    {formData.officialDispatcherSignature ? (
                       <img src={formData.officialDispatcherSignature} alt="Official Signature" className="h-full object-contain p-1 dark:invert" />
                    ) : (
                       <span className="text-gray-400 dark:text-gray-500 text-sm font-bold">TAP TO SIGN</span>
                    )}
                 </div>
              </div>
               <div className="w-full md:w-48">
                 <Label>Date</Label>
                 <Input 
                   type="date"
                   value={formData.officialDispatcherDate}
                   onChange={(e) => handleInputChange('officialDispatcherDate', e.target.value)}
                 />
              </div>
            </div>
          </div>

          {/* Action Buttons (Save & Submit) */}
          <div className="pt-8 flex flex-col md:flex-row justify-center gap-6">
            
            {/* Save Button */}
            <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className={`flex items-center justify-center gap-3 px-8 py-4 rounded-full text-lg font-bold uppercase tracking-wider shadow-lg transform transition-all active:scale-95 border-4 border-black dark:border-slate-600 w-full md:w-auto overflow-hidden relative ${
                    saveStatus === 'success' || saveStatus === 'local'
                    ? 'bg-green-500 text-white border-green-700' 
                    : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-xl hover:-translate-y-1'
                }`}
            >
                {saveStatus === 'idle' && (
                    <>
                        <SaveIcon className="w-6 h-6" />
                        Save to Folder
                    </>
                )}
                {saveStatus === 'saving' && (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                    </>
                )}
                {(saveStatus === 'success' || saveStatus === 'local') && (
                    <div className="flex items-center gap-2 animate-fade-in">
                        <CheckIcon className="w-6 h-6" />
                        {saveStatus === 'local' ? 'Saved Locally' : 'Saved to Cloud'}
                    </div>
                )}
            </button>

            {/* Submit Button */}
            <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`flex items-center justify-center gap-3 px-8 py-4 rounded-full text-lg font-bold uppercase tracking-wider shadow-lg transform transition-all active:scale-95 border-4 border-black dark:border-slate-600 w-full md:w-auto ${
                    isSubmitting 
                    ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
                    : 'bg-green-500 text-white hover:bg-green-600 hover:shadow-xl hover:-translate-y-1'
                }`}
            >
                {isSubmitting ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                    </>
                ) : (
                    <>
                        <SendIcon className="w-6 h-6" />
                        Download & Email
                    </>
                )}
            </button>
          </div>

        </div>
      </div>

      {/* Modals */}
      <SignaturePad 
        isOpen={activeSignatureField !== null}
        onClose={() => setActiveSignatureField(null)}
        onSave={(dataUrl) => {
          if (activeSignatureField === 'tech') handleInputChange('techSignature', dataUrl);
          if (activeSignatureField === 'agent') handleInputChange('agentSignature', dataUrl);
          if (activeSignatureField === 'official') handleInputChange('officialDispatcherSignature', dataUrl);
          setActiveSignatureField(null); // Close on save
        }}
        title={
          activeSignatureField === 'tech' ? "Technician Signature" :
          activeSignatureField === 'agent' ? "Agent Signature" : "Supervisor Signature"
        }
      />

      <TimePicker 
        isOpen={activeTimeField !== null}
        onClose={() => setActiveTimeField(null)}
        onSave={(time) => {
          if (activeTimeField === 'arrival') handleInputChange('arrivalTime', time);
          if (activeTimeField === 'departure') handleInputChange('departureTime', time);
        }}
        initialValue={
          activeTimeField === 'arrival' ? formData.arrivalTime : 
          activeTimeField === 'departure' ? formData.departureTime : undefined
        }
      />

      <HistoryModal 
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
        onLoad={loadHistoryItem}
        onDelete={deleteHistoryItem}
      />

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