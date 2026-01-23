import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from "jspdf";
import { PMFormData, INITIAL_PM_DATA, Technician, PM_CHECKLIST_ITEMS } from '../types';
import SignaturePad from './SignaturePad';
import TimePicker from './TimePicker';
import HistoryModal from './HistoryModal';
import SignatureManager from './SignatureManager';
import { PenIcon, ClockIcon, CalendarIcon, SendIcon, SaveIcon, FolderIcon, CheckIcon, UserIcon, ClipboardListIcon } from './ui/Icons';
import { storage, db } from '../firebase-config';
import { ref, uploadBytes } from 'firebase/storage';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';

const Label: React.FC<{ children?: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }> = ({ children, className = '', onClick }) => (
  <label onClick={onClick} className={`block text-sm font-bold text-gray-900 dark:text-gray-100 mb-1 tracking-wide uppercase ${className} ${onClick ? 'select-none' : ''}`}>{children}</label>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full px-3 py-2 border-2 border-gray-800 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 transition-all bg-white dark:bg-slate-800 dark:text-white hover:bg-blue-50 dark:hover:bg-slate-700 ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';

const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className = '', rows = 3, ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={`w-full px-3 py-2 border-2 border-gray-800 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 transition-all bg-white dark:bg-slate-800 dark:text-white hover:bg-blue-50 dark:hover:bg-slate-700 resize-none ${className}`}
    {...props}
  />
));
TextArea.displayName = 'TextArea';

interface HistoryItem {
  id: string;
  timestamp: number;
  data: any;
}

const LOCAL_PM_KEY = 'cage_pm_reports_local';

interface PMFormProps {
    currentUser: Technician;
    onBack: () => void;
}

