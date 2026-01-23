
export type CallType = 'New Service Call' | 'Repeat Call' | 'Schedule Maintenance';
export type AssessmentType = 'Excellent' | 'Satisfactory' | 'Unsatisfactory';

export interface Technician {
  id: string;
  name: string;
  vehicleNumber: string;
  pin: string;
}

export interface SavedSignature {
  id: string;
  name: string;
  signatureData: string; // Base64 image
  createdAt: number;
}

export interface ServiceFormData {
  callType: CallType | null;
  shopName: string;
  systemType: string;
  terminalNumber: string;
  date: string;
  arrivalTime: string;
  departureTime: string;
  vehicleNumber: string;
  techName: string;
  faultReported: string;
  faultEncountered: string;
  repairsMade: string;
  partsUsed: string;
  otherComments: string;
  agentAssessment: AssessmentType | null;
  techSignature: string | null;
  agentSignature: string | null;
  techSignDate: string;
  agentSignDate: string;
  officialDispatcherSignature: string | null;
  officialDispatcherDate: string;
  receiptImage: string | null;
}

export interface PMFormData {
  agentName: string; // The "Agent" field from PDF
  date: string;
  arrivalTime: string;
  departureTime: string;
  systemType: string; // Default "Novomatic"
  checks: boolean[]; // Indices correspond to PM_CHECKLIST_ITEMS
  partsUsed: string;
  comments: string;
  techSignature: string | null;
  agentSignature: string | null;
  supervisorSignature: string | null;
  techSignDate: string;
  agentSignDate: string;
  supervisorSignDate: string;
  techName: string; // Auto-filled
}

export const PM_CHECKLIST_ITEMS = [
  "Check to ensure screens are functioning correctly.",
  "Check if the V-Deck / keyboard are working.",
  "Check to ensure the internet is connected and functioning.",
  "Check to ensure cables aren't damaged. (LAN, Power etc.)",
  "Check Mikrotik and Switch for functionality.",
  "Ensure (PT) / (POS & Kiosk) are functional.",
  "Clean all Cages / MEU including cooling fan vent.",
  "Check Printers for functionality.",
  "Check door switch for functionality.",
  "Clean external part of cabinet & screen using (lint free Fabric)",
  "Confirm physical condition is ok."
];

export const INITIAL_DATA: ServiceFormData = {
  callType: null,
  shopName: '',
  systemType: '',
  terminalNumber: '',
  date: new Date().toISOString().split('T')[0],
  arrivalTime: '',
  departureTime: '',
  vehicleNumber: '',
  techName: '',
  faultReported: '',
  faultEncountered: '',
  repairsMade: '',
  partsUsed: '',
  otherComments: '',
  agentAssessment: null,
  techSignature: null,
  agentSignature: null,
  techSignDate: new Date().toISOString().split('T')[0],
  agentSignDate: new Date().toISOString().split('T')[0],
  officialDispatcherSignature: null,
  officialDispatcherDate: '',
  receiptImage: null,
};

export const INITIAL_PM_DATA: PMFormData = {
  agentName: '',
  date: new Date().toISOString().split('T')[0],
  arrivalTime: '',
  departureTime: '',
  systemType: 'Novomatic',
  checks: Array(PM_CHECKLIST_ITEMS.length).fill(false),
  partsUsed: '',
  comments: '',
  techSignature: null,
  agentSignature: null,
  supervisorSignature: null,
  techSignDate: new Date().toISOString().split('T')[0],
  agentSignDate: new Date().toISOString().split('T')[0],
  supervisorSignDate: '',
  techName: ''
};
