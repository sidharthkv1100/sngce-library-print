import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { isLibrarian } from '@/lib/auth-config';
import { custom } from 'openid-client';

// Increase openid-client HTTP timeout from default 3500ms to 15000ms
// to prevent "outgoing request timed out after 3500ms" during Google discovery & token exchange
custom.setHttpOptionsDefaults({
  timeout: 15000,
});

const googleProvider = GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
  authorization: {
    params: {
      prompt: 'select_account',
      access_type: 'offline',
      response_type: 'code',
      // Domain restriction removed: all Google accounts permitted (college ID, 1st year students, staff)
    },
  },
});
// Set checks to 'none' to avoid browser cross-origin cookie dropping (State / PKCE missing) on localhost
googleProvider.checks = ['none'];

export const authOptions: NextAuthOptions = {
  providers: [
    // Pure Google OAuth Authentication - only real Google sign-ins are permitted
    googleProvider,
  ],

  callbacks: {
    // Any valid Google account is accepted
    async signIn({ user }) {
      if (!user?.email) {
        console.warn('[NextAuth] Rejected login: No email provided.');
        return false;
      }
      return true;
    },

    // Assign the Admin / Librarian role if email is in ADMIN_EMAILS (sidharthkv1100@gmail.com, photocopysng@gmail.com).
    // Everyone else defaults to the Student role.
    async jwt({ token, user }) {
      const email = user?.email || token?.email;
      if (email) {
        const userIsAdmin = isLibrarian(email);
        token.role = userIsAdmin ? 'librarian' : 'student';
        token.isLibrarian = userIsAdmin;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        const email = session.user.email?.toLowerCase();
        const userIsAdmin = isLibrarian(email) || token.role === 'librarian';
        (session.user as unknown as { role?: string; isLibrarian?: boolean }).role =
          userIsAdmin ? 'librarian' : 'student';
        (session.user as unknown as { role?: string; isLibrarian?: boolean }).isLibrarian =
          userIsAdmin;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
  },

  useSecureCookies: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,

  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,
      },
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,
      },
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,
      },
    },
  },

  secret: process.env.NEXTAUTH_SECRET || 'sngce_central_library_print_secret_auth_token_2026',
};
