import { supabase, uploadFileToSupabase, getSupabasePublicUrl } from './supabase';
import { PrintOrder, DbPrintOrder, OrderStatus, QueueSummary, PrintSides, PrintType, PickupSlot } from '@/types';

/**
 * Maps Supabase database row to frontend PrintOrder interface
 */
export function mapDbToPrintOrder(row: DbPrintOrder): PrintOrder {
  let rollNumber = row.roll_number || 'N/A';
  let mobileNumber = row.mobile_number || '';
  let department = row.department;

  if (department?.includes('[') && department?.includes(']')) {
    const match = department.match(/^(.*?)\s*\[(.*?)\]$/);
    if (match) {
      department = match[1].trim();
      const details = match[2].trim();
      if (details.includes('| Mob:')) {
        const parts = details.split('| Mob:');
        if (!row.roll_number || row.roll_number === 'N/A') {
          rollNumber = parts[0].trim();
        }
        if (!row.mobile_number) {
          mobileNumber = parts[1].trim();
        }
      } else if (!row.roll_number || row.roll_number === 'N/A') {
        rollNumber = details;
      }
    }
  }

  return {
    id: row.id || '',
    token: row.token || 100,
    studentName: row.student_name,
    rollNumber,
    mobileNumber,
    department,
    pageCount: row.page_count,
    printType: (row.print_type as PrintType) || 'bw',
    sides: (row.sides as PrintSides) || 'single',
    copies: row.copies || 1,
    totalAmount: Number(row.total_fee) || 0,
    pickupSlot: (row.pickup_slot as PickupSlot) || 'morning',
    utr: row.utr,
    pdfFileName: row.pdf_file_name || 'Document.pdf',
    pdfFilePath: row.pdf_file_path,
    paymentProofPath: row.payment_proof_path,
    status: row.status as OrderStatus,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

/**
 * Fetches all print orders from Supabase `print_orders` table
 */
export async function fetchPrintOrders(): Promise<PrintOrder[]> {
  try {
    const { data, error } = await supabase
      .from('print_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching print orders from Supabase:', error.message);
      const customErr = new Error(error.message);
      (customErr as unknown as { code?: string; details?: unknown }).code = error.code;
      (customErr as unknown as { code?: string; details?: unknown }).details = error.details;
      throw customErr;
    }

    if (!data) return [];
    return data.map((row) => mapDbToPrintOrder(row as DbPrintOrder));
  } catch (err) {
    console.error('fetchPrintOrders failed:', err);
    throw err;
  }
}

/**
 * Creates a new print order in Supabase with uploaded file paths
 */
export async function createPrintOrder(order: {
  studentName: string;
  rollNumber: string;
  mobileNumber?: string;
  department: string;
  pageCount: number;
  printType: PrintType;
  sides: PrintSides;
  copies: number;
  totalAmount: number;
  pickupSlot: PickupSlot;
  utr: string;
  pdfFileName: string;
  pdfFilePath: string;
  paymentProofPath: string;
  status?: string;
}): Promise<PrintOrder> {
  const dbPayload: Omit<DbPrintOrder, 'id' | 'created_at'> = {
    student_name: order.studentName,
    roll_number: order.rollNumber.trim(),
    mobile_number: order.mobileNumber?.trim() || '',
    department: order.department,
    page_count: order.pageCount,
    print_type: order.printType,
    sides: order.sides,
    copies: order.copies,
    total_fee: order.totalAmount,
    pickup_slot: order.pickupSlot,
    utr: order.utr,
    pdf_file_name: order.pdfFileName,
    pdf_file_path: order.pdfFilePath,
    payment_proof_path: order.paymentProofPath,
    status: order.status || 'Pending',
  };

  let { data, error } = await supabase
    .from('print_orders')
    .insert([dbPayload])
    .select()
    .single();

  // Graceful fallback: If the remote Supabase table schema hasn't had the roll_number or mobile_number column added yet,
  // retry without missing columns to avoid blocking order creation.
  if (
    error &&
    (error.code === 'PGRST204' ||
      error.message?.includes('roll_number') ||
      error.message?.includes('mobile_number') ||
      error.message?.includes('column'))
  ) {
    console.warn('Supabase table missing custom columns; executing backwards-compatible insert...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { roll_number: _omittedRoll, mobile_number: _omittedMob, ...safePayload } = dbPayload as any;
    
    // Safely store roll number and mobile number inside department field: e.g. "ECE - S6 [SNG24EC012 | Mob: 9876543210]"
    const rollPart = order.rollNumber && order.rollNumber.trim() ? order.rollNumber.trim() : 'N/A';
    const mobPart = order.mobileNumber && order.mobileNumber.trim() ? ` | Mob: ${order.mobileNumber.trim()}` : '';
    safePayload.department = `${order.department} [${rollPart}${mobPart}]`;

    const retryResult = await supabase
      .from('print_orders')
      .insert([safePayload])
      .select()
      .single();
    data = retryResult.data;
    error = retryResult.error;
  }

  if (error) {
    console.error('Error inserting print order into Supabase:', error);
    throw new Error(`Failed to save print order: ${error.message}`);
  }

  return mapDbToPrintOrder(data as DbPrintOrder);
}

/**
 * Updates an order's status in Supabase (Mark Ready, Mark Collected, etc.)
 */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  const { error } = await supabase
    .from('print_orders')
    .update({ status: normalizedStatus })
    .eq('id', orderId);

  if (error) {
    console.error('Error updating order status in Supabase:', error);
    throw new Error(`Failed to update order status: ${error.message}`);
  }
}

// Shared subscribers set and singleton channel to prevent multiple .subscribe() conflicts
const subscribers = new Set<() => void>();
let globalRealtimeChannel: ReturnType<typeof supabase.channel> | null = null;

function getGlobalRealtimeChannel() {
  if (typeof window === 'undefined') return null;
  if (!globalRealtimeChannel) {
    globalRealtimeChannel = supabase
      .channel('print_orders_realtime_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'print_orders' },
        () => {
          subscribers.forEach((callback) => {
            try {
              callback();
            } catch (err) {
              console.error('Subscriber callback error:', err);
            }
          });
        }
      )
      .subscribe();
  }
  return globalRealtimeChannel;
}

/**
 * Subscribes to Realtime changes on `print_orders` table
 */
export function subscribeToOrders(onUpdate: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  subscribers.add(onUpdate);
  getGlobalRealtimeChannel();

  // Also listen to internal tab/window broadcast
  const handleLocalUpdate = () => onUpdate();
  window.addEventListener('sngce_supabase_orders_updated', handleLocalUpdate);

  return () => {
    subscribers.delete(onUpdate);
    window.removeEventListener('sngce_supabase_orders_updated', handleLocalUpdate);

    // Clean up channel when all subscribers unmount
    if (subscribers.size === 0 && globalRealtimeChannel) {
      supabase.removeChannel(globalRealtimeChannel);
      globalRealtimeChannel = null;
    }
  };
}

export function notifyLocalUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sngce_supabase_orders_updated'));
  }
}

