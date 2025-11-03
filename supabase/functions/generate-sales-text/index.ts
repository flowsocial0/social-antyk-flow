import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookData } = await req.json();
    const grokApiKey = Deno.env.get('GROK_API_KEY');

    if (!grokApiKey) {
      throw new Error('GROK_API_KEY not configured');
    }

    console.log('Generating sales text for book:', bookData.title);

    // Construct a detailed prompt for Grok
    const prompt = `Stwórz ultra skuteczny tekst sprzedażowy dla następującej książki:

Tytuł: ${bookData.title}
Kod produktu: ${bookData.code}
${bookData.sale_price ? `Cena promocyjna: ${bookData.sale_price} zł` : ''}
${bookData.description ? `Opis: ${bookData.description}` : ''}
${bookData.stock_status ? `Status: ${bookData.stock_status}` : ''}

WYMAGANIA:
- Tekst musi być krótki i zwięzły (maksymalnie 280 znaków, bo to będzie post na X/Twitter)
- Musi zawierać emocjonalny hook na początku
- Podkreślić wartość i korzyści
- Dodać call-to-action
- Użyć emoji do zwiększenia engagement
- Tekst w języku polskim
- Skupić się na unikalnej wartości oferty

Wygeneruj TYLKO tekst posta, bez żadnych dodatkowych komentarzy.`;

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
            content: 'Jesteś ekspertem od copywritingu i sprzedaży książek. Tworzysz przekonujące, krótkie teksty sprzedażowe które generują wysoką konwersję.'
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

    console.log('Generated sales text:', generatedText);

    return new Response(
      JSON.stringify({ salesText: generatedText }),
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
