export type CallType = 'New Service Call' | 'Repeat Call' | 'Schedule Maintenance';
export type AssessmentType = 'Excellent' | 'Satisfactory' | 'Unsatisfactory';

export interface Technician {
  id: string;
  name: string;
  vehicleNumber: string;
  pin: string; // Simple authentication simulation
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
  techSignature: string | null; // Data URL
  agentSignature: string | null; // Data URL
  techSignDate: string;
  agentSignDate: string;
  officialDispatcherSignature: string | null; // Data URL
  officialDispatcherDate: string;
  receiptImage: string | null; // Data URL
}

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