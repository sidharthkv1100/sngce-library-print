import { NextRequest, NextResponse } from 'next/server';
import { supabase, BUCKET_NAME } from '@/lib/supabase';

/**
 * Helper to extract relative storage path (e.g. "pdfs/xyz.pdf") from
 * either a storage path or a full Supabase public URL.
 */
function extractStoragePath(pathOrUrl: string): string | null {
  if (!pathOrUrl) return null;

  // If it's a full Supabase public URL:
  // e.g. https://.../storage/v1/object/public/print_files/pdfs/1700000_sample.pdf
  const bucketMarker = `/${BUCKET_NAME}/`;
  const markerIndex = pathOrUrl.indexOf(bucketMarker);
  if (markerIndex !== -1) {
    return decodeURIComponent(pathOrUrl.substring(markerIndex + bucketMarker.length));
  }

  // If already relative (e.g. "pdfs/..." or "proofs/...")
  if (pathOrUrl.startsWith('pdfs/') || pathOrUrl.startsWith('proofs/')) {
    return pathOrUrl;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Verify Authorization Header against CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Invalid or missing Bearer token in Authorization header.',
        },
        { status: 401 }
      );
    }

    // 2. Compute 24-hour cutoff timestamp
    const now = Date.now();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    // 3. Fetch all orders older than 24 hours
    const { data: expiredOrders, error: fetchError } = await supabase
      .from('print_orders')
      .select('id, token, student_name, pdf_file_path, payment_proof_path, created_at')
      .lt('created_at', twentyFourHoursAgo);

    if (fetchError) {
      console.error('Error fetching expired print orders:', fetchError);
      return NextResponse.json(
        {
          success: false,
          error: `Database fetch failed: ${fetchError.message}`,
        },
        { status: 500 }
      );
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No print orders older than 24 hours found. Cleanup complete.',
        cutoffTime: twentyFourHoursAgo,
        ordersDeleted: 0,
        filesDeleted: 0,
      });
    }

    // 4. Gather file storage paths to delete from `print_files` bucket
    const filesToDelete: string[] = [];
    for (const order of expiredOrders) {
      const pdfPath = extractStoragePath(order.pdf_file_path);
      if (pdfPath) filesToDelete.push(pdfPath);

      const proofPath = extractStoragePath(order.payment_proof_path);
      if (proofPath) filesToDelete.push(proofPath);
    }

    // 5. Delete files from Supabase Storage (safely wrapped in try-catch)
    let storageDeleteCount = 0;
    if (filesToDelete.length > 0) {
      try {
        const { data: storageData, error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(filesToDelete);

        if (storageError) {
          console.warn('Storage deletion warning:', storageError.message);
        } else {
          storageDeleteCount = storageData?.length || filesToDelete.length;
        }
      } catch (storageErr) {
        console.warn('Storage removal bypassed:', storageErr);
      }
    }

    // 6. Delete the rows from `print_orders` table
    const expiredIds = expiredOrders.map((o) => o.id);
    const { error: dbDeleteError } = await supabase
      .from('print_orders')
      .delete()
      .in('id', expiredIds);

    if (dbDeleteError) {
      console.error('Error deleting expired rows from database:', dbDeleteError);
      return NextResponse.json(
        {
          success: false,
          error: `Database row deletion failed: ${dbDeleteError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${expiredIds.length} expired orders and associated storage files.`,
      cutoffTime: twentyFourHoursAgo,
      ordersDeleted: expiredIds.length,
      filesDeleted: storageDeleteCount,
      cleanedOrders: expiredOrders.map((o) => ({
        id: o.id,
        token: o.token,
        studentName: o.student_name,
        createdAt: o.created_at,
      })),
    });
  } catch (err: unknown) {
    console.error('Unhandled cleanup cron error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}

// Support POST requests as well for flexible webhook / scheduler support
export async function POST(request: NextRequest) {
  return GET(request);
}
