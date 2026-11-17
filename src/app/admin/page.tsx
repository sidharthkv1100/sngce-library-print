import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth-options';
import { isLibrarian } from '@/lib/auth-config';
import LibrarianDashboard from '@/components/LibrarianDashboard';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  // 1. Force Authentication:
  // If a user is not logged in, they cannot see the dashboard; redirect to login.
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin');
  }

  // 4. Strict Route Isolation:
  // If a student tries to force their way into /admin via the URL,
  // immediately redirect them back to the Student Portal ('/').
  if (!isLibrarian(session.user.email)) {
    redirect('/?error=unauthorized_admin_access');
  }

  // Authorized Librarian operates exclusively in the /admin dashboard
  return <LibrarianDashboard />;
}
