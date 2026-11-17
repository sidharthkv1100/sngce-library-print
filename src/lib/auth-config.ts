export const COLLEGE_DOMAIN = 'sngce.ac.in';

// List of authorized Librarian / Admin email addresses (ERP-style staff access)
export const ADMIN_EMAILS: string[] = (
  process.env.ADMIN_EMAILS ||
  process.env.LIBRARIAN_EMAIL ||
  'sidharthkv1100@gmail.com,photocopysng@gmail.com'
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const LIBRARIAN_EMAIL = ADMIN_EMAILS[0] || 'sidharthkv1100@gmail.com';

/**
 * Checks if an email address belongs to the college domain @sngce.ac.in (informational)
 */
export function isCollegeEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(`@${COLLEGE_DOMAIN}`);
}

/**
 * Checks if an email address is an authorized Librarian / Admin staff account.
 * Matches against the ADMIN_EMAILS list.
 */
export function isLibrarian(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalized);
}

/**
 * Alias for isLibrarian to support standard admin checks
 */
export function isAdmin(email?: string | null): boolean {
  return isLibrarian(email);
}
