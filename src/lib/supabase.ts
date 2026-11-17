import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Warning: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Please check your .env.local configuration.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const BUCKET_NAME = 'print_files';

/**
 * Uploads a file directly to the Supabase Storage bucket `print_files`.
 * Returns the public URL of the uploaded file.
 */
export async function uploadFileToSupabase(
  file: File | Blob,
  folder: 'pdfs' | 'proofs',
  fileName: string
): Promise<{ path: string; publicUrl: string }> {
  // Sanitize filename to avoid weird characters in path
  const sanitizedName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '_');
  const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const filePath = `${folder}/${uniquePrefix}_${sanitizedName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || (folder === 'pdfs' ? 'application/pdf' : 'image/jpeg'),
    });

  if (error) {
    console.error(`Error uploading to ${folder}:`, error);
    throw new Error(`Failed to upload ${fileName} to Supabase Storage: ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return {
    path: data.path,
    publicUrl: publicUrlData.publicUrl,
  };
}

/**
 * Resolves the public URL for a given storage path or returns the URL as-is if already absolute.
 */
export function getSupabasePublicUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('data:')) {
    return pathOrUrl;
  }
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(pathOrUrl);
  return data.publicUrl;
}
