import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth-options';
import { isLibrarian } from '@/lib/auth-config';
import StudentPortal from '@/components/StudentPortal';

export default async function Home() {
  const session = await getServerSession(authOptions);

  // 1. Force Authentication: Protect the main application.
  // Unauthenticated users cannot see the upload form; redirect to login.
  if (!session?.user) {
    redirect('/login');
  }

  // 2 & 4. Automatic Role-Based Redirection & Strict Route Isolation:
  // If user matches the ADMIN_EMAILS list, automatically drop them into /admin (Librarian Desk).
  // The Librarian operates exclusively in the /admin dashboard.
  if (isLibrarian(session.user.email)) {
    redirect('/admin');
  }

  // Standard students operate exclusively on the / upload form
  return <StudentPortal />;
}
