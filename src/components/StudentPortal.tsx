'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Copy,
  Clock,
  QrCode,
  IndianRupee,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronRight,
  Database,
  CloudUpload,
  UserCheck,
} from 'lucide-react';
import {
  PrintOrder,
  PrintType,
  PrintSides,
  PickupSlot,
  PICKUP_SLOTS,
  PRINT_RATES,
} from '@/types';
import { countPdfPages } from '@/lib/pdf-utils';
import {
  fetchPrintOrders,
  createPrintOrder,
  uploadOrderFiles,
  subscribeToOrders,
  notifyLocalUpdate,
} from '@/lib/orders-service';

const MY_ORDERS_KEY = 'sngce_my_print_order_ids_v2';

function StudentPortalContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const authError = searchParams.get('error');

  // Form State
  const [studentName, setStudentName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfFileSize, setPdfFileSize] = useState(0);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Auto-fill student name from Google/NextAuth session if signed in
  useEffect(() => {
    if (session?.user?.name && !studentName) {
      setStudentName(session.user.name);
    }
  }, [session, studentName]);

  // Print Options
  const [printType, setPrintType] = useState<PrintType>('bw');
  const [sides, setSides] = useState<PrintSides>('single');
  const [copies, setCopies] = useState<number>(1);
  const [isCustomCopies, setIsCustomCopies] = useState<boolean>(false);
  const [pickupSlot, setPickupSlot] = useState<PickupSlot>('morning');

  // Payment State
  const [utr, setUtr] = useState('');
  const [utrError, setUtrError] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState<PrintOrder | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Orders State (for My Orders section)
  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [myOrderIds, setMyOrderIds] = useState<string[]>([]);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const myOrdersRef = useRef<HTMLDivElement>(null);

  // Load orders & sync
  const refreshOrders = async () => {
    try {
      const data = await fetchPrintOrders();
      setOrders(data);
      setSupabaseError(null);
    } catch (err: unknown) {
      const errorObj = err as { message?: string; code?: string };
      const errorMsg = errorObj?.message || (err instanceof Error ? err.message : String(err));
      const errorCode = errorObj?.code || '';

      if (
        errorMsg.includes('Could not find the table') ||
        errorMsg.includes('PGRST205') ||
        errorCode === 'PGRST205'
      ) {
        setSupabaseError('The `print_orders` table has not been created yet in your Supabase project. Please execute `supabase_setup.sql` in your Supabase SQL Editor.');
      } else {
        setSupabaseError(`Supabase connection issue: ${errorMsg}`);
      }
    }
  };

  useEffect(() => {
    // Load local list of user's own submitted order IDs
    try {
      const savedIds = localStorage.getItem(MY_ORDERS_KEY);
      if (savedIds) setMyOrderIds(JSON.parse(savedIds));
    } catch {
      // ignore
    }

    refreshOrders();
    const unsubscribe = subscribeToOrders(() => {
      refreshOrders();
    });
    return () => unsubscribe();
  }, []);

  const saveMyOrderId = (id: string) => {
    try {
      const updated = [id, ...myOrderIds];
      setMyOrderIds(updated);
      localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Quick department options
  const deptSuggestions = [
    'CSE - S6',
    'ECE - S6',
    'ECE - S4',
    'ME - S8',
    'CE - S6',
    'EEE - S4',
    'MCA - S2',
    'AH - S4',
    'CY - S4',
  ];

  // Pages per sheet based on layout format
  const pagesPerSheet = sides === '4in1' ? 4 : sides === 'double' ? 2 : 1;
  const totalPages = pageCount || 0;

  // Print Price Calculation Algorithm:
  // - Black & White (₹2 per physical sheet):
  //   Calculate required sheets using Math.ceil(totalPages / pagesPerSheet) and multiply by 2 (and copies).
  // - Color (₹10 per PDF page):
  //   Ignore layout format entirely. Simply multiply original totalPages by 10 (and copies).
  const sheetsCount = totalPages > 0 ? Math.ceil(totalPages / pagesPerSheet) : 0;
  const totalAmount =
    totalPages > 0
      ? printType === 'bw'
        ? Math.ceil(totalPages / pagesPerSheet) * 2 * copies
        : totalPages * 10 * copies
      : 0;

  // Handle PDF file selection & pdf-lib page counting
  const handlePdfUpload = async (file: File) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setPdfError('Please upload a valid PDF document (.pdf only).');
      return;
    }

    setPdfError(null);
    setIsAnalyzingPdf(true);
    setPdfFile(file);
    setPdfFileName(file.name);
    setPdfFileSize(file.size);

    try {
      // Use pdf-lib directly to parse and count pages
      const pages = await countPdfPages(file);
      setPageCount(pages);
    } catch (err) {
      console.error('Error counting PDF pages:', err);
      setPdfError('Could not read PDF page count. Please check if the file is password-protected or corrupted.');
      setPageCount(null);
    } finally {
      setIsAnalyzingPdf(false);
    }
  };

  // Handle Screenshot Upload
  const handleScreenshotUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image screenshot of your payment.');
      return;
    }

    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // UTR Validation
  const handleUtrChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 12);
    setUtr(digitsOnly);
    if (digitsOnly.length > 0 && digitsOnly.length < 12) {
      setUtrError(`Enter full 12 digits (${digitsOnly.length}/12)`);
    } else {
      setUtrError(null);
    }
  };

  // Copy UPI ID
  const handleCopyUpi = () => {
    navigator.clipboard.writeText('sngce.library@upi');
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!studentName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!rollNumber.trim()) {
      setFormError('Please enter your Admission / Roll Number.');
      return;
    }
    if (!mobileNumber.trim() || mobileNumber.replace(/\D/g, '').length !== 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!department.trim()) {
      setFormError('Please select or enter your Department and Semester.');
      return;
    }
    if (!pdfFile || !pdfFileName || !pageCount || pageCount <= 0) {
      setFormError('Please upload a valid PDF document and wait for the page counter.');
      return;
    }
    if (utr.length !== 12) {
      setFormError('Please enter a valid 12-digit UPI Transaction ID (UTR).');
      return;
    }
    if (!screenshotFile) {
      setFormError('Please upload your payment screenshot proof.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Upload Files directly to Supabase Storage bucket `print_files`
      setSubmitStep('Uploading PDF document and payment proof to Supabase Storage...');
      const { pdfUrl, proofUrl } = await uploadOrderFiles(
        pdfFile,
        pdfFileName,
        screenshotFile,
        screenshotFile.name || 'payment_proof.png'
      );

      // Step 2: Insert into Supabase database table `print_orders`
      setSubmitStep('Registering print order in Supabase database...');
      const created = await createPrintOrder({
        studentName: studentName.trim(),
        rollNumber: rollNumber.trim(),
        mobileNumber: mobileNumber.trim(),
        department: department.trim(),
        pageCount,
        printType,
        sides,
        copies,
        totalAmount,
        pickupSlot,
        utr,
        pdfFileName,
        pdfFilePath: pdfUrl,
        paymentProofPath: proofUrl,
        status: 'Pending',
      });

      // Save order ID to local user storage
      saveMyOrderId(created.id);
      setSubmitSuccess(created);
      notifyLocalUpdate();
      await refreshOrders();

      // Reset form fields
      setPdfFile(null);
      setPdfFileName('');
      setPageCount(null);
      setUtr('');
      setScreenshotFile(null);
      setScreenshotPreview('');
      setRollNumber('');
      setMobileNumber('');
      setCopies(1);
      setIsCustomCopies(false);

      // Scroll to live tracker
      setTimeout(() => {
        myOrdersRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } catch (err: unknown) {
      console.error('Submission failed:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('relation "public.print_orders" does not exist') || errMsg.includes('PGRST205')) {
        setFormError('Database table `print_orders` not found in Supabase. Please run the `supabase_setup.sql` script in your Supabase SQL Editor.');
      } else if (errMsg.includes('Bucket not found') || errMsg.includes('print_files')) {
        setFormError('Storage bucket `print_files` not found in Supabase. Please run the `supabase_setup.sql` script in your Supabase SQL Editor.');
      } else {
        setFormError(`Failed to save print order: ${errMsg}`);
      }
    } finally {
      setIsSubmitting(false);
      setSubmitStep('');
    }
  };

  // Filter orders: show ONLY this student's own submissions
  const myOrders = orders.filter((o) => myOrderIds.includes(o.id));
  const displayOrders = myOrders;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Unauthorized Admin Access Warning Banner */}
      {authError === 'unauthorized_admin_access' && (
        <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 flex items-start gap-3 shadow-sm animate-in fade-in">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <h4 className="font-bold text-rose-950">Access Restricted</h4>
            <p className="mt-0.5 text-rose-800 leading-relaxed">
              The Librarian Desk (<code className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-200">/admin</code>) is strictly reserved for authorized library staff (<code>sidharthkv1100@gmail.com</code> / <code>photocopysng@gmail.com</code>).
              You have been safely redirected to the Student Portal.
            </p>
          </div>
        </div>
      )}

      {/* Supabase Notice Banner if table is not yet created */}
      {supabaseError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <h4 className="font-bold text-amber-950">Supabase Setup Required</h4>
              <p className="mt-1 text-amber-800 leading-relaxed">
                {supabaseError}
              </p>
              <p className="mt-1.5 text-xs text-amber-700">
                Run the script <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300 font-semibold">supabase_setup.sql</code> in your Supabase SQL Editor.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshOrders}
            className="px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-xs font-bold text-amber-900 shrink-0 transition-colors cursor-pointer"
          >
            Check Again
          </button>
        </div>
      )}

      {/* College Notice & Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-6 sm:p-8 shadow-lg shadow-emerald-950/10 border border-emerald-700/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Instant Document Print Queue
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Upload your lab records, seminar reports, or project documentation directly to our
              central library cloud queue. Pay via UPI and pick up your documents at your chosen slot.
            </p>
          </div>

          {/* Quick Rate Card */}
          <div className="flex flex-row sm:flex-col gap-3 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15 min-w-[200px]">
            <div className="flex items-center justify-between gap-4 pb-2 border-b border-white/10 text-xs">
              <span className="text-slate-200">B&amp;W Printing</span>
              <span className="font-bold text-emerald-300 text-sm">₹2 / sheet</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-slate-200">Colour Printing</span>
              <span className="font-bold text-teal-300 text-sm">₹10 / page</span>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Order Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Student Information */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                1
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Student Details
              </h2>
            </div>
            {session?.user ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Signed In: {session.user.email}</span>
              </span>
            ) : (
              <span className="text-xs text-slate-500 italic hidden sm:inline">
                Sign in with Google to auto-fill your name
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Rahul Nair"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Mobile Number (Mandatory) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mobile Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="e.g. 9876543210"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-mono"
              />
            </div>

            {/* Admission / Roll Number (Mandatory) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Admission / Roll No. <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="e.g. SNG24CS042 or 240192"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all uppercase placeholder:normal-case font-mono"
              />
            </div>

            {/* Department & Semester */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Department &amp; Semester <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. CSE - S6 or ECE - S6"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-slate-400 mr-1">Quick Select Dept:</span>
            {deptSuggestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDepartment(item)}
                className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                  department === item
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: PDF Upload & Instant Page Counter */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                2
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  PDF Upload &amp; Instant Page Counter
                </h2>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePdfUpload(file);
            }}
          />

          {!pdfFileName ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handlePdfUpload(file);
              }}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/20 group"
            >
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm sm:text-base">
                Click to browse or drag and drop your PDF here
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                PDF only. Page count is detected automatically.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm truncate max-w-xs sm:max-w-md block">
                      {pdfFileName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>{(pdfFileSize / 1024).toFixed(1)} KB</span>
                    <span>•</span>
                    <span>Ready for Supabase Storage</span>
                  </div>
                </div>
              </div>

              {/* Instant Page Counter Result */}
              <div className="flex items-center gap-3 sm:justify-end">
                {isAnalyzingPdf ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Counting pages...</span>
                  </div>
                ) : pageCount !== null ? (
                  <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-700" />
                    <div>
                      <span className="text-xs text-emerald-800 uppercase tracking-wide font-medium block">
                        Page Count
                      </span>
                      <span className="text-base font-extrabold text-emerald-950">
                        {pageCount} {pageCount === 1 ? 'Page' : 'Pages'}
                      </span>
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    setPdfFile(null);
                    setPdfFileName('');
                    setPageCount(null);
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Remove file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {pdfError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pdfError}</span>
            </div>
          )}
        </div>

        {/* Step 3: Print Options & Auto Fee Calculator */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                3
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Print Options &amp; Auto Fee Calculator
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Options selection */}
            <div className="space-y-4">
              {/* Print Type: B&W vs Colour */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Print Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrintType('bw')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      printType === 'bw'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/10'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">Black &amp; White</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          printType === 'bw' ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        ₹2 / sheet
                      </span>
                    </div>
                    <span className="block text-xs opacity-75 mt-1">₹2 per physical sheet (1, 2, or 4 pgs/sheet)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintType('colour')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      printType === 'colour'
                        ? 'bg-linear-to-r from-teal-700 to-emerald-800 text-white border-teal-700 shadow-sm ring-2 ring-teal-500/20'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">Full Colour</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          printType === 'colour'
                            ? 'bg-teal-900 text-teal-200'
                            : 'bg-teal-50 text-teal-700'
                        }`}
                      >
                        ₹10 / page
                      </span>
                    </div>
                    <span className="block text-xs opacity-75 mt-1">₹10 per PDF page (layout ignored)</span>
                  </button>
                </div>
              </div>

              {/* Print Sides: Single / Double / 4-in-1 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Print Sides
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {/* Single-Sided */}
                  <button
                    type="button"
                    onClick={() => setSides('single')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      sides === 'single'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">Single-Sided</div>
                        <div className="text-xs text-slate-500 font-normal">1 page per physical sheet</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${sides === 'single' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {printType === 'bw' ? '₹2 / sheet' : '₹10 / page'}
                      </span>
                    </div>
                  </button>

                  {/* Double-Sided (Back-to-Back) */}
                  <button
                    type="button"
                    onClick={() => setSides('double')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      sides === 'double'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">Double-Sided</div>
                        <div className="text-xs text-slate-500 font-normal">Back-to-back duplex — 2 pages per sheet</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${sides === 'double' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {printType === 'bw' ? '₹2 / sheet' : '₹10 / page'}
                      </span>
                    </div>
                  </button>

                  {/* 4-in-1 (2 landscape per side) */}
                  <button
                    type="button"
                    onClick={() => setSides('4in1')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      sides === '4in1'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">4-in-1 (Booklet)</div>
                        <div className="text-xs text-slate-500 font-normal">2 pages landscape per side, 4 pages per sheet</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${sides === '4in1' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {printType === 'bw' ? '₹2 / sheet' : '₹10 / page'}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Number of Copies */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Number of Copies
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={isCustomCopies ? 'custom' : copies}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsCustomCopies(true);
                      } else {
                        setIsCustomCopies(false);
                        setCopies(parseInt(e.target.value, 10));
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {[1, 2, 3, 4, 5, 10].map((num) => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'Copy' : 'Copies'}
                      </option>
                    ))}
                    <option value="custom">Custom...</option>
                  </select>

                  {isCustomCopies && (
                    <div className="flex items-center gap-1.5 animate-in fade-in">
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={copies}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setCopies(isNaN(val) || val < 1 ? 1 : val);
                        }}
                        placeholder="e.g. 11"
                        className="w-24 px-3 py-1.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/30 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                      />
                      <span className="text-xs font-semibold text-emerald-800">
                        {copies === 1 ? 'Copy' : 'Copies'}
                      </span>
                    </div>
                  )}

                  <span className="text-xs text-slate-500">
                    Number of complete document sets
                  </span>
                </div>
              </div>
            </div>

            {/* Auto Fee Calculator Card */}
            <div className="bg-linear-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-5 flex flex-col justify-between shadow-md">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Live Fee Calculation
                  </span>
                  <span className="text-xs font-mono text-emerald-400">
                    Instant Auto-Quote
                  </span>
                </div>

                <div className="mt-4 space-y-2.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span>Document Pages:</span>
                    <span className="font-semibold text-white">
                      {pageCount !== null ? `${pageCount} pages` : 'Upload PDF first'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rate Type:</span>
                    <span className="font-semibold text-white">
                      {printType === 'bw'
                        ? 'Black & White (₹2.00 / physical sheet)'
                        : 'Full Colour (₹10.00 / PDF page)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Layout Format:</span>
                    <span className="font-semibold text-white">
                      {sides === 'single'
                        ? 'Single-Sided (1 pg/sheet)'
                        : sides === 'double'
                        ? 'Double-Sided Duplex (2 pgs/sheet)'
                        : '4-in-1 Booklet (4 pgs/sheet)'}
                    </span>
                  </div>
                  {printType === 'bw' && pageCount !== null && (
                    <div className="flex justify-between">
                      <span>Physical Sheets:</span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        {sheetsCount} {sheetsCount === 1 ? 'sheet' : 'sheets'} (per copy)
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Number of Copies:</span>
                    <span className="font-semibold text-white">{copies}</span>
                  </div>

                  {pageCount !== null && (
                    <div className="pt-2 border-t border-slate-700/60 text-[11px] font-mono text-slate-400">
                      {printType === 'bw'
                        ? `⌈${pageCount} / ${pagesPerSheet}⌉ = ${sheetsCount} sheets × ₹2 × ${copies} ${copies === 1 ? 'copy' : 'copies'} = ₹${totalAmount.toFixed(2)}`
                        : `${pageCount} pages × ₹10 × ${copies} ${copies === 1 ? 'copy' : 'copies'} = ₹${totalAmount.toFixed(2)}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Prominently Displayed Total Payable Amount */}
              <div className="mt-6 pt-4 border-t border-slate-700/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block">
                    Total Payable Amount
                  </span>
                  <span className="text-[11px] text-emerald-400 font-medium">
                    (Payable to Central Library UPI)
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
                    ₹{totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Pickup Time Slot Selector */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                4
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Pickup Time Slot Selector
                </h2>
                <p className="text-xs text-slate-500">
                  Select when you will arrive at the library printing counter
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PICKUP_SLOTS.map((slot) => {
              const isSelected = pickupSlot === slot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setPickupSlot(slot.id)}
                  className={`p-4 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {slot.badge}
                    </span>
                    <Clock
                      className={`w-4 h-4 ${
                        isSelected ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <div className="font-bold text-sm text-slate-900">
                    {slot.title}
                  </div>
                  <div className="text-xs font-medium text-slate-600 mt-0.5">
                    {slot.timeRange}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 5: UPI Payment & Proof Upload */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-xs border border-slate-200 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                5
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                UPI Payment &amp; Proof Upload
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* UPI QR & Payment Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Official College UPI Receiver
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Verified Merchant
                </span>
              </div>

              {/* QR Code Container */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center shadow-xs">
                {/* Visual SVG QR Code */}
                <div className="relative p-2 bg-white rounded-lg border border-slate-200">
                  <svg
                    width="140"
                    height="140"
                    viewBox="0 0 140 140"
                    className="text-slate-900"
                    fill="currentColor"
                  >
                    <rect x="10" y="10" width="35" height="35" rx="4" fill="#0f172a" />
                    <rect x="17" y="17" width="21" height="21" rx="2" fill="#ffffff" />
                    <rect x="23" y="23" width="9" height="9" fill="#0f172a" />

                    <rect x="95" y="10" width="35" height="35" rx="4" fill="#0f172a" />
                    <rect x="102" y="17" width="21" height="21" rx="2" fill="#ffffff" />
                    <rect x="108" y="23" width="9" height="9" fill="#0f172a" />

                    <rect x="10" y="95" width="35" height="35" rx="4" fill="#0f172a" />
                    <rect x="17" y="102" width="21" height="21" rx="2" fill="#ffffff" />
                    <rect x="23" y="108" width="9" height="9" fill="#0f172a" />

                    <rect x="52" y="15" width="6" height="6" />
                    <rect x="64" y="15" width="6" height="6" />
                    <rect x="76" y="25" width="6" height="6" />
                    <rect x="52" y="35" width="6" height="6" />
                    <rect x="68" y="35" width="6" height="6" />
                    <rect x="52" y="52" width="10" height="10" fill="#059669" />
                    <rect x="68" y="52" width="6" height="6" />
                    <rect x="80" y="52" width="6" height="6" />
                    <rect x="95" y="52" width="12" height="6" />
                    <rect x="115" y="52" width="6" height="12" />
                    <rect x="15" y="52" width="8" height="8" />
                    <rect x="28" y="65" width="8" height="8" />
                    <rect x="52" y="68" width="8" height="8" />
                    <rect x="68" y="68" width="12" height="12" fill="#0f172a" />
                    <rect x="90" y="68" width="6" height="6" />
                    <rect x="105" y="68" width="8" height="8" />
                    <rect x="120" y="68" width="6" height="6" />
                    <rect x="52" y="88" width="6" height="6" />
                    <rect x="64" y="95" width="8" height="8" />
                    <rect x="80" y="85" width="8" height="8" />
                    <rect x="95" y="95" width="10" height="10" fill="#059669" />
                    <rect x="115" y="88" width="8" height="8" />
                    <rect x="52" y="112" width="8" height="8" />
                    <rect x="68" y="112" width="6" height="6" />
                    <rect x="80" y="112" width="10" height="10" />
                    <rect x="105" y="115" width="15" height="6" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold shadow-xs">
                      UPI
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-800">
                    SNGCE Library Print Counter
                  </div>
                  <div className="text-[11px] text-slate-500">Scan using any UPI App (GPay, PhonePe, Paytm)</div>
                </div>

                <div className="mt-3 w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-mono text-slate-700 font-medium">sngce.library@upi</span>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold"
                  >
                    {copiedUpi ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-2 text-xs font-bold text-emerald-700">
                  Exact Amount: ₹{totalAmount.toFixed(2)}
                </div>
              </div>
            </div>

            {/* UTR Input & Screenshot Upload */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  12-Digit UPI Transaction ID (UTR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={utr}
                    onChange={(e) => handleUtrChange(e.target.value)}
                    placeholder="e.g. 418290314821"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono tracking-wider text-slate-900 focus:outline-none transition-all ${
                      utrError
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                        : utr.length === 12
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20'
                        : 'border-slate-300 focus:ring-2 focus:ring-emerald-500'
                    }`}
                  />
                  <div className="absolute right-3 top-2.5 flex items-center gap-1">
                    {utr.length === 12 ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-700 font-semibold">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>Valid UTR</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-mono">
                        {utr.length}/12
                      </span>
                    )}
                  </div>
                </div>
                {utrError ? (
                  <p className="text-xs text-rose-600 mt-1">{utrError}</p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Found in your UPI app receipt under &quot;UPI Ref No.&quot; or &quot;UTR&quot;
                  </p>
                )}
              </div>

              {/* Payment Screenshot Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Screenshot Proof <span className="text-rose-500">*</span>
                </label>

                <input
                  ref={screenshotInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleScreenshotUpload(file);
                  }}
                />

                {!screenshotPreview ? (
                  <div
                    onClick={() => screenshotInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/20"
                  >
                    <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                    <span className="text-xs font-semibold text-slate-700 block">
                      Upload Payment Screenshot
                    </span>
                    <span className="text-[11px] text-slate-400">
                      JPEG, PNG or any image format
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={screenshotPreview}
                        alt="Payment Proof Preview"
                        className="w-14 h-14 object-cover rounded-lg border border-slate-300 shadow-xs"
                      />
                      <div>
                        <div className="text-xs font-semibold text-slate-900 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Proof Attached</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {screenshotFile?.name || 'UPI_Receipt.png'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setScreenshotFile(null);
                        setScreenshotPreview('');
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Remove screenshot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form Error Banner */}
        {formError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-sm text-rose-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500">
            {submitStep ? (
              <span className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CloudUpload className="w-4 h-4 animate-bounce" />
                <span>{submitStep}</span>
              </span>
            ) : (
              <span>All files are securely uploaded to cloud storage.</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isAnalyzingPdf}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-sm sm:text-base shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Syncing to Supabase...</span>
              </>
            ) : (
              <>
                <span>Submit Print Order</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Submission Success Alert */}
      {submitSuccess && (
        <div className="p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-500/40 shadow-sm space-y-3 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-emerald-950">
                Print Order Placed in Supabase!
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-700 text-white text-sm font-mono font-extrabold">
              Token #{submitSuccess.token}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed">
            Your document has been uploaded to Supabase Storage bucket <code>print_files</code> and registered with Token{' '}
            <strong>#{submitSuccess.token}</strong>. Your prints will be processed for the{' '}
            <strong>
              {PICKUP_SLOTS.find((s) => s.id === submitSuccess.pickupSlot)?.timeRange}
            </strong>{' '}
            pickup slot. Check live updates below!
          </p>
        </div>
      )}

      {/* Live Order Tracker: "My Orders" */}
      <div ref={myOrdersRef} className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-700" />
            <h2 className="text-lg font-bold text-slate-900">
              My Print Orders
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Updates
          </span>
        </div>

        {displayOrders.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
            You haven&apos;t submitted any print orders yet. Submit your first print request above!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayOrders.map((order) => {
              const slotInfo = PICKUP_SLOTS.find((s) => s.id === order.pickupSlot);
              const normalizedStatus = (order.status || '').toLowerCase();

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-shadow space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono font-bold text-sm">
                        #{order.token}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                          <span>{order.studentName}</span>
                          {order.rollNumber && order.rollNumber !== 'N/A' && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {order.rollNumber}
                            </span>
                          )}
                          {order.mobileNumber && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200">
                              📞 {order.mobileNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {order.department}
                        </div>
                      </div>
                    </div>

                    {/* Live Status Badge */}
                    <div>
                      {normalizedStatus === 'pending' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          <span>In Queue</span>
                        </span>
                      )}
                      {normalizedStatus === 'ready' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ready for Pickup</span>
                        </span>
                      )}
                      {normalizedStatus === 'collected' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          <span>Collected</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Order Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-500 block">Pickup Slot:</span>
                      <span className="font-semibold text-slate-800">
                        {slotInfo?.title} ({slotInfo?.badge})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Time Window:</span>
                      <span className="font-semibold text-slate-800">
                        {slotInfo?.timeRange}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Document:</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {order.pdfFileName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Pages &amp; Mode:</span>
                      <span className="font-semibold text-slate-800">
                        {order.pageCount} pgs • {order.printType === 'bw' ? 'B&W' : 'Colour'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Footer Info */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="text-slate-500 font-mono">
                      UTR: <span className="font-semibold text-slate-700">{order.utr}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {order.pdfFilePath && (
                        <a
                          href={order.pdfFilePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 text-[11px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>View PDF</span>
                        </a>
                      )}
                      <span className="font-bold text-slate-900 text-sm">
                        Paid: ₹{order.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentPortal() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto p-8 text-center text-slate-500">Loading Student Portal...</div>}>
      <StudentPortalContent />
    </Suspense>
  );
}
