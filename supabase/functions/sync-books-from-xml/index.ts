import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookData {
  code: string;
  title: string;
  image_url: string;
  stock_status: string;
  sale_price: number;
  product_url: string;
  author: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting XML sync from sklep.antyk.org.pl');
    
    // Fetch XML from external source
    const xmlResponse = await fetch('https://sklep.antyk.org.pl/eksport/HX/meta.xml');
    if (!xmlResponse.ok) {
      throw new Error(`Failed to fetch XML: ${xmlResponse.statusText}`);
    }
    
    const xmlText = await xmlResponse.text();
    console.log('XML fetched successfully, length:', xmlText.length);
    
    // Parse XML to extract book data
    const books: BookData[] = [];
    const seenCodes = new Set<string>();
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];
      
      // Extract fields using regex - handle both CDATA and plain text
      const codeMatch = itemXml.match(/<g:id>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/g:id>/s);
      const titleMatch = itemXml.match(/<g:title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/g:title>/s);
      const imageMatch = itemXml.match(/<g:image_link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/g:image_link>/s);
      const linkMatch = itemXml.match(/<g:link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/g:link>/s);
      const availabilityMatch = itemXml.match(/<g:availability>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/g:availability>/s);
      const priceMatch = itemXml.match(/<g:price>(?:<!\[CDATA\[)?([\d.,]+)\s*PLN(?:\]\]>)?<\/g:price>/s);
      const brandMatch = itemXml.match(/<g:brand>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/g:brand>/s);
      
      if (codeMatch && titleMatch) {
        const code = codeMatch[1].trim();
        
        // Skip duplicates (keep last occurrence like CSV import)
        if (seenCodes.has(code)) {
          continue;
        }
        seenCodes.add(code);
        
        const title = titleMatch[1].trim();
        const priceStr = priceMatch ? priceMatch[1].replace(',', '.') : '0';
        const price = parseFloat(priceStr) || 0;
        
        // Map availability to stock_status
        let stockStatus = 'dostępny';
        if (availabilityMatch) {
          const availability = availabilityMatch[1].trim().toLowerCase();
          if (availability === 'out of stock' || availability === 'out_of_stock') {
            stockStatus = 'niewidoczny';
          } else if (availability === 'in stock' || availability === 'in_stock') {
            stockStatus = 'dostępny';
          }
        }
        
        books.push({
          code: code,
          title: title,
          image_url: imageMatch ? imageMatch[1].trim() : '',
          product_url: linkMatch ? linkMatch[1].trim() : '',
          stock_status: stockStatus,
          sale_price: price,
          author: brandMatch ? brandMatch[1].trim() : '',
        });
      }
    }
    
    console.log(`Parsed ${books.length} unique books from XML`);
    
    if (books.length === 0) {
      throw new Error('No books parsed from XML - file may be empty or format changed');
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get all existing books from database (paginated fetch)
    const allDbBooks: { id: string; code: string }[] = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data: batch, error: fetchError } = await supabase
        .from('books')
        .select('id, code')
        .range(offset, offset + batchSize - 1);
      
      if (fetchError) {
        console.error('Error fetching books:', fetchError);
        throw fetchError;
      }
      
      if (batch && batch.length > 0) {
        allDbBooks.push(...batch);
        offset += batchSize;
        hasMore = batch.length === batchSize;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`Found ${allDbBooks.length} existing books in database`);
    
    // Create a map of existing books by code
    const existingByCode = new Map<string, string>();
    for (const book of allDbBooks) {
      existingByCode.set(book.code, book.id);
    }
    
    // Create a set of XML codes for deletion check
    const xmlCodes = new Set(books.map(b => b.code));
    
    // Upsert books in batches
    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const upsertBatchSize = 100;
    
    for (let i = 0; i < books.length; i += upsertBatchSize) {
      const batch = books.slice(i, i + upsertBatchSize);
      
      const upsertData = batch.map(book => ({
        code: book.code,
        title: book.title,
        image_url: book.image_url,
        product_url: book.product_url,
        stock_status: book.stock_status,
        sale_price: book.sale_price,
        author: book.author || null,
        // Mark as frozen if stock_status is 'niewidoczny'
        exclude_from_campaigns: book.stock_status === 'niewidoczny',
      }));
      
      const { error: upsertError, data: upsertResult } = await supabase
        .from('books')
        .upsert(upsertData, { 
          onConflict: 'code',
          ignoreDuplicates: false 
        })
        .select('id');
      
      if (upsertError) {
        console.error(`Error upserting batch ${i}:`, upsertError);
        errorCount += batch.length;
      } else {
        // Count inserts vs updates
        for (const book of batch) {
          if (existingByCode.has(book.code)) {
            updatedCount++;
          } else {
            insertedCount++;
          }
        }
      }
      
      // Log progress every 500 books
      if ((i + upsertBatchSize) % 500 === 0 || i + upsertBatchSize >= books.length) {
        console.log(`Upserted ${Math.min(i + upsertBatchSize, books.length)}/${books.length} books`);
      }
    }
    
    // Delete books that are in database but not in XML
    const codesToDelete: string[] = [];
    for (const [code, id] of existingByCode) {
      if (!xmlCodes.has(code)) {
        codesToDelete.push(code);
      }
    }
    
    let deletedCount = 0;
    if (codesToDelete.length > 0) {
      console.log(`Deleting ${codesToDelete.length} books not in XML...`);
      
      // Delete in batches
      const deleteBatchSize = 100;
      for (let i = 0; i < codesToDelete.length; i += deleteBatchSize) {
        const batch = codesToDelete.slice(i, i + deleteBatchSize);
        
        const { error: deleteError, count } = await supabase
          .from('books')
          .delete()
          .in('code', batch);
        
        if (deleteError) {
          console.error(`Error deleting batch:`, deleteError);
        } else {
          deletedCount += batch.length;
        }
      }
      
      console.log(`Deleted ${deletedCount} books`);
    }
    
    const result = {
      success: true,
      message: `Synchronizacja zakończona`,
      stats: {
        xmlBooksFound: books.length,
        inserted: insertedCount,
        updated: updatedCount,
        deleted: deletedCount,
        errors: errorCount,
      }
    };
    
    console.log('Sync completed:', result);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
    
  } catch (error) {
    console.error('Error in sync-books-from-xml:', error);
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