/**
 * Computes queue summary metrics for pending, ready, and collected orders
 */
export function computeSummary(orders: PrintOrder[]): QueueSummary {
  let pendingCount = 0;
  let readyCount = 0;
  let collectedCount = 0;
  let totalPagesInQueue = 0;
  let totalRevenue = 0;

  for (const o of orders) {
    totalRevenue += o.totalAmount || 0;
    const s = (o.status || '').toLowerCase();
    const pages = (o.pageCount || 1) * (o.copies || 1);

    if (s === 'pending') {
      pendingCount++;
      totalPagesInQueue += pages;
    } else if (s === 'ready') {
      readyCount++;
      totalPagesInQueue += pages;
    } else if (s === 'collected') {
      collectedCount++;
    }
  }

  return {
    pendingCount,
    readyCount,
    collectedCount,
    totalPagesInQueue,
    totalRevenue,
  };
}

/**
 * Helper to upload both the PDF and the screenshot to Supabase Storage
 */
export async function uploadOrderFiles(
  pdfFile: File | Blob,
  pdfFileName: string,
  proofFile: File | Blob,
  proofFileName: string
): Promise<{ pdfUrl: string; proofUrl: string }> {
  // 1. Upload PDF
  const pdfResult = await uploadFileToSupabase(pdfFile, 'pdfs', pdfFileName);

  // 2. Upload Payment Proof Screenshot
  const proofResult = await uploadFileToSupabase(proofFile, 'proofs', proofFileName);

  return {
    pdfUrl: pdfResult.publicUrl,
    proofUrl: proofResult.publicUrl,
  };
}
