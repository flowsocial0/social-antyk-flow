import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting cleanup of temp-videos...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Query storage.objects directly for temp-videos older than 2 hours
    const { data: oldFiles, error: queryError } = await supabase
      .from('objects' as any)
      .select('name')
      .eq('bucket_id', 'ObrazkiKsiazek')
      .like('name', 'temp-videos/%')
      .lt('created_at', TWO_HOURS_AGO)
      .limit(500);

    if (queryError) {
      console.error('Error querying storage.objects:', queryError);
      // Fallback: list via storage API and filter by filename timestamp
      return await fallbackCleanup(supabase, corsHeaders);
    }

    const filesToDelete = (oldFiles || []).map((f: any) => f.name);
    console.log(`Found ${filesToDelete.length} temp-video files older than 2 hours`);

    let deletedCount = 0;
    const errors: string[] = [];

    // Delete in batches of 100
    for (let i = 0; i < filesToDelete.length; i += 100) {
      const batch = filesToDelete.slice(i, i + 100);
      const { error: deleteError } = await supabase.storage
        .from('ObrazkiKsiazek')
        .remove(batch);

      if (deleteError) {
        console.error(`Error deleting batch ${i}:`, deleteError);
        errors.push(deleteError.message);
      } else {
        deletedCount += batch.length;
        console.log(`Deleted batch: ${batch.length} files`);
      }
    }

    console.log(`Cleanup complete: deleted ${deletedCount} files`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Usunięto ${deletedCount} tymczasowych plików wideo.`,
        stats: {
          found: filesToDelete.length,
          deleted: deletedCount,
          errors,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in cleanup-temp-videos:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});

// Fallback: use storage.list() and filter by timestamp in filename
async function fallbackCleanup(supabase: any, corsHeaders: Record<string, string>) {
  console.log('Using fallback cleanup via storage.list()...');

  const { data: files, error: listError } = await supabase.storage
    .from('ObrazkiKsiazek')
    .list('temp-videos', { limit: 1000 });

  if (listError) {
    console.error('Error listing temp-videos:', listError);
    return new Response(
      JSON.stringify({ success: false, error: listError.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }

  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const filesToDelete: string[] = [];

  for (const file of files || []) {
    // Try to extract timestamp from filename pattern: bookId-TIMESTAMP.mp4
    const match = file.name.match(/-(\d{13})\./);
    if (match) {
      const fileTimestamp = parseInt(match[1], 10);
      if (fileTimestamp < twoHoursAgo) {
        filesToDelete.push(`temp-videos/${file.name}`);
      }
    } else if (file.created_at) {
      // Use created_at from list response if available
      const createdAt = new Date(file.created_at).getTime();
      if (createdAt < twoHoursAgo) {
        filesToDelete.push(`temp-videos/${file.name}`);
      }
    } else {
      // If we can't determine age, delete it (it's orphaned)
      filesToDelete.push(`temp-videos/${file.name}`);
    }
  }

  let deletedCount = 0;
  for (let i = 0; i < filesToDelete.length; i += 100) {
    const batch = filesToDelete.slice(i, i + 100);
    const { error } = await supabase.storage.from('ObrazkiKsiazek').remove(batch);
    if (!error) deletedCount += batch.length;
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: `Usunięto ${deletedCount} tymczasowych plików wideo (fallback).`,
      stats: { found: filesToDelete.length, deleted: deletedCount },
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}
