import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting full cleanup of unused files from storage...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get ALL referenced storage paths from books
    const { data: books, error: fetchError } = await supabase
      .from('books')
      .select('storage_path, video_storage_path')
      .limit(2000);

    if (fetchError) {
      console.error('Error fetching book paths:', fetchError);
      throw fetchError;
    }

    const usedPaths = new Set<string>();
    for (const b of books || []) {
      if (b.storage_path) usedPaths.add(b.storage_path);
      if (b.video_storage_path) usedPaths.add(b.video_storage_path);
    }

    console.log(`Found ${usedPaths.size} referenced storage paths`);

    // List ALL top-level folders in the bucket
    const { data: topLevel, error: topError } = await supabase.storage
      .from('ObrazkiKsiazek')
      .list('', { limit: 1000 });

    if (topError) {
      console.error('Error listing top-level:', topError);
      throw topError;
    }

    const filesToDelete: string[] = [];
    const filesKept: string[] = [];
    let totalScanned = 0;

    // Scan each folder (skip temp-videos, handled by dedicated cron)
    for (const item of topLevel || []) {
      // Skip non-folder items at root level
      if (!item.id && item.name) {
        // It's a folder - list its contents
        const folderName = item.name;
        
        // Skip temp-videos (handled by cleanup-temp-videos)
        if (folderName === 'temp-videos' || folderName === '.emptyFolderPlaceholder') continue;

        const { data: files, error: listError } = await supabase.storage
          .from('ObrazkiKsiazek')
          .list(folderName, { limit: 1000 });

        if (listError) {
          console.warn(`Error listing ${folderName}:`, listError);
          continue;
        }

        for (const file of files || []) {
          if (file.name === '.emptyFolderPlaceholder') continue;
          const fullPath = `${folderName}/${file.name}`;
          totalScanned++;
          if (!usedPaths.has(fullPath)) {
            filesToDelete.push(fullPath);
          } else {
            filesKept.push(fullPath);
          }
        }
      }
    }

    console.log(`Scanned ${totalScanned} files across all folders`);
    console.log(`Files to delete: ${filesToDelete.length}`);
    console.log(`Files to keep: ${filesKept.length}`);

    let deletedCount = 0;
    const deleteErrors: string[] = [];

    // Delete in batches of 100
    for (let i = 0; i < filesToDelete.length; i += 100) {
      const batch = filesToDelete.slice(i, i + 100);
      const { error: deleteError } = await supabase.storage
        .from('ObrazkiKsiazek')
        .remove(batch);

      if (deleteError) {
        console.error(`Error deleting batch ${i}:`, deleteError);
        deleteErrors.push(deleteError.message);
      } else {
        deletedCount += batch.length;
        console.log(`Deleted batch: ${batch.length} files`);
      }
    }

    console.log(`Cleanup complete: deleted ${deletedCount} files, kept ${filesKept.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Usunięto ${deletedCount} nieużywanych plików. Zachowano ${filesKept.length} używanych.`,
        stats: {
          totalScanned,
          deleted: deletedCount,
          kept: filesKept.length,
          deletedFiles: filesToDelete,
          keptFiles: filesKept,
          errors: deleteErrors,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in cleanup-unused-images:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
