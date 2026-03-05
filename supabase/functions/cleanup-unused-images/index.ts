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
    console.log('Starting cleanup of unused images from storage...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all storage_paths that are actually used by books
    const { data: usedPaths, error: fetchError } = await supabase
      .from('books')
      .select('storage_path')
      .not('storage_path', 'is', null)
      .neq('storage_path', '');

    if (fetchError) {
      console.error('Error fetching used paths:', fetchError);
      throw fetchError;
    }

    const usedStoragePaths = new Set(
      (usedPaths || [])
        .map((b: { storage_path: string }) => b.storage_path)
        .filter(Boolean)
    );

    console.log('Used storage paths:', Array.from(usedStoragePaths));

    // List all files in the ObrazkiKsiazek bucket under books/ folder
    const { data: storageFiles, error: listError } = await supabase.storage
      .from('ObrazkiKsiazek')
      .list('books', { limit: 1000 });

    if (listError) {
      console.error('Error listing storage files:', listError);
      throw listError;
    }

    console.log(`Found ${storageFiles?.length || 0} files in storage`);

    const filesToDelete: string[] = [];
    const filesKept: string[] = [];

    for (const file of storageFiles || []) {
      const fullPath = `books/${file.name}`;
      if (!usedStoragePaths.has(fullPath)) {
        filesToDelete.push(fullPath);
      } else {
        filesKept.push(fullPath);
      }
    }

    console.log('Files to delete:', filesToDelete);
    console.log('Files to keep:', filesKept);

    // Also clean up temp-videos older than 2 hours
    let tempDeletedCount = 0;
    try {
      const { data: tempFiles } = await supabase.storage
        .from('ObrazkiKsiazek')
        .list('temp-videos', { limit: 1000 });

      if (tempFiles && tempFiles.length > 0) {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        const tempToDelete: string[] = [];
        for (const file of tempFiles) {
          const match = file.name.match(/-(\d{13})\./);
          if (match) {
            if (parseInt(match[1], 10) < twoHoursAgo) {
              tempToDelete.push(`temp-videos/${file.name}`);
            }
          } else {
            tempToDelete.push(`temp-videos/${file.name}`);
          }
        }
        if (tempToDelete.length > 0) {
          const { error } = await supabase.storage.from('ObrazkiKsiazek').remove(tempToDelete);
          if (!error) tempDeletedCount = tempToDelete.length;
          console.log(`Temp-videos cleanup: deleted ${tempDeletedCount} files`);
        }
      }
    } catch (e) {
      console.warn('Temp-videos cleanup failed:', e);
    }

    let deletedCount = 0;
    const deleteErrors: string[] = [];

    if (filesToDelete.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from('ObrazkiKsiazek')
        .remove(filesToDelete);

      if (deleteError) {
        console.error('Error deleting files:', deleteError);
        deleteErrors.push(deleteError.message);
      } else {
        deletedCount = filesToDelete.length;
        console.log(`Successfully deleted ${deletedCount} files`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Usunięto ${deletedCount} nieużywanych obrazków i ${tempDeletedCount} tymczasowych wideo. Zachowano ${filesKept.length} używanych.`,
        stats: {
          totalInStorage: storageFiles?.length || 0,
          deleted: deletedCount,
          kept: filesKept.length,
          tempVideosDeleted: tempDeletedCount,
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
