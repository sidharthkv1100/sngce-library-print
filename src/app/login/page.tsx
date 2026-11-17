'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import {
  Printer,
  ShieldAlert,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { isLibrarian } from '@/lib/auth-config';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const errorParam = searchParams.get('error');

  const [isLoading, setIsLoading] = useState(false);

  // If already authenticated, redirect immediately based on role:
  // Admin (sidharthkv1100@gmail.com, photocopysng@gmail.com) -> /admin (Librarian Desk)
  // Student -> / (Student Portal)
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      const destination = isLibrarian(session.user.email) ? '/admin' : '/';
      router.replace(destination);
    }
  }, [session, status, router]);

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl: '/' });
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-lg shadow-emerald-600/10 ring-4 ring-emerald-500/10 border border-slate-200">
            <Image
              src="/sngce-logo.png"
              alt="SNGCE College Logo"
              width={52}
              height={52}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            SNGCE Central Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Sign in with your Google account to queue and track print jobs.
          </p>
        </div>

        {/* Error Alert Banner */}
        {errorParam && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-700 flex items-start gap-2.5 animate-in fade-in">
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <span className="font-bold block">Sign-in Notice</span>
              <span>
                {errorParam === 'OAuthSignin'
                  ? 'Google sign-in connection timed out. Please try again.'
                  : errorParam === 'OAuthCallback'
                  ? 'Google authentication callback was interrupted. Please ensure your Google account is allowed or try again.'
                  : errorParam === 'AccessDenied'
                  ? 'Access Denied: Your account does not have permission to access this portal.'
                  : 'Authentication could not be completed. Please try again with a valid Google account.'}
              </span>
            </div>
          </div>
        )}

        {/* Primary Action: Exclusive Google OAuth Button */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            disabled={isLoading || status === 'loading'}
            onClick={handleGoogleSignIn}
            className="w-full py-3.5 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold flex items-center justify-center gap-3 shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                {/* Official Google Icon SVG */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-slate-400">
            Open to all SNGCE college students, faculty, and staff.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[85vh] flex items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
