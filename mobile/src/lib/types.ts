export type Profile = {
  id: string;
  role: 'owner' | 'staff';
  display_name: string;
  phone: string | null;
  active: boolean;
  can_add_payment: boolean;
  can_add_job: boolean;
  can_add_material: boolean;
  can_add_attendance: boolean;
};

export type QuoteStatus = 'Draft' | 'Sent' | 'Approved' | 'Rejected' | 'Expired';
export type JobStatus = 'In Progress' | 'Completed';
export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Card';
export type AttendanceStatus = 'Unpaid' | 'Paid';

export const PAYMENT_MODES: PaymentMode[] = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];
export const JOB_STATUSES: JobStatus[] = ['In Progress', 'Completed'];
export const QUOTE_STATUSES: QuoteStatus[] = ['Draft', 'Sent', 'Approved', 'Rejected', 'Expired'];
export const MATERIALS = ['Cement', 'Tiles', 'Electrical plumbing', 'Windows and doors', 'Aggregate', 'Other'];
export const CUSTOMER_TYPES = ['Residential', 'Commercial'] as const;
