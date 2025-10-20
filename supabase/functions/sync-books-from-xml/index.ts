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
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];
      
      const codeMatch = itemXml.match(/<g:id>(.*?)<\/g:id>/);
      const titleMatch = itemXml.match(/<g:title>(?:<!--\[CDATA\[)?(.*?)(?:\]\]-->)?<\/g:title>/);
      const imageMatch = itemXml.match(/<g:image_link>(?:<!--\[CDATA\[)?(.*?)(?:\]\]-->)?<\/g:image_link>/);
      const availabilityMatch = itemXml.match(/<g:availability>(.*?)<\/g:availability>/);
      const priceMatch = itemXml.match(/<g:price>(.*?) PLN<\/g:price>/);
      
      if (codeMatch && titleMatch) {
        books.push({
          code: codeMatch[1],
          title: titleMatch[1],
          image_url: imageMatch ? imageMatch[1] : '',
          stock_status: availabilityMatch ? availabilityMatch[1] : 'unknown',
          sale_price: priceMatch ? parseFloat(priceMatch[1]) : 0,
        });
      }
    }
    
    console.log(`Parsed ${books.length} books from XML`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get all books from database
    const { data: dbBooks, error: fetchError } = await supabase
      .from('books')
      .select('id, code');
    
    if (fetchError) {
      console.error('Error fetching books:', fetchError);
      throw fetchError;
    }
    
    console.log(`Found ${dbBooks?.length || 0} books in database`);
    
    // Update each book with matching XML data
    let updatedCount = 0;
    let notFoundCount = 0;
    
    for (const dbBook of dbBooks || []) {
      const xmlBook = books.find(b => b.code === dbBook.code);
      
      if (xmlBook) {
        const { error: updateError } = await supabase
          .from('books')
          .update({
            title: xmlBook.title,
            image_url: xmlBook.image_url,
            stock_status: xmlBook.stock_status,
            sale_price: xmlBook.sale_price,
          })
          .eq('id', dbBook.id);
        
        if (updateError) {
          console.error(`Error updating book ${dbBook.code}:`, updateError);
        } else {
          updatedCount++;
          console.log(`Updated book: ${dbBook.code} - ${xmlBook.title}`);
        }
      } else {
        notFoundCount++;
        console.log(`Book not found in XML: ${dbBook.code}`);
      }
    }
    
    const result = {
      success: true,
      message: `Synchronizacja zakończona`,
      stats: {
        xmlBooksFound: books.length,
        dbBooksTotal: dbBooks?.length || 0,
        updated: updatedCount,
        notFoundInXml: notFoundCount,
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