export default function PMForm({ currentUser, onBack }: PMFormProps) {
  const [formData, setFormData] = useState<PMFormData>(INITIAL_PM_DATA);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [activeSignatureField, setActiveSignatureField] = useState<'tech' | 'agent' | 'supervisor' | null>(null);
  const [activeTimeField, setActiveTimeField] = useState<'arrival' | 'departure' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'local'>('idle');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSigManager, setShowSigManager] = useState(false);

  // Secret Tap Logic
  const secretTapRef = useRef({ count: 0, lastTap: 0 });

  const handleSecretTap = (e: React.MouseEvent) => {
    e.preventDefault();
    const now = Date.now();
    const ref = secretTapRef.current;
    
    // Reset if more than 1 second passed since last tap
    if (now - ref.lastTap > 1000) {
        ref.count = 0;
    }
    
    ref.count++;
    ref.lastTap = now;

    if (ref.count >= 5) {
        setShowSigManager(true);
        ref.count = 0;
    }
  };

  useEffect(() => {
    setFormData(prev => ({
        ...prev,
        techName: currentUser.name
    }));
    loadHistory();
  }, [currentUser]);

  const loadHistory = async () => {
    if (!currentUser) return;
    
    let combinedHistory: HistoryItem[] = [];

    // Local
    try {
        const localData = localStorage.getItem(LOCAL_PM_KEY);
        if (localData) {
            const parsed = JSON.parse(localData);
            const usersLocalReports = parsed.filter((item: any) => item.data.techId === currentUser.id);
            combinedHistory = [...usersLocalReports];
        }
    } catch (e) {
        console.error(e);
    }

    // Cloud
    try {
        const q = query(
            collection(db, 'pm_reports'), 
            where('techId', '==', currentUser.id)
        );
        const snapshot = await getDocs(q);

        const cloudItems: HistoryItem[] = snapshot.docs.map(doc => ({
            id: doc.id,
            timestamp: doc.data().timestamp?.toMillis() || Date.now(),
            data: doc.data() as PMFormData
        }));
        
        combinedHistory = [...combinedHistory, ...cloudItems];
    } catch (e) {
        console.warn("Failed to load cloud history", e);
    }

    combinedHistory.sort((a, b) => b.timestamp - a.timestamp);
    const uniqueHistory = Array.from(new Map(combinedHistory.map(item => [item.id, item])).values());
    setHistory(uniqueHistory);
  };

  const handleInputChange = (field: keyof PMFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCheck = (index: number) => {
      const newChecks = [...formData.checks];
      newChecks[index] = !newChecks[index];
      setFormData(prev => ({ ...prev, checks: newChecks }));
  };

  const saveToLocalStorage = (data: PMFormData, id: string) => {
      const allReports = JSON.parse(localStorage.getItem(LOCAL_PM_KEY) || '[]');
      const newReport = {
          id: id,
          timestamp: Date.now(),
          data: { ...data, techId: currentUser?.id }
      };
      const existingIndex = allReports.findIndex((r: any) => r.id === id);
      if (existingIndex >= 0) allReports[existingIndex] = newReport;
      else allReports.push(newReport);
      localStorage.setItem(LOCAL_PM_KEY, JSON.stringify(allReports));
  };

  const handleSave = async () => {
    if (saveStatus !== 'idle' || !currentUser) return;
    setSaveStatus('saving');
    
    let docId = currentDocId;
    if (!docId) docId = 'local_pm_' + Date.now();
    setCurrentDocId(docId);

    try {
        if (docId.startsWith('local_')) {
             const docRef = await addDoc(collection(db, 'pm_reports'), {
                ...formData,
                techId: currentUser.id,
                timestamp: serverTimestamp()
            });
            setCurrentDocId(docRef.id);
            docId = docRef.id;
        } else {
            const docRef = doc(db, 'pm_reports', docId);
            await updateDoc(docRef, {
                ...formData,
                timestamp: serverTimestamp()
            });
        }
        setSaveStatus('success');
    } catch (e) {
        console.warn("Cloud save failed, saving locally", e);
        saveToLocalStorage(formData, docId);
        setSaveStatus('local');
    }
    await loadHistory();
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const deleteHistoryItem = async (id: string) => {
    if(window.confirm("Delete this PM report?")) {
        try { await deleteDoc(doc(db, 'pm_reports', id)); } catch(e) {}
        const allReports = JSON.parse(localStorage.getItem(LOCAL_PM_KEY) || '[]');
        const filtered = allReports.filter((r: any) => r.id !== id);
        localStorage.setItem(LOCAL_PM_KEY, JSON.stringify(filtered));
        setHistory(prev => prev.filter(item => item.id !== id));
        if (id === currentDocId) setCurrentDocId(null);
    }
  };

  const loadHistoryItem = (data: PMFormData, id: string) => {
    if (window.confirm("Load this report? Unsaved changes will be lost.")) {
      setFormData(data);
      setCurrentDocId(id);
    }
  };

  const generatePDFBlob = async (data: PMFormData): Promise<{blob: Blob, doc: jsPDF}> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("CAGE Antigua-Barbuda Ltd", pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    doc.text("PM Check List", pageWidth / 2, yPos, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(pageWidth / 2 - 30, yPos + 2, pageWidth / 2 + 30, yPos + 2);
    yPos += 20;

    // Info Fields
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    
    const drawField = (label: string, value: string, x: number, y: number, w: number) => {
        doc.text(label, x, y);
        doc.setFont("helvetica", "normal");
        doc.line(x + doc.getTextWidth(label) + 2, y + 1, x + w, y + 1);
        doc.text(value, x + doc.getTextWidth(label) + 4, y);
        doc.setFont("helvetica", "bold");
    };

    drawField("Agent:", data.agentName, margin, yPos, 80);
    drawField("Date:", data.date, pageWidth - margin - 60, yPos, 60);
    yPos += 12;
    drawField("Arrival time:", data.arrivalTime, margin, yPos, 80);
    drawField("Departure time:", data.departureTime, pageWidth - margin - 60, yPos, 60);
    yPos += 12;
    drawField("System:", data.systemType, margin, yPos, 60);
    yPos += 20;

    // Checklist
    doc.setFont("helvetica", "normal");
    PM_CHECKLIST_ITEMS.forEach((item, index) => {
        if (yPos > 270) { doc.addPage(); yPos = 20; }
        
        doc.text(item, margin, yPos);
        
        // Checkbox
        const boxX = pageWidth - margin - 10;
        doc.rect(boxX, yPos - 4, 6, 6);
        if (data.checks[index]) {
            doc.setFont("zapfdingbats");
            doc.text("4", boxX + 1, yPos); // Checkmark in zapfdingbats
            doc.setFont("helvetica", "normal");
        }
        yPos += 10;
    });

    yPos += 10;

    // Text Areas
    const addSection = (label: string, content: string) => {
        if (yPos > 260) { doc.addPage(); yPos = 20; }
        doc.text(label, margin, yPos);
        doc.line(margin + doc.getTextWidth(label) + 2, yPos + 1, pageWidth - margin, yPos + 1);
        yPos += 6;
        const splitText = doc.splitTextToSize(content, pageWidth - margin * 2);
        doc.text(splitText, margin, yPos);
        yPos += (splitText.length * 6) + 6;
        doc.line(margin, yPos, pageWidth - margin, yPos); // extra underline for writing space visual
        yPos += 10;
    };

    addSection("Parts used:", data.partsUsed);
    addSection("Comments:", data.comments);

    // Signatures
    if (yPos > 240) { doc.addPage(); yPos = 30; }
    yPos += 10;
    
    const sigW = 40;
    const sigH = 20;
    
    // Agent
    doc.text("Agent's Signature:", margin, yPos);
    if (data.agentSignature) doc.addImage(data.agentSignature, 'PNG', margin + 35, yPos - 15, sigW, sigH);
    doc.line(margin + 35, yPos, margin + 85, yPos);
    doc.text("Date: " + data.agentSignDate, margin + 90, yPos);
    doc.line(margin + 102, yPos + 1, margin + 140, yPos + 1);
    
    yPos += 25;

    // Tech
    doc.text("Tech's Signature:", margin, yPos);
    if (data.techSignature) doc.addImage(data.techSignature, 'PNG', margin + 35, yPos - 15, sigW, sigH);
    doc.line(margin + 35, yPos, margin + 85, yPos);
    
    yPos += 25;

    // Supervisor
    doc.text("Received by: Dispatcher / Supervisor's signature & date:", margin, yPos);
    if (data.supervisorSignature) doc.addImage(data.supervisorSignature, 'PNG', margin + 95, yPos - 15, sigW, sigH);
    doc.line(margin + 95, yPos, pageWidth - margin, yPos);
    
    return { blob: doc.output('blob'), doc: doc };
  };

  const handleSubmit = async () => {
     if (!formData.techSignature) return alert("Technician signature required.");
     setIsSubmitting(true);
     try {
         const fileName = `PM_${formData.agentName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
         const { blob, doc: pdfDoc } = await generatePDFBlob(formData);
         
         if (storage && navigator.onLine) {
            try {
                await uploadBytes(ref(storage, `pm_reports/${currentUser.id}/${fileName}`), blob);
            } catch(e) { console.log(e); }
         }
         
         pdfDoc.save(fileName);
         handleSave();
         
         setTimeout(() => {
             if (confirm("PDF Downloaded. Open Email?")) {
                 window.location.href = `mailto:?subject=PM Checklist&body=Attached`;
             }
         }, 1000);

     } catch (e: any) {
         alert("Error: " + e.message);
     } finally {
         setIsSubmitting(false);
     }
  };

  return (
    <div className="w-full">
         <div className="bg-blue-700 dark:bg-blue-900 p-4 md:p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-black dark:border-slate-800 shadow-lg relative">
             <div className="absolute top-4 left-4">
              <button onClick={onBack} className="flex items-center gap-1 text-white/80 hover:text-white font-bold uppercase text-xs">
                  &larr; Dashboard
              </button>
            </div>
             <div className="absolute top-4 right-4 z-50">
                 <button onClick={() => setShowHistory(true)} className="bg-white/20 p-2 rounded-lg"><FolderIcon className="w-5 h-5 text-yellow-300" /></button>
             </div>
             
             <div className="flex items-center gap-4 mt-8 md:mt-0">
                 <div className="p-3 bg-white/10 rounded-xl"><ClipboardListIcon className="w-10 h-10 text-white" /></div>
                 <div>
                    <h1 className="text-xl font-black uppercase">PM Check List</h1>
                    <p className="text-xs text-blue-200 uppercase font-bold tracking-widest">CAGE Antigua-Barbuda Ltd</p>
                 </div>
             </div>
         </div>

         <div className="p-6 md:p-10 space-y-8 bg-white dark:bg-slate-900 min-h-screen">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50 dark:bg-slate-800 p-6 rounded-xl border-2 border-blue-100 dark:border-slate-700">
                <div><Label>Agent / Site Name</Label><Input value={formData.agentName} onChange={(e) => handleInputChange('agentName', e.target.value)} placeholder="Enter Agent Name" /></div>
                <div><Label>System</Label><Input value={formData.systemType} onChange={(e) => handleInputChange('systemType', e.target.value)} /></div>
                <div><Label>Date</Label><div className="relative"><Input type="date" value={formData.date} onChange={(e) => handleInputChange('date', e.target.value)} className="pl-10"/><CalendarIcon className="absolute left-3 top-2.5 w-5 h-5 text-blue-600 pointer-events-none" /></div></div>
                <div><Label>Arrival</Label><div className="relative" onClick={() => setActiveTimeField('arrival')}><Input value={formData.arrivalTime} readOnly className="pl-10 cursor-pointer"/><ClockIcon className="absolute left-3 top-2.5 w-5 h-5 text-blue-600" /></div></div>
                <div><Label>Departure</Label><div className="relative" onClick={() => setActiveTimeField('departure')}><Input value={formData.departureTime} readOnly className="pl-10 cursor-pointer"/><ClockIcon className="absolute left-3 top-2.5 w-5 h-5 text-blue-600" /></div></div>
            </div>

            <div className="space-y-3">
                <h3 className="font-black text-gray-400 uppercase tracking-widest text-sm border-b pb-2 mb-4">Maintenance Checks</h3>
                {PM_CHECKLIST_ITEMS.map((item, index) => (
                    <div key={index} onClick={() => toggleCheck(index)} className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.checks[index] ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-blue-300'}`}>
                        <div className={`w-6 h-6 rounded-md border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${formData.checks[index] ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500'}`}>
                            {formData.checks[index] && <CheckIcon className="w-4 h-4 text-white" />}
                        </div>
                        <span className={`font-medium ${formData.checks[index] ? 'text-blue-900 dark:text-blue-200' : 'text-gray-700 dark:text-gray-300'}`}>{item}</span>
                    </div>
                ))}
            </div>

            <div className="space-y-4">
                <div><Label>Parts Used</Label><TextArea value={formData.partsUsed} onChange={e => handleInputChange('partsUsed', e.target.value)} /></div>
                <div><Label>Comments</Label><TextArea value={formData.comments} onChange={e => handleInputChange('comments', e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                 <div className="space-y-2">
                     <Label onClick={handleSecretTap}>Agent Signature</Label>
                     <div onClick={() => setActiveSignatureField('agent')} className="h-24 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800">
                         {formData.agentSignature ? <img src={formData.agentSignature} className="h-full p-2 dark:invert"/> : <span className="text-xs font-bold text-gray-400">Sign Here</span>}
                     </div>
                 </div>
                 <div className="space-y-2">
                     <Label>Tech Signature</Label>
                     <div onClick={() => setActiveSignatureField('tech')} className="h-24 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800">
                         {formData.techSignature ? <img src={formData.techSignature} className="h-full p-2 dark:invert"/> : <span className="text-xs font-bold text-gray-400">Sign Here</span>}
                     </div>
                 </div>
                 <div className="space-y-2">
                     <Label>Supervisor Signature</Label>
                     <div onClick={() => setActiveSignatureField('supervisor')} className="h-24 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800">
                         {formData.supervisorSignature ? <img src={formData.supervisorSignature} className="h-full p-2 dark:invert"/> : <span className="text-xs font-bold text-gray-400">Sign Here</span>}
                     </div>
                 </div>
            </div>

            <div className="flex gap-4 justify-center pt-6">
                <button onClick={handleSave} disabled={saveStatus === 'saving'} className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg flex items-center gap-2">
                    {saveStatus === 'saving' ? 'Saving...' : <><SaveIcon className="w-5 h-5" /> Save</>}
                </button>
                <button onClick={handleSubmit} disabled={isSubmitting} className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full shadow-lg flex items-center gap-2">
                    {isSubmitting ? 'Processing...' : <><SendIcon className="w-5 h-5" /> Submit PDF</>}
                </button>
            </div>
         </div>

         <SignatureManager 
            isOpen={showSigManager}
            onClose={() => setShowSigManager(false)}
            currentSignature={formData.agentSignature}
            onSelect={(sig) => handleInputChange('agentSignature', sig)}
         />

         <SignaturePad isOpen={activeSignatureField !== null} onClose={() => setActiveSignatureField(null)} onSave={(data) => {
             if (activeSignatureField === 'agent') handleInputChange('agentSignature', data);
             if (activeSignatureField === 'tech') handleInputChange('techSignature', data);
             if (activeSignatureField === 'supervisor') handleInputChange('supervisorSignature', data);
             setActiveSignatureField(null);
         }} title="Signature" />

         <TimePicker isOpen={activeTimeField !== null} onClose={() => setActiveTimeField(null)} onSave={(t) => {
             if(activeTimeField === 'arrival') handleInputChange('arrivalTime', t);
             if(activeTimeField === 'departure') handleInputChange('departureTime', t);
         }} />
         
         <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} history={history} onLoad={loadHistoryItem} onDelete={deleteHistoryItem} title="PM History" />
    </div>
  );
}
