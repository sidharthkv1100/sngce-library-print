export type PrintType = 'bw' | 'colour';
/** single = 1 PDF page per sheet | double = 2 PDF pages per sheet (back-to-back duplex) | 4in1 = 4 PDF pages per sheet (2 landscape per side) */
export type PrintSides = 'single' | 'double' | '4in1';
export type PickupSlot = 'morning' | 'noon' | 'evening';
export type OrderStatus = 'Pending' | 'Ready' | 'Collected' | 'pending' | 'ready' | 'collected';

export interface PrintOrder {
  id: string;
  token: number;
  studentName: string;
  rollNumber: string;
  mobileNumber?: string;
  department: string;
  pdfFileName: string;
  pdfFileSize?: number;
  pageCount: number;
  printType: PrintType;
  sides: PrintSides;
  copies: number;
  totalAmount: number;
  pickupSlot: PickupSlot;
  utr: string;
  pdfFilePath?: string; // Supabase storage path or public URL
  paymentProofPath?: string; // Supabase storage path or public URL
  paymentProofDataUrl?: string; // Data URL for local previews
  pdfFileDataUrl?: string;
  status: OrderStatus;
  createdAt: string;
}

export interface DbPrintOrder {
  id?: string;
  token?: number;
  student_name: string;
  roll_number?: string;
  mobile_number?: string;
  department: string;
  page_count: number;
  print_type: string;
  sides: string;
  copies: number;
  total_fee: number;
  pickup_slot: string;
  utr: string;
  pdf_file_name: string;
  pdf_file_path: string;
  payment_proof_path: string;
  status: string;
  created_at?: string;
}

export interface SlotInfo {
  id: PickupSlot;
  title: string;
  timeRange: string;
  badge: string;
}

export const PICKUP_SLOTS: SlotInfo[] = [
  {
    id: 'morning',
    title: 'Morning Slot',
    timeRange: '8:30 AM – 9:30 AM',
    badge: 'Morning',
  },
  {
    id: 'noon',
    title: 'Noon Slot',
    timeRange: '12:30 PM – 1:30 PM',
    badge: 'Noon',
  },
  {
    id: 'evening',
    title: 'Evening Slot',
    timeRange: '3:30 PM – 4:30 PM',
    badge: 'Evening',
  },
];

export const PRINT_RATES = {
  bw: 2,     // ₹2 per physical sheet (single-sided: 1 PDF page/sheet, double-sided: 2 PDF pages/sheet, 4-in-1: 4 PDF pages/sheet)
  colour: 10, // ₹10 per PDF page single-sided; double-sided: ₹20/sheet (2 PDF pages/sheet)
} as const;

export interface QueueSummary {
  pendingCount: number;
  readyCount: number;
  collectedCount: number;
  totalPagesInQueue: number;
  totalRevenue: number;
}
