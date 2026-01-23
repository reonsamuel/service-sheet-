import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from "jspdf";
import { ServiceFormData, INITIAL_DATA, CallType, AssessmentType, Technician } from '../types';
import SignaturePad from './SignaturePad';
import TimePicker from './TimePicker';
import HistoryModal from './HistoryModal';
import SignatureManager from './SignatureManager';
import { PenIcon, ClockIcon, CalendarIcon, CameraIcon, SendIcon, XIcon, SaveIcon, FolderIcon, CheckIcon, UserIcon } from './ui/Icons';
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

// Reusable components for the form
const Label: React.FC<{ children?: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }> = ({ children, className = '', onClick }) => (
  <label onClick={onClick} className={`block text-sm font-bold text-gray-900 dark:text-gray-100 mb-1 tracking-wide uppercase ${className} ${onClick ? 'select-none' : ''}`}>{children}</label>
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
  data: any;
}

const LOCAL_REPORTS_KEY = 'cage_service_reports_local';

interface ServiceFormProps {
    currentUser: Technician;
    onBack: () => void;
}

export default function ServiceForm({ currentUser, onBack }: ServiceFormProps) {
  const [formData, setFormData] = useState<ServiceFormData>(INITIAL_DATA);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [activeSignatureField, setActiveSignatureField] = useState<'tech' | 'agent' | 'official' | null>(null);
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

  // Initialize form with user data
  useEffect(() => {
    setFormData(prev => ({
        ...prev,
        techName: currentUser.name,
        vehicleNumber: currentUser.vehicleNumber
    }));
    loadHistory();
  }, [currentUser]);

  const loadHistory = async () => {
    if (!currentUser) return;
    
    let combinedHistory: HistoryItem[] = [];

    // 1. Local Storage
    try {
        const localData = localStorage.getItem(LOCAL_REPORTS_KEY);
        if (localData) {
            const parsed = JSON.parse(localData);
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

    combinedHistory.sort((a, b) => b.timestamp - a.timestamp);
    const uniqueHistory = Array.from(new Map(combinedHistory.map(item => [item.id, item])).values());
    setHistory(uniqueHistory);
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
    
    let docId = currentDocId;
    if (!docId) docId = 'local_draft_' + Date.now();
    setCurrentDocId(docId);

    try {
        if (docId.startsWith('local_')) {
             const docRef = await addDoc(collection(db, 'service_reports'), {
                ...formData,
                techId: currentUser.id,
                timestamp: serverTimestamp()
            });
            setCurrentDocId(docRef.id);
            docId = docRef.id;
        } else {
            const docRef = doc(db, 'service_reports', docId);
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
    if(window.confirm("Delete this draft permanently?")) {
        try {
            await deleteDoc(doc(db, 'service_reports', id));
        } catch (e) {
            console.warn("Cloud delete failed", e);
        }

        const allReports = JSON.parse(localStorage.getItem(LOCAL_REPORTS_KEY) || '[]');
        const filtered = allReports.filter((r: any) => r.id !== id);
        localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(filtered));

        setHistory(prev => prev.filter(item => item.id !== id));
        if (id === currentDocId) setCurrentDocId(null);
    }
  };

  const loadHistoryItem = (data: ServiceFormData, id: string) => {
    if (window.confirm("Loading this document will replace your current unsaved changes. Continue?")) {
      setFormData(data);
      setCurrentDocId(id);
    }
  };

  const generatePDFBlob = async (data: ServiceFormData): Promise<{blob: Blob, doc: jsPDF}> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = 20;

    doc.setFillColor(180, 20, 20);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 200);
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
      pdfDoc.save(fileName);
      handleSave();
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
    setIsSubmitting(true);
    
    try {
        const fileName = `ServiceCall_${formData.shopName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        const { blob: pdfBlob, doc: pdfDoc } = await generatePDFBlob(formData);

        try {
            if (storage && navigator.onLine) {
                 const storageRef = ref(storage, `service_sheets/${currentUser.id}/${fileName}`);
                 await uploadBytes(storageRef, pdfBlob);
            }
        } catch (e) {
            console.log("Cloud upload skipped", e);
        }
        handleOfflineSubmit(pdfDoc, fileName);
    } catch (error: any) {
        console.error("Submission failed", error);
        alert("Error: " + error.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
      <div className="w-full">
        {/* Header */}
        <div className="bg-red-700 dark:bg-red-900 p-4 md:p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-black dark:border-slate-800 relative transition-colors shadow-lg">
          <div className="absolute top-4 left-4">
              <button onClick={onBack} className="flex items-center gap-1 text-white/80 hover:text-white font-bold uppercase text-xs">
                  &larr; Dashboard
              </button>
          </div>
          <div className="absolute top-4 right-4 flex gap-2 z-50">
            <button onClick={() => setShowHistory(true)} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg backdrop-blur-sm" title="Open History">
                <FolderIcon className="w-5 h-5 text-yellow-300" />
            </button>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto mt-8 md:mt-0">
            <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center border-4 border-black text-black shadow-lg flex-shrink-0">
              <div className="w-8 h-8 border-4 border-black rotate-45"></div>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase text-yellow-400 drop-shadow-sm">CAGE Antigua</h1>
              <p className="text-orange-200 text-xs md:text-sm font-bold tracking-wider">Technical Operations</p>
              <div className="mt-1 inline-flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded text-xs font-medium text-white/90">
                 <UserIcon className="w-3 h-3" />
                 <span>{currentUser.name} ({currentUser.vehicleNumber})</span>
              </div>
            </div>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-wide uppercase border-b-4 border-yellow-400 pb-1 text-white text-center md:text-right w-full md:w-auto mt-4 md:mt-0">Service Call Sheet</h2>
        </div>

        {/* Form Content */}
        <div className="p-6 md:p-10 space-y-8 bg-white dark:bg-slate-900 min-h-screen">
          
          <div className="flex flex-col-reverse md:flex-row gap-6 justify-between items-start">
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

              <div className="w-full md:w-64 flex-shrink-0">
                 <Label className="mb-2 text-right md:text-left">Receipt / Proof</Label>
                 <div className="relative w-full h-40 border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-lg hover:border-red-500 bg-gray-50 dark:bg-slate-800 overflow-hidden group">
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    {formData.receiptImage ? (
                        <div className="w-full h-full relative">
                            <img src={formData.receiptImage} alt="Receipt" className="w-full h-full object-cover" />
                            <button onClick={removeImage} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700 z-20"><XIcon className="w-4 h-4" /></button>
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-red-500"><CameraIcon className="w-10 h-10 mb-2" /><span className="text-xs font-bold uppercase">Tap to capture</span></div>
                    )}
                 </div>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><Label>Shop Name</Label><Input value={formData.shopName} onChange={(e) => handleInputChange('shopName', e.target.value)} placeholder="Enter shop name" /></div>
            <div><Label>System Type</Label><Input value={formData.systemType} onChange={(e) => handleInputChange('systemType', e.target.value)} placeholder="Enter system type" /></div>
            <div><Label>Terminal #</Label><Input value={formData.terminalNumber} onChange={(e) => handleInputChange('terminalNumber', e.target.value)} placeholder="Ex. 12345" /></div>
            <div><Label>Date</Label><div className="relative"><Input type="date" value={formData.date} onChange={(e) => handleInputChange('date', e.target.value)} className="pl-10" /><CalendarIcon className="absolute left-3 top-2.5 w-5 h-5 text-red-600 pointer-events-none" /></div></div>
            <div><Label>Arrival Time</Label><div className="relative cursor-pointer group" onClick={() => handleTimeClick('arrival')}><Input value={formData.arrivalTime} readOnly placeholder="Tap to set time" className="pl-10 cursor-pointer pointer-events-none" /><ClockIcon className="absolute left-3 top-2.5 w-5 h-5 text-red-600" /></div></div>
            <div><Label>Departure Time</Label><div className="relative cursor-pointer group" onClick={() => handleTimeClick('departure')}><Input value={formData.departureTime} readOnly placeholder="Tap to set time" className="pl-10 cursor-pointer pointer-events-none" /><ClockIcon className="absolute left-3 top-2.5 w-5 h-5 text-red-600" /></div></div>
          </div>

          <div className="space-y-6">
            <div><Label>Fault Reported</Label><TextArea value={formData.faultReported} onChange={(e) => handleInputChange('faultReported', e.target.value)} placeholder="Describe the reported fault..." className="bg-red-50/30 dark:bg-red-900/10" /></div>
            <div><Label>Fault Encountered</Label><TextArea value={formData.faultEncountered} onChange={(e) => handleInputChange('faultEncountered', e.target.value)} placeholder="Describe what was actually found..." /></div>
            <div><Label>Repairs Made</Label><TextArea value={formData.repairsMade} onChange={(e) => handleInputChange('repairsMade', e.target.value)} placeholder="List repairs completed..." className="bg-green-50/30 dark:bg-green-900/10" /></div>
            <div><Label>Parts Used</Label><TextArea value={formData.partsUsed} onChange={(e) => handleInputChange('partsUsed', e.target.value)} /></div>
            <div><Label>Other Comments</Label><TextArea value={formData.otherComments} onChange={(e) => handleInputChange('otherComments', e.target.value)} rows={2} /></div>
          </div>

          <div className="bg-orange-50 dark:bg-slate-800 p-6 rounded-lg border-2 border-orange-200 dark:border-slate-600">
            <Label className="mb-4 text-lg text-red-700 dark:text-red-400">Agent's Assessment</Label>
            <div className="flex flex-wrap gap-6">
              {['Excellent', 'Satisfactory', 'Unsatisfactory'].map((rating) => (
                <Checkbox key={rating} label={rating} checked={formData.agentAssessment === rating} onChange={() => handleInputChange('agentAssessment', rating as AssessmentType)} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            <div className="space-y-4">
              <Label>Tech's Signature</Label>
              <div onClick={() => setActiveSignatureField('tech')} className="border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 bg-white dark:bg-slate-800">
                {formData.techSignature ? <img src={formData.techSignature} alt="Tech Signature" className="h-full object-contain p-2 dark:invert" /> : <><PenIcon className="w-8 h-8 text-gray-300 mb-2" /><span className="text-gray-400 font-bold text-sm">TAP TO SIGN</span></>}
              </div>
              <div><Label>Date</Label><Input type="date" value={formData.techSignDate} onChange={(e) => handleInputChange('techSignDate', e.target.value)} /></div>
            </div>
            <div className="space-y-4">
              <Label onClick={handleSecretTap}>Agent's Signature</Label>
              <div onClick={() => setActiveSignatureField('agent')} className="border-2 border-dashed border-gray-400 dark:border-gray-500 rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 bg-white dark:bg-slate-800">
                 {formData.agentSignature ? <img src={formData.agentSignature} alt="Agent Signature" className="h-full object-contain p-2 dark:invert" /> : <><PenIcon className="w-8 h-8 text-gray-300 mb-2" /><span className="text-gray-400 font-bold text-sm">TAP TO SIGN</span></>}
              </div>
              <div><Label>Date</Label><Input type="date" value={formData.agentSignDate} onChange={(e) => handleInputChange('agentSignDate', e.target.value)} /></div>
            </div>
          </div>
          
          <div className="bg-gray-100 dark:bg-slate-800 p-6 rounded-lg border-2 border-gray-300 dark:border-slate-600">
            <h3 className="text-xs uppercase font-black text-gray-500 dark:text-gray-400 tracking-wider mb-4 border-b-2">Official Use Only</h3>
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="flex-1 w-full">
                 <Label>Dispatcher / Supervisor Signature</Label>
                 <div onClick={() => setActiveSignatureField('official')} className="mt-2 border-2 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 h-16 rounded-md flex items-center justify-center cursor-pointer hover:border-red-500">
                    {formData.officialDispatcherSignature ? <img src={formData.officialDispatcherSignature} alt="Official Signature" className="h-full object-contain p-1 dark:invert" /> : <span className="text-gray-400 text-sm font-bold">TAP TO SIGN</span>}
                 </div>
              </div>
               <div className="w-full md:w-48"><Label>Date</Label><Input type="date" value={formData.officialDispatcherDate} onChange={(e) => handleInputChange('officialDispatcherDate', e.target.value)} /></div>
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row justify-center gap-6">
            <button onClick={handleSave} disabled={saveStatus === 'saving'} className={`flex items-center justify-center gap-3 px-8 py-4 rounded-full text-lg font-bold uppercase tracking-wider shadow-lg transform transition-all active:scale-95 border-4 border-black dark:border-slate-600 w-full md:w-auto ${saveStatus === 'success' || saveStatus === 'local' ? 'bg-green-500 text-white border-green-700' : 'bg-blue-500 text-white'}`}>
                {saveStatus === 'idle' ? <><SaveIcon className="w-6 h-6" /> Save Draft</> : (saveStatus === 'saving' ? 'Saving...' : <><CheckIcon className="w-6 h-6" /> Saved</>)}
            </button>
            <button onClick={handleSubmit} disabled={isSubmitting} className={`flex items-center justify-center gap-3 px-8 py-4 rounded-full text-lg font-bold uppercase tracking-wider shadow-lg transform transition-all active:scale-95 border-4 border-black dark:border-slate-600 w-full md:w-auto ${isSubmitting ? 'bg-gray-400' : 'bg-green-500 text-white'}`}>
                {isSubmitting ? 'Processing...' : <><SendIcon className="w-6 h-6" /> Download & Email</>}
            </button>
          </div>

        </div>
        
        <SignatureManager 
          isOpen={showSigManager}
          onClose={() => setShowSigManager(false)}
          currentSignature={formData.agentSignature}
          onSelect={(sig) => handleInputChange('agentSignature', sig)}
        />

        <SignaturePad isOpen={activeSignatureField !== null} onClose={() => setActiveSignatureField(null)} onSave={(dataUrl) => {
          if (activeSignatureField === 'tech') handleInputChange('techSignature', dataUrl);
          if (activeSignatureField === 'agent') handleInputChange('agentSignature', dataUrl);
          if (activeSignatureField === 'official') handleInputChange('officialDispatcherSignature', dataUrl);
          setActiveSignatureField(null);
        }} title={activeSignatureField === 'tech' ? "Technician Signature" : activeSignatureField === 'agent' ? "Agent Signature" : "Supervisor Signature"} />

        <TimePicker isOpen={activeTimeField !== null} onClose={() => setActiveTimeField(null)} onSave={(time) => {
          if (activeTimeField === 'arrival') handleInputChange('arrivalTime', time);
          if (activeTimeField === 'departure') handleInputChange('departureTime', time);
        }} initialValue={activeTimeField === 'arrival' ? formData.arrivalTime : formData.departureTime} />

        <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} history={history} onLoad={loadHistoryItem} onDelete={deleteHistoryItem} title="Service History" />
      </div>
  );
}
