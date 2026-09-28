export interface ApiEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PatientAccountDto {
  id: string;
  phone: string;
  name: string;
  status: 'active' | 'disabled';
  lastLoginAt: string | null;
  createdAt?: string;
}

export type Relationship = 'self' | 'child' | 'parent' | 'spouse' | 'other';

export interface PatientBillLineDto {
  id: string;
  description: string;
  quantity: number;
  amountPaise: number;
}

export interface PatientBillDto {
  id: string;
  billNumber: string | null;
  type: string;
  status: string;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  issuedAt: string | null;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  grandTotalPaise: number;
  amountPaidPaise: number;
  clinicName: string;
  lineItems: PatientBillLineDto[];
}

export interface PatientProfileDto {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  lastVisit: string;
  status: string;
  address: string;
  allergies: string[];
  chronicConditions: string[];
  bloodGroup: string;
  relationship: Relationship;
  clinicSlug: string;
  clinicName: string;
}

export interface SelfServicePolicy {
  allowCancel: boolean;
  allowReschedule: boolean;
  cancelCutoffHours: number;
  maxReschedules: number;
}

export interface DirectoryClinic {
  slug: string;
  name: string;
  address: string;
  phone: string;
}

export interface ClinicDto {
  slug: string;
  name: string;
  address: string;
  phone: string;
  timezone: string;
  bookingEnabled: boolean;
  selfService: SelfServicePolicy;
  maxAdvanceDays?: number;
}

export interface ProviderDto {
  id: string;
  displayName: string;
  title: string | null;
}

export interface SlotDto {
  startTime: string;
  endTime?: string;
  remaining?: number;
}

export interface DayAvailabilityDto {
  date: string;
  remaining: number;
  total: number;
}

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked-in'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
  | 'no-show';

export interface AppointmentDto {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  providerMembershipId: string | null;
  appointmentType: string;
  date: string;
  startTime: string;
  endTime: string;
  tokenNumber: number;
  status: AppointmentStatus;
  paymentStatus: 'pending' | 'paid';
  reason: string;
  notes: string;
  source: string;
  clinicSlug?: string;
  clinicName?: string;
  /** Signed desk check-in token; returned on create and on detail. */
  qrToken?: string | null;
}

export interface AppointmentDetailDto extends AppointmentDto {
  clinicAddress: string;
  clinicPhone: string;
  qrToken: string | null;
  selfService: SelfServicePolicy | null;
  rescheduleCount: number;
}

export interface QueueStatusDto {
  appointmentId: string;
  workDate: string;
  status: AppointmentStatus;
  myToken: number | null;
  nowServing: number | null;
  peopleAhead: number;
  etaMinutes: number | null;
  waitingCount: number;
  isBeingServed: boolean;
  isActive: boolean;
}

export type DocumentType =
  | 'xray'
  | 'lab_report'
  | 'prescription'
  | 'scan'
  | 'other';

export interface DocumentDto {
  id: string;
  patientId: string;
  type: DocumentType;
  category: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  createdAt?: string;
}

export interface OtpRequestResult {
  sent: boolean;
  ttlMinutes: number;
  resendAfterSeconds: number;
  /** Present only when the server runs with OTP_DEV_RETURN_CODE enabled. */
  devCode?: string;
}

export interface PatientSession {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  account: PatientAccountDto;
  isNewAccount: boolean;
  linkedProfiles: number;
}

/** Patient-facing wording for the clinical status enum. */
export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  'checked-in': 'Checked in',
  'in-progress': 'In consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'no-show': 'Missed',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as AppointmentStatus] ?? status;
}

/** Patient-selectable upload types, with the labels shown in the app. */
export const UPLOAD_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'lab_report', label: 'Lab report' },
  { value: 'xray', label: 'X-ray' },
  { value: 'scan', label: 'Scan' },
  { value: 'other', label: 'Other document' },
];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  lab_report: 'Lab report',
  xray: 'X-ray',
  scan: 'Scan',
  prescription: 'Prescription',
  other: 'Document',
};
