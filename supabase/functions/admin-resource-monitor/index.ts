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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const userId = claimsData.claims.sub;
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 1. Database size
    const { data: dbSizeData } = await supabase.rpc('pg_database_size_mb' as any);
    
    // Fallback: query storage.objects for storage info
    // 2. Storage breakdown by folder
    const { data: storageObjects, error: storageError } = await supabase
      .from('storage' as any)
      .select('*');

    // Use raw SQL via a dedicated approach - query storage.objects
    // We'll aggregate from the Storage API instead
    
    // List all top-level folders and count files + estimate sizes
    const { data: topLevel } = await supabase.storage
      .from('ObrazkiKsiazek')
      .list('', { limit: 1000 });

    const storageFolders: { name: string; fileCount: number; }[] = [];
    
    for (const item of topLevel || []) {
      if (item.name === '.emptyFolderPlaceholder') continue;
      
      if (!item.id) {
        // Folder - list contents
        const { data: files } = await supabase.storage
          .from('ObrazkiKsiazek')
          .list(item.name, { limit: 1000 });
        
        const realFiles = (files || []).filter(f => f.name !== '.emptyFolderPlaceholder');
        storageFolders.push({
          name: item.name,
          fileCount: realFiles.length,
        });
      } else {
        // Root-level file
        storageFolders.push({
          name: item.name,
          fileCount: 1,
        });
      }
    }

    // 3. Get referenced paths from books
    const { data: books } = await supabase
      .from('books')
      .select('storage_path, video_storage_path')
      .limit(2000);

    const usedPaths = new Set<string>();
    for (const b of books || []) {
      if (b.storage_path) usedPaths.add(b.storage_path);
      if (b.video_storage_path) usedPaths.add(b.video_storage_path);
    }

    // 4. Find orphaned files (files not in usedPaths)
    let orphanedCount = 0;
    const orphanedFolders: string[] = [];
    
    for (const folder of storageFolders) {
      if (folder.name === 'temp-videos') continue;
      
      // Check if any files in this folder are referenced
      const { data: files } = await supabase.storage
        .from('ObrazkiKsiazek')
        .list(folder.name, { limit: 1000 });
      
      let hasReferenced = false;
      let folderOrphaned = 0;
      
      for (const f of files || []) {
        if (f.name === '.emptyFolderPlaceholder') continue;
        const path = `${folder.name}/${f.name}`;
        if (usedPaths.has(path)) {
          hasReferenced = true;
        } else {
          folderOrphaned++;
        }
      }
      
      if (!hasReferenced && folderOrphaned > 0) {
        orphanedFolders.push(folder.name);
        orphanedCount += folderOrphaned;
      }
    }

    // 5. Count temp-videos
    const { data: tempFiles } = await supabase.storage
      .from('ObrazkiKsiazek')
      .list('temp-videos', { limit: 1000 });
    
    const tempVideoCount = (tempFiles || []).filter(f => f.name !== '.emptyFolderPlaceholder').length;

    // 6. Cron job status - we can't query cron.job directly from service role easily
    // Return what we know from configuration

    const result = {
      success: true,
      database: {
        note: 'Use Supabase Dashboard for exact DB size',
      },
      storage: {
        folders: storageFolders,
        totalFiles: storageFolders.reduce((sum, f) => sum + f.fileCount, 0),
        referencedPaths: usedPaths.size,
        orphanedFiles: orphanedCount,
        orphanedFolders,
        tempVideoFiles: tempVideoCount,
      },
      limits: {
        databaseMaxMB: 500,
        storageMaxMB: 1000,
        egressMaxGB: 5,
        edgeFunctionInvocationsMax: 500000,
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in admin-resource-monitor:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
