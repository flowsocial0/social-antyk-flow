import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Platform-specific configurations
const platformConfigs = {
  x: {
    name: 'X (Twitter)',
    maxChars: 280,
    linkLength: 23,
    style: 'krótki, dynamiczny tekst z hashtagami',
    requirements: [
      'Emocjonalny hook na początku',
      'Maksymalnie 280 znaków (uwzględniając link)',
      'Użyj emoji do zwiększenia engagement',
      'Dodaj 1-2 relevantne hashtagi',
      'Call-to-action (np. "Sprawdź teraz!", "Kup dziś!")'
    ]
  },
  facebook: {
    name: 'Facebook',
    maxChars: 2000,
    linkLength: 50,
    style: 'dłuższy, emocjonalny storytelling',
    requirements: [
      'Narracyjny, emocjonalny start',
      'Opowiedz historię lub przedstaw problem i rozwiązanie',
      'Możesz użyć dłuższego formatu (do 500 słów)',
      'Użyj emoji naturalnie w tekście',
      'Zachęć do komentarzy i udostępnień',
      'Silny call-to-action na końcu'
    ]
  },
  instagram: {
    name: 'Instagram',
    maxChars: 2200,
    linkLength: 0,
    style: 'wizualny, z dużą liczbą hashtagów',
    requirements: [
      'Skoncentruj się na wizualnym aspekcie',
      'Użyj wielu odpowiednich hashtagów (10-20)',
      'Krótki, chwytliwy tekst główny',
      'Emoji do strukturyzacji treści',
      'Zachęć do kliknięcia linku w bio',
      'Możesz dodać pytanie zwiększające engagement'
    ]
  },
  youtube: {
    name: 'YouTube',
    maxChars: 5000,
    linkLength: 100,
    style: 'informacyjny opis z timestampami',
    requirements: [
      'Rozpocznij od krótkiego podsumowania',
      'Dodaj link do produktu w pierwszych liniach',
      'Użyj timestampów jeśli to ma sens',
      'Dodaj relevantne hashtagi',
      'Zachęć do subskrypcji i dzwonka',
      'Możesz dodać dodatkowe linki i zasoby'
    ]
  },
  linkedin: {
    name: 'LinkedIn',
    maxChars: 3000,
    linkLength: 50,
    style: 'profesjonalny, biznesowy ton',
    requirements: [
      'Profesjonalny, biznesowy ton',
      'Podkreśl wartość edukacyjną lub biznesową',
      'Użyj konkretnych liczb i faktów',
      'Możesz użyć 3-5 hashtagów profesjonalnych',
      'Call-to-action nastawiony na rozwój zawodowy',
      'Zachęć do dyskusji w komentarzach'
    ]
  },
  tiktok: {
    name: 'TikTok',
    maxChars: 2200,
    linkLength: 0,
    style: 'casualowy, młodzieżowy język',
    requirements: [
      'Bardzo krótki, chwytliwy tekst',
      'Używaj młodzieżowego, casualowego języka',
      'Dużo emoji i trendowych hashtagów',
      'Zachęć do sprawdzenia linku w bio',
      'Możesz użyć formatowania z emoji jako bulletów',
      'Stwórz intrygę lub ciekawość'
    ]
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookData, platform = 'x', userId } = await req.json();
    const grokApiKey = Deno.env.get('GROK_API_KEY');

    if (!grokApiKey) {
      throw new Error('GROK_API_KEY not configured');
    }

    console.log(`Generating sales text for book: ${bookData.title} on platform: ${platform}`);

    // Get platform-specific config
    const platformConfig = platformConfigs[platform as keyof typeof platformConfigs] || platformConfigs.x;
    
    // For X platform, fetch user settings to calculate real character limits
    let userSettings: { ai_suffix_x?: string; default_website_url?: string } | null = null;
    
    if (platform === 'x' && userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data } = await supabaseClient
        .from('user_settings')
        .select('ai_suffix_x, default_website_url')
        .eq('user_id', userId)
        .maybeSingle();
      
      userSettings = data;
      console.log('Fetched user settings for X:', userSettings);
    }
    
    // Calculate available characters - dynamic for X based on real link and suffix lengths
    let availableChars: number;
    
    if (platform === 'x') {
      let reservedChars = 0;
      
      // Link - use real length (not t.co shortening, as API doesn't always shorten)
      const linkToUse = bookData.product_url || userSettings?.default_website_url || '';
      if (linkToUse) {
        reservedChars += linkToUse.length + 1; // +1 for \n before link
      }
      
      // User's AI suffix
      const aiSuffix = userSettings?.ai_suffix_x || '(ai)';
      if (aiSuffix) {
        reservedChars += aiSuffix.length + 2; // +2 for \n\n before suffix
      }
      
      // Safety buffer
      reservedChars += 5;
      
      availableChars = platformConfig.maxChars - reservedChars;
      console.log(`X platform: reservedChars=${reservedChars}, availableChars=${availableChars}, link="${linkToUse}", suffix="${aiSuffix}"`);
    } else {
      // For other platforms - original logic
      const linkLength = bookData.product_url ? platformConfig.linkLength : 0;
      const spacing = linkLength > 0 ? 4 : 0; // "\n\n" before link
      availableChars = platformConfig.maxChars - linkLength - spacing;
    }

    // Build platform-specific requirements
    const requirementsList = platformConfig.requirements
      .map((req, idx) => `${idx + 1}. ${req}`)
      .join('\n');

    // Determine if link will be added
    const hasLink = platform === 'x' 
      ? !!(bookData.product_url || userSettings?.default_website_url)
      : !!bookData.product_url;

    // Construct platform-specific prompt
    const prompt = `Stwórz ultra skuteczny tekst sprzedażowy dla platformy ${platformConfig.name} dla następującej książki:

Tytuł: ${bookData.title}
Kod produktu: ${bookData.code}
${bookData.sale_price ? `Cena promocyjna: ${bookData.sale_price} zł` : ''}
${bookData.description ? `Opis: ${bookData.description}` : ''}
${bookData.stock_status ? `Status: ${bookData.stock_status}` : ''}

PLATFORMA: ${platformConfig.name}
STYL: ${platformConfig.style}

WYMAGANIA:
${requirementsList}
- Tekst musi mieć MAKSYMALNIE ${availableChars} znaków${hasLink ? ' (link do sklepu zostanie dodany automatycznie na końcu)' : ''}
- Tekst w języku polskim
- Skupić się na unikalnej wartości oferty
- NIE dodawaj linku ani [link] - link zostanie dodany automatycznie${hasLink ? '' : ' lub będzie w bio'}
${platform === 'x' ? `- WAŻNE: Bądź bardzo zwięzły! Masz tylko ${availableChars} znaków na sam tekst, bo link i sufiks zostaną dodane automatycznie.` : ''}

Wygeneruj TYLKO tekst posta, bez żadnych dodatkowych komentarzy ani linków.`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content: `Jesteś ekspertem od copywritingu i sprzedaży książek na ${platformConfig.name}. Tworzysz przekonujące teksty sprzedażowe które generują wysoką konwersję. Doskonale rozumiesz specyfikę ${platformConfig.name} i potrafisz dostosować styl komunikacji do tej platformy. ZAWSZE pisz TYLKO po polsku. Nigdy nie używaj angielskiego.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Grok API error:', response.status, errorText);
      throw new Error(`Grok API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content.trim();

    console.log(`Generated sales text for ${platform}:`, generatedText);

    return new Response(
      JSON.stringify({ 
        salesText: generatedText,
        productUrl: bookData.product_url,
        platform: platform,
        charCount: generatedText.length,
        maxChars: availableChars
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in generate-sales-text function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
