'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Printer,
  Clock,
  CheckCircle2,
  Sparkles,
  Info,
  X,
  LogIn,
  LogOut,
  User,
} from 'lucide-react';
import { fetchPrintOrders, subscribeToOrders, computeSummary } from '@/lib/orders-service';
import { QueueSummary } from '@/types';
import { isLibrarian } from '@/lib/auth-config';

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const [summary, setSummary] = useState<QueueSummary>({
    pendingCount: 0,
    readyCount: 0,
    collectedCount: 0,
    totalPagesInQueue: 0,
    totalRevenue: 0,
  });
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Check if current logged-in user is the librarian
  const userIsLibrarian = isLibrarian(session?.user?.email);

  // Reset avatar error when user changes
  useEffect(() => {
    setAvatarError(false);
  }, [session?.user?.email]);

  useEffect(() => {
    // Initial fetch from Supabase
    fetchPrintOrders()
      .then((orders) => {
        setSummary(computeSummary(orders));
      })
      .catch((err) => {
        console.warn('Could not fetch from Supabase:', err);
      });

    // Realtime subscription
    const unsubscribe = subscribeToOrders(() => {
      fetchPrintOrders()
        .then((orders) => {
          setSummary(computeSummary(orders));
        })
        .catch(() => {});
    });

    return () => unsubscribe();
  }, []);

  const userImage = session?.user?.image;
  const userName = session?.user?.name;
  const userInitial = userName ? userName.charAt(0).toUpperCase() : null;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* College & Library Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20 border border-slate-200 shrink-0">
                <Image
                  src="/sngce-logo.png"
                  alt="SNGCE College Logo"
                  width={34}
                  height={34}
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                  SNGCE Central Library
                </span>
              </div>
            </div>

            {/* Live Queue Indicators & Auth Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Live Queue Indicator Pill (visible on desktop) */}
              <div className="hidden md:flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70 font-medium">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>{summary.pendingCount} in queue</span>
                </span>
                {summary.readyCount > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 font-medium">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{summary.readyCount} ready</span>
                  </span>
                )}
              </div>

              {/* User Authentication Status */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                {status === 'loading' ? (
                  <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
                ) : session?.user ? (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      {/* Google profile picture or fallback initial */}
                      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-xs ring-2 ring-emerald-500/20">
                        {userImage && !avatarError ? (
                          <Image
                            src={userImage}
                            alt={userName || 'User'}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                            onError={() => setAvatarError(true)}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center">
                            {userInitial ?? <User className="w-4 h-4" />}
                          </div>
                        )}
                      </div>

                      <div className="hidden lg:block text-left">
                        <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[130px]">
                          {userName || session.user.email}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                              userIsLibrarian
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {userIsLibrarian ? 'Librarian' : 'Student'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Sign Out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </Link>
                )}
              </div>

              {/* Information modal button */}
              <button
                type="button"
                onClick={() => setShowInfoModal(true)}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                title="System Info & Rates"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-linear-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-200" />
                <h3 className="font-semibold text-base">SNGCE Library Print Desk</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm text-slate-600">
              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Printing Rates (Standard A4):</h4>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="block text-xs text-slate-500 font-medium">Black &amp; White</span>
                    <span className="text-base font-bold text-slate-900">₹2.00 / page</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-center">
                    <span className="block text-xs text-teal-700 font-medium">Colour Print</span>
                    <span className="text-base font-bold text-teal-900">₹10.00 / page</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-1">Pickup Windows:</h4>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <strong>Morning Slot:</strong> 8:30 AM – 9:30 AM
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <strong>Noon Slot:</strong> 12:30 PM – 1:30 PM
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <strong>Evening Slot:</strong> 3:30 PM – 4:30 PM
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="w-full py-2 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
