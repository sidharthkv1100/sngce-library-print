import { PrintOrder, OrderStatus, QueueSummary } from '@/types';
import { createSamplePdf } from './pdf-utils';

export const STORAGE_KEY = 'sngce_library_print_orders_v1';
export const MY_ORDERS_KEY = 'sngce_my_print_order_ids_v1';
const DB_NAME = 'SNGCE_PRINT_FILE_STORE';
const STORE_NAME = 'pdf_blobs';

// Initialize or open IndexedDB for storing full PDF blobs across tabs
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storePdfBlob(orderId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, orderId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to store PDF in IndexedDB:', err);
  }
}

export async function getPdfBlob(orderId: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(orderId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get PDF from IndexedDB:', err);
    return null;
  }
}

// In-memory object URL cache so we don't leak URLs
const objectUrlCache = new Map<string, string>();

export async function resolvePdfUrl(order: PrintOrder): Promise<string> {
  if (objectUrlCache.has(order.id)) {
    return objectUrlCache.get(order.id)!;
  }

  // Check if saved as data URL directly
  if (order.pdfFileDataUrl) {
    return order.pdfFileDataUrl;
  }

  // Look up in IndexedDB
  const blob = await getPdfBlob(order.id);
  if (blob) {
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(order.id, url);
    return url;
  }

  // Fallback: generate a dynamic preview PDF if missing
  const sampleBytes = await createSamplePdf(
    order.pdfFileName || 'Document.pdf',
    order.studentName,
    order.department,
    order.pageCount || 1
  );
  const fallbackBlob = new Blob([sampleBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(fallbackBlob);
  objectUrlCache.set(order.id, url);
  return url;
}

// LocalStorage helpers
export function getStoredOrders(): PrintOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PrintOrder[];
  } catch (err) {
    console.error('Failed to parse orders from localStorage', err);
    return [];
  }
}

export function saveOrders(orders: PrintOrder[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    notifyChanges();
  } catch (err) {
    console.error('Failed to save orders to localStorage', err);
  }
}

export function getMyOrderIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MY_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addMyOrderId(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const ids = getMyOrderIds();
    if (!ids.includes(orderId)) {
      ids.unshift(orderId);
      localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(ids));
    }
  } catch (err) {
    console.error('Failed to save my order ID', err);
  }
}

// Dispatch sync event to current window and cross-tab BroadcastChannel
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('sngce_print_channel');
  } catch {
    // ignore
  }
}

export function notifyChanges(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('sngce_orders_updated'));
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'ORDERS_CHANGED', timestamp: Date.now() });
  }
}

export function subscribeToOrders(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustom = () => callback();
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      callback();
    }
  };
  const handleBroadcast = (e: MessageEvent) => {
    if (e.data?.type === 'ORDERS_CHANGED') {
      callback();
    }
  };

  window.addEventListener('sngce_orders_updated', handleCustom);
  window.addEventListener('storage', handleStorage);
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  return () => {
    window.removeEventListener('sngce_orders_updated', handleCustom);
    window.removeEventListener('storage', handleStorage);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
  };
}

export function computeSummary(orders: PrintOrder[]): QueueSummary {
  let pendingCount = 0;
  let readyCount = 0;
  let collectedCount = 0;
  let totalPagesInQueue = 0;
  let totalRevenue = 0;

  for (const o of orders) {
    totalRevenue += o.totalAmount;
    if (o.status === 'pending') {
      pendingCount++;
      totalPagesInQueue += (o.pageCount || 1) * (o.copies || 1);
    } else if (o.status === 'ready') {
      readyCount++;
      totalPagesInQueue += (o.pageCount || 1) * (o.copies || 1);
    } else if (o.status === 'collected') {
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

export function getNextToken(orders: PrintOrder[]): number {
  if (orders.length === 0) return 101;
  const maxToken = Math.max(...orders.map((o) => o.token || 100));
  return maxToken + 1;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const orders = getStoredOrders();
  const updated = orders.map((o) => (o.id === orderId ? { ...o, status } : o));
  saveOrders(updated);
}

export async function deleteOrder(orderId: string): Promise<void> {
  const orders = getStoredOrders();
  const filtered = orders.filter((o) => o.id !== orderId);
  saveOrders(filtered);
}

/**
 * Returns empty array for production mode.
 */
export async function generateSampleOrders(): Promise<PrintOrder[]> {
  return [];
}

export async function ensureSeedOrders(): Promise<PrintOrder[]> {
  if (typeof window === 'undefined') return [];
  return getStoredOrders();
}

export async function resetToDefaultSeed(): Promise<PrintOrder[]> {
  saveOrders([]);
  return [];
}
