'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  Clock,
  CheckCircle2,
  FileCheck,
  Search,
  Filter,
  Eye,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
  IndianRupee,
  FileText,
  AlertCircle,
  Database,
  Phone,
} from 'lucide-react';
import {
  PrintOrder,
  PickupSlot,
  OrderStatus,
  PICKUP_SLOTS,
  QueueSummary,
} from '@/types';
import {
  fetchPrintOrders,
  updateOrderStatus,
  subscribeToOrders,
  computeSummary,
  notifyLocalUpdate,
} from '@/lib/orders-service';

export default function LibrarianDashboard() {
  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [slotFilter, setSlotFilter] = useState<'all' | PickupSlot>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProofOrder, setSelectedProofOrder] = useState<PrintOrder | null>(null);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  // Sync with Supabase database
  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const data = await fetchPrintOrders();
      setOrders(data);
      setDbError(null);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Could not find the table') || errMsg.includes('PGRST205')) {
        setDbError('Table `print_orders` not found in Supabase. Please run `supabase_setup.sql` in your Supabase SQL Editor.');
      } else {
        setDbError(`Supabase query error: ${errMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const unsubscribe = subscribeToOrders(() => {
      loadOrders();
    });
    return () => unsubscribe();
  }, []);

  // Compute live summary
  const summary: QueueSummary = useMemo(() => computeSummary(orders), [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Slot filter
      if (slotFilter !== 'all' && order.pickupSlot !== slotFilter) {
        return false;
      }
      // Status filter (case-insensitive)
      if (statusFilter !== 'all') {
        const orderStatusLower = (order.status || '').toLowerCase();
        const filterLower = statusFilter.toLowerCase();
        if (orderStatusLower !== filterLower) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesToken = String(order.token).includes(query);
        const matchesName = order.studentName.toLowerCase().includes(query);
        const matchesRoll = (order.rollNumber || '').toLowerCase().includes(query);
        const matchesMobile = (order.mobileNumber || '').toLowerCase().includes(query);
        const matchesDept = order.department.toLowerCase().includes(query);
        const matchesUtr = order.utr.toLowerCase().includes(query);
        const matchesFile = order.pdfFileName.toLowerCase().includes(query);
        return matchesToken || matchesName || matchesRoll || matchesMobile || matchesDept || matchesUtr || matchesFile;
      }
      return true;
    });
  }, [orders, slotFilter, statusFilter, searchQuery]);

  // Status changers via Supabase SQL UPDATE
  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      notifyLocalUpdate();
      await loadOrders();
    } catch (err) {
      console.error('Failed to update order status:', err);
      alert('Could not update order status in Supabase. Please check your connection.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Open PDF in new tab for printing
  const handleOpenPdf = (order: PrintOrder) => {
    if (!order.pdfFilePath) {
      alert('No PDF path recorded for this order.');
      return;
    }
    window.open(order.pdfFilePath, '_blank', 'noopener,noreferrer');
  };

  // Copy UTR
  const handleCopyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Supabase Notice Banner if table is not yet created */}
      {dbError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <h4 className="font-bold text-amber-950">Supabase Database Setup Required</h4>
              <p className="mt-1 text-amber-800 leading-relaxed">
                {dbError}
              </p>
              <p className="mt-1 text-[11px] text-amber-700">
                Run the script <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300 font-semibold">supabase_setup.sql</code> in your Supabase SQL Editor.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadOrders}
            className="px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-xs font-bold text-amber-900 shrink-0 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Library Print Desk
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadOrders}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Orders */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Pending Orders
            </span>
            <span className="text-2xl font-extrabold text-amber-600 font-mono">
              {summary.pendingCount}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">In Queue</span>
          </div>
        </div>

        {/* Ready for Pickup */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Ready for Pickup
            </span>
            <span className="text-2xl font-extrabold text-emerald-600 font-mono">
              {summary.readyCount}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Awaiting Student</span>
          </div>
        </div>

        {/* Total Pages in Queue */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Pages in Queue
            </span>
            <span className="text-2xl font-extrabold text-teal-700 font-mono">
              {summary.totalPagesInQueue}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Pages to print</span>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Today&apos;s Revenue
            </span>
            <span className="text-2xl font-extrabold text-slate-900 font-mono">
              ₹{summary.totalRevenue.toFixed(0)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">UPI Verified</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Slot Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Slot:</span>
            </span>

            <button
              type="button"
              onClick={() => setSlotFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                slotFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Slots ({orders.length})
            </button>

            {PICKUP_SLOTS.map((slot) => {
              const count = orders.filter((o) => o.pickupSlot === slot.id).length;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSlotFilter(slot.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    slotFilter === slot.id
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {slot.badge} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search token, name, dept, UTR..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Status Tabs Substrip */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </span>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Statuses
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all ${
              statusFilter.toLowerCase() === 'pending'
                ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            Pending ({summary.pendingCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ready')}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all ${
              statusFilter.toLowerCase() === 'ready'
                ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-300'
                : 'text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            Ready ({summary.readyCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('collected')}
            className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all ${
              statusFilter.toLowerCase() === 'collected'
                ? 'bg-slate-200 text-slate-900 font-bold border border-slate-300'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Collected ({summary.collectedCount})
          </button>
        </div>
      </div>

      {/* Order Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-semibold text-slate-700">No print jobs found</h3>
            <p className="text-xs text-slate-400">
              No orders matched your current slot, status, or search filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Token #</th>
                  <th className="py-3.5 px-4">Student &amp; Dept</th>
                  <th className="py-3.5 px-4">Pickup Slot</th>
                  <th className="py-3.5 px-4">Document &amp; Pages</th>
                  <th className="py-3.5 px-4">Mode</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">UPI UTR</th>
                  <th className="py-3.5 px-4">Payment Proof</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const slotInfo = PICKUP_SLOTS.find((s) => s.id === order.pickupSlot);
                  const normalizedStatus = (order.status || '').toLowerCase();
                  const isUpdating = updatingId === order.id;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Token # */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-sm px-2.5 py-1 rounded-lg bg-slate-900 text-white shadow-xs">
                            #{order.token}
                          </span>
                          {normalizedStatus === 'pending' && (
                            <span
                              className="w-2 h-2 rounded-full bg-amber-500 animate-ping"
                              title="Pending in queue"
                            />
                          )}
                        </div>
                      </td>

                      {/* Student Name & Dept & Roll No */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{order.studentName}</span>
                          {order.rollNumber && order.rollNumber !== 'N/A' && (
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {order.rollNumber}
                            </span>
                          )}
                          {order.mobileNumber && (
                            <a
                              href={`tel:${order.mobileNumber}`}
                              className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 flex items-center gap-1"
                              title="Call Student"
                            >
                              <Phone className="w-2.5 h-2.5 text-sky-600" />
                              <span>{order.mobileNumber}</span>
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{order.department}</div>
                      </td>

                      {/* Pickup Slot */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{slotInfo?.badge}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {slotInfo?.timeRange}
                        </div>
                      </td>

                      {/* PDF File & Pages */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-medium text-slate-900 text-xs truncate" title={order.pdfFileName}>
                          {order.pdfFileName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {order.pageCount} {order.pageCount === 1 ? 'pg' : 'pgs'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {order.sides === 'single' ? 'Single-sided' : 'Duplex'}
                          </span>
                          {order.copies > 1 && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-bold text-[10px]">
                              ×{order.copies}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Print Type (B&W / Colour) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {order.printType === 'bw' ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            B&amp;W (₹2)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-300">
                            Colour (₹10)
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono font-extrabold text-slate-900 text-sm">
                        ₹{order.totalAmount.toFixed(2)}
                      </td>

                      {/* UPI UTR */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-mono text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-200 w-fit">
                          <span>{order.utr}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyUtr(order.utr)}
                            className="text-slate-400 hover:text-emerald-700 p-0.5"
                            title="Copy UTR to clipboard"
                          >
                            {copiedUtr === order.utr ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Payment Proof Thumbnail */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedProofOrder(order)}
                          className="flex items-center gap-2 p-1 rounded-lg border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 transition-all cursor-pointer group/thumb"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={order.paymentProofPath}
                            alt="Payment Proof"
                            className="w-8 h-8 rounded object-cover border border-slate-200 bg-slate-100"
                            onError={(e) => {
                              // Fallback placeholder if image load fails
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=100&auto=format&fit=crop&q=80';
                            }}
                          />
                          <span className="text-xs text-emerald-700 font-medium group-hover/thumb:underline flex items-center gap-0.5">
                            <Eye className="w-3 h-3" />
                            <span>Verify</span>
                          </span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-2">
                        {/* Print / Open PDF button */}
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          title="Open and print document"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Print PDF</span>
                        </button>

                        {/* Status Controls via Supabase SQL UPDATE */}
                        {normalizedStatus === 'pending' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(order.id, 'Ready')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isUpdating ? 'Saving...' : 'Mark Ready'}</span>
                          </button>
                        )}

                        {normalizedStatus === 'ready' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(order.id, 'Collected')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>{isUpdating ? 'Saving...' : 'Mark Collected'}</span>
                          </button>
                        )}

                        {normalizedStatus === 'collected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600">
                            <span>Done</span>
                          </span>
                        )}

                        {/* Quick revert for testing */}
                        {normalizedStatus !== 'pending' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(order.id, 'Pending')}
                            className="text-[11px] text-slate-400 hover:text-slate-700 underline pl-1 disabled:opacity-50 cursor-pointer"
                            title="Revert status to Pending"
                          >
                            Undo
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Proof Modal */}
      {selectedProofOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-xs font-mono font-bold">
                  #{selectedProofOrder.token}
                </span>
                <h3 className="font-bold text-base">UPI Payment Verification</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProofOrder(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Payment Details Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Student:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">
                      {selectedProofOrder.studentName}
                    </span>
                    {selectedProofOrder.rollNumber && selectedProofOrder.rollNumber !== 'N/A' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-800">
                        {selectedProofOrder.rollNumber}
                      </span>
                    )}
                    {selectedProofOrder.mobileNumber && (
                      <a
                        href={`tel:${selectedProofOrder.mobileNumber}`}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-100 text-sky-800 hover:bg-sky-200 flex items-center gap-1"
                        title="Call Student"
                      >
                        <Phone className="w-2.5 h-2.5 text-sky-600" />
                        {selectedProofOrder.mobileNumber}
                      </a>
                    )}
                  </div>
                  <span className="text-slate-500 block text-[11px]">
                    {selectedProofOrder.department}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Amount:</span>
                  <span className="font-mono font-extrabold text-emerald-700 text-lg">
                    ₹{selectedProofOrder.totalAmount.toFixed(2)}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      12-DIGIT TRANSACTION ID (UTR):
                    </span>
                    <span className="font-mono font-extrabold text-slate-900 text-base tracking-wider">
                      {selectedProofOrder.utr}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyUtr(selectedProofOrder.utr)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-white text-xs font-semibold text-slate-700"
                  >
                    {copiedUtr === selectedProofOrder.utr ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy UTR</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Full Screenshot View from Supabase Storage */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedProofOrder.paymentProofPath}
                  alt="UPI Payment Screenshot"
                  className="max-h-[380px] w-auto object-contain rounded-lg shadow-xs"
                />
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedProofOrder(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {(selectedProofOrder.status || '').toLowerCase() === 'pending' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleStatusChange(selectedProofOrder.id, 'Ready');
                      setSelectedProofOrder(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve &amp; Mark Ready</span>
                  </button>
                )}

                {(selectedProofOrder.status || '').toLowerCase() === 'ready' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleStatusChange(selectedProofOrder.id, 'Collected');
                      setSelectedProofOrder(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Mark Collected</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
