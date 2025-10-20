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
    console.log('Starting XML books load from sklep.antyk.org.pl');
    
    // Fetch XML from external source
    const xmlResponse = await fetch('https://sklep.antyk.org.pl/eksport/HX/meta.xml');
    if (!xmlResponse.ok) {
      throw new Error(`Failed to fetch XML: ${xmlResponse.statusText}`);
    }
    
    const xmlText = await xmlResponse.text();
    console.log('XML fetched successfully, length:', xmlText.length);
    
    // Parse XML to extract book data
    const books: { title: string; product_url: string }[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemXml = match[1];
      
      const titleMatch = itemXml.match(/<g:title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/g:title>/s);
      const linkMatch = itemXml.match(/<g:link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/g:link>/s);
      
      if (titleMatch && linkMatch) {
        const title = titleMatch[1].trim();
        const product_url = linkMatch[1].trim();
        
        books.push({
          title,
          product_url,
        });
      }
    }
    
    console.log(`Parsed ${books.length} books from XML`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Clear existing data
    const { error: deleteError } = await supabase
      .from('xml_books')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
    
    if (deleteError) {
      console.error('Error clearing xml_books table:', deleteError);
      throw deleteError;
    }
    
    console.log('Cleared xml_books table');
    
    // Insert all books
    const { error: insertError } = await supabase
      .from('xml_books')
      .insert(books);
    
    if (insertError) {
      console.error('Error inserting books:', insertError);
      throw insertError;
    }
    
    console.log(`Successfully inserted ${books.length} books`);
    
    const result = {
      success: true,
      message: `Załadowano ${books.length} książek z XML`,
      stats: {
        booksLoaded: books.length,
      }
    };
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
    
  } catch (error) {
    console.error('Error in load-xml-books:', error);
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
