import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Book {
  id: string;
  title: string;
  image_url: string | null;
  storage_path: string | null;
}

// Process only 20 books per invocation to avoid compute limits
const BATCH_SIZE = 20;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting migration of book images to storage...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch only a batch of books that need migration
    const { data: books, error: fetchError, count } = await supabase
      .from('books')
      .select('id, title, image_url, storage_path', { count: 'exact' })
      .not('image_url', 'is', null)
      .is('storage_path', null)
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Error fetching books:', fetchError);
      throw fetchError;
    }

    const totalRemaining = count || 0;
    console.log(`Found ${totalRemaining} books total to migrate, processing ${books?.length || 0} in this batch`);

    if (!books || books.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Brak książek do migracji',
          stats: { total: 0, succeeded: 0, failed: 0, remaining: 0 }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const results = {
      total: books.length,
      succeeded: 0,
      failed: 0,
      remaining: totalRemaining - books.length,
      errors: [] as string[],
    };

    // Process each book in this batch
    for (const book of books as Book[]) {
      try {
        console.log(`Processing book: ${book.title} (${book.id})`);
        
        if (!book.image_url) {
          console.log('No image_url, skipping...');
          // Mark as processed (set storage_path to empty string to skip next time)
          await supabase.from('books').update({ storage_path: '' }).eq('id', book.id);
          results.failed++;
          results.errors.push(`${book.title}: Brak URL obrazka`);
          continue;
        }

        // Download the image with timeout
        console.log(`Downloading image from: ${book.image_url}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        let imageResponse;
        try {
          imageResponse = await fetch(book.image_url, { signal: controller.signal });
          clearTimeout(timeoutId);
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          // Mark as processed to skip next time
          await supabase.from('books').update({ storage_path: '' }).eq('id', book.id);
          results.failed++;
          results.errors.push(`${book.title}: Błąd pobierania obrazka`);
          continue;
        }
        
        if (!imageResponse.ok) {
          // Mark as processed to skip next time (404 or other error)
          await supabase.from('books').update({ storage_path: '' }).eq('id', book.id);
          results.failed++;
          results.errors.push(`${book.title}: Obrazek niedostępny (${imageResponse.status})`);
          continue;
        }

        const imageBlob = await imageResponse.blob();
        const imageBuffer = await imageBlob.arrayBuffer();
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
        
        console.log(`Downloaded image: ${imageBuffer.byteLength} bytes, type: ${contentType}`);

        // Generate filename from book ID
        const urlParts = book.image_url.split('/');
        const originalFilename = urlParts[urlParts.length - 1];
        const extension = originalFilename.split('.').pop() || 'jpg';
        const filename = `${book.id}.${extension}`;
        const storagePath = `books/${filename}`;

        // Upload to storage
        console.log(`Uploading to storage: ${storagePath}`);
        const { error: uploadError } = await supabase.storage
          .from('ObrazkiKsiazek')
          .upload(storagePath, imageBuffer, {
            contentType: contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for ${book.title}:`, uploadError);
          // Mark as processed to skip next time
          await supabase.from('books').update({ storage_path: '' }).eq('id', book.id);
          results.failed++;
          results.errors.push(`${book.title}: Błąd uploadu`);
          continue;
        }

        console.log(`Successfully uploaded to storage: ${storagePath}`);

        // Update book record with storage_path
        const { error: updateError } = await supabase
          .from('books')
          .update({ storage_path: storagePath })
          .eq('id', book.id);

        if (updateError) {
          console.error(`Update error for ${book.title}:`, updateError);
          results.failed++;
          results.errors.push(`${book.title}: Błąd aktualizacji bazy`);
          continue;
        }

        console.log(`Successfully updated book record with storage_path`);
        results.succeeded++;

      } catch (error) {
        console.error(`Error processing book ${book.title}:`, error);
        // Mark as processed to skip next time
        await supabase.from('books').update({ storage_path: '' }).eq('id', book.id);
        results.failed++;
        results.errors.push(
          `${book.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    console.log('Batch migration completed:', results);

    const hasMore = results.remaining > 0;
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Przetworzono ${results.succeeded} z ${results.total} książek${hasMore ? `. Pozostało: ${results.remaining}` : ''}`,
        stats: results,
        hasMore: hasMore,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in migrate-images-to-storage:', error);
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