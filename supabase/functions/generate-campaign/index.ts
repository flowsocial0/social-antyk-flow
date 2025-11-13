import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const GROK_API_KEY = Deno.env.get('GROK_API_KEY');
    if (!GROK_API_KEY) {
      throw new Error('GROK_API_KEY is not configured');
    }

    // Handle different actions
    if (action === 'generate_structure') {
      return await generateCampaignStructure(body, GROK_API_KEY);
    } else if (action === 'generate_posts') {
      return await generatePostsContent(body, GROK_API_KEY);
    } else {
      // Legacy action for simple campaign dialog
      return await generateSimpleCampaign(body, GROK_API_KEY);
    }
  } catch (error) {
    console.error('Error in generate-campaign function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

async function generateCampaignStructure(body: any, apiKey: string) {
  const { totalPosts, contentPosts, salesPosts, durationDays, postsPerDay } = body;
  
  console.log("Generating campaign structure:", { totalPosts, contentPosts, salesPosts });

  const systemPrompt = `Jesteś ekspertem od strategii content marketingu dla księgarni patriotycznej. 
Twoim zadaniem jest stworzyć optymalny plan kampanii zgodnie z zasadą 80/20 (80% wartościowy content patriotyczny, 20% sprzedaż książek).

Zasady:
- Równomierne rozłożenie postów sprzedażowych w czasie (nie grupuj ich razem)
- Różnorodność kategorii contentowych patriotycznych (ciekawostki historyczne, zagadki, rocznice)
- Strategiczne umieszczenie postów sprzedażowych (np. po ciekawych contentach)
- Balansowanie typów postów dzień po dniu`;

  const userPrompt = `Stwórz strukturę kampanii na ${durationDays} dni, ${postsPerDay} posty dziennie (łącznie ${totalPosts} postów).

Rozkład:
- ${contentPosts} postów contentowych (80%)
- ${salesPosts} postów sprzedażowych (20%)

Dla postów contentowych użyj tych kategorii patriotycznych:
- "trivia" (ciekawostki o polskich bohaterach, historii, literaturze patriotycznej)
- "quiz" (zagadki o polskiej historii, symbolach narodowych)
- "event" (polskie rocznice, święta narodowe, ważne wydarzenia historyczne)

Dla postów sprzedażowych użyj kategorii:
- "sales" (promocje książek)

Zwróć TYLKO tablicę JSON z ${totalPosts} obiektami, każdy w formacie:
{
  "position": numer_posta_1_do_${totalPosts},
  "type": "content" lub "sales",
  "category": odpowiednia_kategoria
}

Przykład: [{"position":1,"type":"content","category":"trivia"},{"position":2,"type":"content","category":"quiz"}]`;

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-4-fast-reasoning',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 3000
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Grok API error:", response.status, errorText);
    throw new Error(`Grok API error: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content.trim();
  
  // Clean up response
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  let structure;
  try {
    structure = JSON.parse(content);
  } catch (e) {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      structure = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Could not parse structure from Grok response");
    }
  }

  console.log(`Generated structure with ${structure.length} posts`);

  return new Response(
    JSON.stringify({ success: true, structure }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function generatePostsContent(body: any, apiKey: string) {
  const { structure } = body;
  
  console.log("Generating content for posts:", structure.length);

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get available books for sales posts
  const salesPostsCount = structure.filter((item: any) => item.type === 'sales').length;
  const { data: availableBooks, error: booksError } = await supabase
    .from('books')
    .select('id, title, description, sale_price, product_url, campaign_post_count')
    .eq('is_product', true)
    .order('campaign_post_count', { ascending: true })
    .order('last_campaign_date', { ascending: true, nullsFirst: true })
    .limit(salesPostsCount);

  if (booksError) {
    console.error("Error fetching books:", booksError);
    throw new Error("Failed to fetch books for campaign");
  }

  console.log(`Found ${availableBooks?.length || 0} available books for ${salesPostsCount} sales posts`);

  const categoryPrompts: Record<string, string> = {
    'trivia': 'Stwórz fascynującą ciekawostkę o polskiej historii, literaturze patriotycznej lub bohaterach narodowych. Powinna być krótka (max 240 znaków), inspirująca i budująca dumę narodową. Zakończ linkiem: https://sklep.antyk.org.pl',
    'quiz': 'Stwórz intrygującą zagadkę o polskiej historii, symbolach narodowych lub ważnych wydarzeniach. Zachęć do interakcji (max 240 znaków). Zakończ linkiem: https://sklep.antyk.org.pl',
    'event': 'Napisz o polskiej rocznicy, święcie narodowym lub ważnym wydarzeniu historycznym (max 240 znaków). Podkreśl znaczenie dla polskiej tożsamości. Zakończ linkiem: https://sklep.antyk.org.pl',
    'sales': 'Promocja konkretnej książki - szczegóły zostaną dodane dynamicznie'
  };

  const posts = [];
  let salesBookIndex = 0;
  
  // Generate posts in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < structure.length; i += batchSize) {
    const batch = structure.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (item: any) => {
      let prompt = categoryPrompts[item.category] || categoryPrompts['trivia'];
      let bookData = null;
      
      // For sales posts, use actual book data
      if (item.category === 'sales' && availableBooks && salesBookIndex < availableBooks.length) {
        bookData = availableBooks[salesBookIndex];
        salesBookIndex++;
        
        prompt = `Stwórz atrakcyjny post promocyjny o tej książce patriotycznej:
Tytuł: ${bookData.title}
${bookData.description ? `Opis: ${bookData.description}` : ''}
${bookData.sale_price ? `Cena: ${bookData.sale_price} zł` : ''}

Post powinien:
- Być krótki (max 240 znaków ŁĄCZNIE z linkiem)
- Podkreślać wartości patriotyczne
- Zachęcać do zakupu
- Kończyć się linkiem: ${bookData.product_url}`;
      }
      
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-4-fast-reasoning',
          messages: [
            { 
              role: 'system', 
              content: 'Jesteś ekspertem od content marketingu dla księgarni. Piszesz krótkie, angażujące posty na Twitter/X.' 
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 300
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate post: ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices[0].message.content.trim();
      
      return {
        position: item.position,
        type: item.type,
        category: item.category,
        text: text,
        bookId: bookData?.id || null
      };
    });

    const batchResults = await Promise.all(batchPromises);
    posts.push(...batchResults);
    
    // Small delay between batches
    if (i + batchSize < structure.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`Generated content for ${posts.length} posts`);

  return new Response(
    JSON.stringify({ success: true, posts }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function generateSimpleCampaign(body: any, apiKey: string) {
  const { campaignType, bookData, numberOfPosts } = body;
  
  console.log("Generating simple campaign:", { campaignType, numberOfPosts });

  const systemPrompts: Record<string, string> = {
    'trivia': `Jesteś ekspertem od książek i literatury. Twórz fascynujące ciekawostki literackie, które są:
- Krótkie (max 250 znaków z URL-em)
- Interesujące i angażujące
- Związane z książkami, autorami lub literaturą
- Napisane w przystępny, przyjazny sposób
- Zakończone zaproszeniem do odwiedzenia sklepu`,
    
    'quiz': `Jesteś kreatorem quizów literackich. Twórz angażujące zagadki i pytania:
- Pytanie jest intrygujące i ma tło (nie tylko "zgadnij autora")
- Długość max 250 znaków z URL-em
- Zachęcaj do interakcji (np. "Odpowiedź w komentarzach!")
- Pytania powinny być ciekawe dla miłośników książek
- Dodaj link do sklepu na końcu`,
    
    'recommendation': `Jesteś pasjonatem książek polecającym lektury. Twórz rekomendacje które:
- Opisują książkę w intrygujący sposób
- Wyjaśniają dla kogo jest ta książka
- Max 250 znaków z URL-em
- Używają emocjonalnego języka
- Zachęcają do zakupu`,
    
    'event': `Tworzysz posty o wydarzeniach literackich. Posty powinny:
- Informować o wydarzeniach, rocznicach, świętach literackich
- Być aktualne i sezonowe
- Max 250 znaków z URL-em
- Łączyć wydarzenie z ofertą księgarni
- Zachęcać do odwiedzin`
  };

  const userPrompt = bookData 
    ? `Stwórz ${numberOfPosts} różnych postów typu "${campaignType}" o książce:
Tytuł: ${bookData.title}
Opis: ${bookData.description || 'Brak opisu'}
Cena: ${bookData.sale_price || bookData.promotional_price} zł
URL: ${bookData.product_url}

Każdy post powinien:
- Być unikalny i oryginalny
- Zawierać odpowiednie emoji
- Kończyć się linkiem do produktu
- Nie przekraczać 250 znaków ŁĄCZNIE z linkiem

Zwróć TYLKO tablicę JSON z postami w formacie:
[
  {
    "text": "treść posta z emoji i linkiem",
    "type": "${campaignType}"
  }
]`
    : `Stwórz ${numberOfPosts} różnych postów typu "${campaignType}" o ogólnej tematyce książek i księgarni Antyk (https://sklep.antyk.org.pl).

Każdy post powinien:
- Być unikalny i oryginalny
- Zawierać odpowiednie emoji
- Kończyć się linkiem do sklepu głównego
- Nie przekraczać 250 znaków ŁĄCZNIE z linkiem
- Promować różne aspekty księgarni

Zwróć TYLKO tablicę JSON z postami w formacie:
[
  {
    "text": "treść posta z emoji i linkiem",
    "type": "${campaignType}"
  }
]`;

  const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-4-fast-reasoning',
      messages: [
        {
          role: 'system',
          content: systemPrompts[campaignType] || systemPrompts['trivia']
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.8,
      max_tokens: 2000
    }),
  });

  if (!grokResponse.ok) {
    const errorText = await grokResponse.text();
    console.error("Grok API error:", grokResponse.status, errorText);
    throw new Error(`Grok API error: ${grokResponse.status}`);
  }

  const grokData = await grokResponse.json();
  let content = grokData.choices[0].message.content;
  
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  let posts;
  try {
    posts = JSON.parse(content);
  } catch (e) {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      posts = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Could not extract valid JSON from Grok response");
    }
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      posts,
      count: posts.length 
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}