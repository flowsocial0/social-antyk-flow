import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function safeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "";
  return s;
}

function sanitizeGeneratedText(text: string, bookData?: any): string {
  let out = safeText(text);

  // Replace common placeholders with real values (or empty strings)
  const url = safeText(bookData?.product_url) || "https://sklep.antyk.org.pl";
  const title = safeText(bookData?.title);
  const author = safeText(bookData?.author);
  const priceNumber = bookData?.sale_price ?? bookData?.promotional_price;
  const price = priceNumber !== null && priceNumber !== undefined && priceNumber !== ""
    ? `${safeText(priceNumber)} zł`
    : "";

  out = out
    .replace(/\[link do księgarni\]/gi, "https://sklep.antyk.org.pl")
    .replace(/\[link\]/gi, url)
    .replace(/\[Tytuł książki\]/gi, title)
    .replace(/\[Autor\]/gi, author)
    .replace(/\[cena\]/gi, price);

  // Remove literal null/undefined words that often leak from missing fields
  out = out
    .replace(/\bnull\b/gi, "")
    .replace(/\bundefined\b/gi, "");

  // Remove any remaining bracket placeholders
  out = out.replace(/\[[^\]]+\]/g, "");

  // Final whitespace cleanup
  out = out.replace(/\s{2,}/g, " ").trim();

  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const GROK_API_KEY = Deno.env.get("GROK_API_KEY");
    if (!GROK_API_KEY) {
      throw new Error("GROK_API_KEY is not configured");
    }

    // Handle different actions
    if (action === "generate_structure") {
      return await generateCampaignStructure(body, GROK_API_KEY);
    } else if (action === "generate_posts") {
      return await generatePostsContent(body, GROK_API_KEY);
    } else {
      // Legacy action for simple campaign dialog
      return await generateSimpleCampaign(body, GROK_API_KEY);
    }
  } catch (error) {
    console.error("Error in generate-campaign function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = error instanceof Error ? error.toString() : String(error);

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function generateCampaignStructure(body: any, apiKey: string) {
  let { totalPosts, contentPosts, salesPosts, durationDays, postsPerDay } = body;

  // WAŻNE: Jeśli jest tylko 1 post, musi być sprzedażowy
  if (totalPosts === 1) {
    salesPosts = 1;
    contentPosts = 0;
    console.log("Single post campaign - forcing sales post");
  }

  console.log("Generating campaign structure:", { totalPosts, contentPosts, salesPosts });

  const systemPrompt = `Jesteś ekspertem od strategii content marketingu dla księgarni patriotycznej. 
Twoim zadaniem jest stworzyć optymalny plan kampanii z przewagą postów sprzedażowych (80% sprzedaż, 20% content).

Zasady:
- Równomierne rozłożenie postów contentowych w czasie (nie grupuj ich razem)
- Posty contentowe (ciekawostki) zawsze PRZED lub PO poście sprzedażowym, do którego nawiązują
- Strategiczne umieszczenie ciekawostek jako wprowadzenie lub follow-up do sprzedaży
- Balansowanie typów postów dzień po dniu`;

  const userPrompt = `Stwórz strukturę kampanii na ${durationDays} dni, ${postsPerDay} posty dziennie (łącznie ${totalPosts} postów).

Rozkład:
- ${salesPosts} postów sprzedażowych (80%)
- ${contentPosts} postów contentowych (20%)

WAŻNE: Posty contentowe to TYLKO ciekawostki (trivia), które będą nawiązywać do książek z sąsiednich postów sprzedażowych.

Dla postów contentowych użyj kategorii:
- "trivia" (ciekawostki nawiązujące do tematyki książek)

Dla postów sprzedażowych użyj kategorii:
- "sales" (promocje książek)

Umieszczaj posty "trivia" strategicznie - przed lub po poście "sales", żeby wprowadzały kontekst lub podsumowywały temat.

Zwróć TYLKO tablicę JSON z ${totalPosts} obiektami, każdy w formacie:
{
  "position": numer_posta_1_do_${totalPosts},
  "type": "content" lub "sales",
  "category": odpowiednia_kategoria
}

Przykład: [{"position":1,"type":"sales","category":"sales"},{"position":2,"type":"content","category":"trivia"},{"position":3,"type":"sales","category":"sales"}]`;

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4-fast-reasoning",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Grok API error:", response.status, errorText);
    
    // Handle specific error codes with user-friendly messages
    if (response.status === 429) {
      return new Response(
        JSON.stringify({
          success: false,
          errorCode: "RATE_LIMIT",
          error: "Przekroczono limit API Grok. Konto wyczerpało kredyty lub osiągnęło limit zapytań. Spróbuj ponownie później lub doładuj kredyty w panelu x.ai.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    if (response.status === 401 || response.status === 403) {
      return new Response(
        JSON.stringify({
          success: false,
          errorCode: "AUTH_ERROR",
          error: "Nieprawidłowy lub wygasły klucz API Grok. Sprawdź konfigurację klucza w ustawieniach.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    throw new Error(`Grok API error: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content.trim();

  // Clean up response
  content = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

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

  return new Response(JSON.stringify({ success: true, structure }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generatePostsContent(body: any, apiKey: string) {
  const { structure, targetPlatforms, selectedBooks } = body;

  console.log("Generating content for posts:", structure.length);
  console.log("Target platforms:", targetPlatforms);
  console.log("Selected books:", selectedBooks?.length || 0);
  
  // Check if Facebook is in target platforms
  const hasFacebook = targetPlatforms && targetPlatforms.some((p: any) => p.id === 'facebook' || p === 'facebook');
  const hasX = targetPlatforms && targetPlatforms.some((p: any) => p.id === 'x' || p === 'x');
  
  // Determine text limits based on platforms
  const maxTextLength = hasFacebook && !hasX ? 1800 : (hasFacebook && hasX ? 240 : 240);

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get available books for sales posts - filter by selectedBooks if provided
  const salesPostsCount = structure.filter((item: any) => item.type === "sales").length;
  
  let availableBooks: any[] = [];
  
  // CRITICAL: Only use selected books - no fallback to random books
  if (!selectedBooks || selectedBooks.length === 0) {
    console.error("No books selected for campaign");
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: "NO_BOOKS",
        error: "Nie wybrano żadnych książek do kampanii. Proszę wybrać co najmniej jedną książkę.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log(`Fetching ${selectedBooks.length} selected books...`);
  
  // Fetch selected books in batches
  const fetchBatchSize = 100;
  const allFetchedBooks: any[] = [];
  
  for (let i = 0; i < selectedBooks.length; i += fetchBatchSize) {
    const batch = selectedBooks.slice(i, i + fetchBatchSize);
    const { data: batchBooks, error: batchError } = await supabase
      .from("books")
      .select("id, title, description, sale_price, product_url, campaign_post_count, author")
      .in("id", batch);
    
    if (batchError) {
      console.error(`Error fetching books batch ${i / fetchBatchSize}:`, batchError);
      continue;
    }
    
    if (batchBooks) {
      allFetchedBooks.push(...batchBooks);
    }
  }

  if (allFetchedBooks.length === 0) {
    console.error("No books found in database for selected IDs");
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: "BOOKS_NOT_FOUND",
        error: "Wybrane książki nie zostały znalezione w bazie danych.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Sort by price DESC - if more books than sales posts, use most expensive ones
  availableBooks = allFetchedBooks.sort((a, b) => {
    if (a.sale_price !== b.sale_price) {
      if (a.sale_price === null) return 1;
      if (b.sale_price === null) return -1;
      return b.sale_price - a.sale_price;
    }
    return 0;
  });

  // Keep all books available for content generation
  const allBooksForContent = [...availableBooks];
  
  // For sales posts, limit to most expensive if more books than sales posts
  let booksForSales = [...availableBooks];
  if (salesPostsCount > 0 && booksForSales.length > salesPostsCount) {
    console.log(`More books (${booksForSales.length}) than sales posts (${salesPostsCount}), using ${salesPostsCount} most expensive for sales`);
    booksForSales = booksForSales.slice(0, salesPostsCount);
  } else if (salesPostsCount === 0) {
    console.log(`No sales posts - all ${availableBooks.length} books available for trivia content`);
    booksForSales = [];
  }

  console.log(`Using ${booksForSales.length} books for ${salesPostsCount} sales posts`);
  console.log("Books for sales:", booksForSales.map(b => b.title).join(", ") || "(none)");

  // Build book context from ALL selected books for trivia posts
  const booksContext = allBooksForContent
    .map((book: any) => `- "${book.title}"${book.author ? ` autorstwa ${book.author}` : ""}: ${book.description || 'Brak opisu'}`)
    .join('\n');

  console.log(`Built context from ${allBooksForContent.length} selected books for trivia generation`);

  // Fetch content history for deduplication (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const platformIds = targetPlatforms.map((p: any) => p.id || p);
  const contentHistory: Record<string, Array<{ category: string; topic_summary: string }>> = {};
  
  for (const platformId of platformIds) {
    const { data: history, error: historyError } = await supabase
      .from('campaign_content_history')
      .select('category, topic_summary')
      .eq('platform', platformId)
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('created_at', { ascending: false });

    if (historyError) {
      console.error(`Error fetching content history for ${platformId}:`, historyError);
      contentHistory[platformId] = [];
    } else {
      contentHistory[platformId] = history || [];
      console.log(`Found ${history?.length || 0} previous topics for ${platformId}`);
    }
  }

  // Platform-specific prompts - updated to reference ONLY selected books
  const getFacebookPrompts = (booksList: string): Record<string, string> => ({
    trivia: `Stwórz ciekawostkę powiązaną z tematyką JEDNEJ z tych książek/produktów:
${booksList}

Post może mieć do ${maxTextLength} znaków. Powinien:
- Opowiadać o temacie, okresie historycznym, postaci lub wydarzeniu związanym z jedną z powyższych książek
- NIE wspominać bezpośrednio tytułu książki - to ma być ciekawostka, która wzbudzi zainteresowanie tematem
- Być fascynujący i angażujący
- Kończyć się linkiem: https://sklep.antyk.org.pl

WAŻNE: 
- NIE używaj placeholderów w nawiasach kwadratowych typu [link], [tytuł] itp.
- NIE dodawaj informacji o liczbie znaków do treści posta.
- Pisz KONKRETNE fakty, nie ogólniki.`,
    sales: "Promocja konkretnej książki - szczegóły zostaną dodane dynamicznie",
  });

  const getXPrompts = (booksList: string): Record<string, string> => ({
    trivia: `Stwórz krótką ciekawostkę (max 240 znaków) powiązaną z tematyką JEDNEJ z tych książek/produktów:
${booksList}

Ciekawostka powinna:
- Dotyczyć tematu, okresu historycznego lub postaci związanej z jedną z powyższych książek
- NIE wspominać bezpośrednio tytułu - ma wzbudzić zainteresowanie tematem
- Kończyć się linkiem: https://sklep.antyk.org.pl

WAŻNE: NIE używaj placeholderów w nawiasach kwadratowych. NIE dodawaj informacji o liczbie znaków.`,
    sales: "Promocja konkretnej książki - szczegóły zostaną dodane dynamicznie",
  });

  const categoryPrompts: Record<string, string> = hasFacebook && !hasX 
    ? getFacebookPrompts(booksContext) 
    : getXPrompts(booksContext);

  const posts = [];
  let salesBookIndex = 0;
  
  // Build a map of position -> book for sales posts WITH ROTATION
  const positionToBookMap: Record<number, any> = {};
  let tempSalesIndex = 0;
  
  structure.forEach((item: any) => {
    if (item.type === 'sales' && booksForSales.length > 0) {
      // ROTATION: use modulo to cycle through books when we have fewer books than sales posts
      positionToBookMap[item.position] = booksForSales[tempSalesIndex % booksForSales.length];
      tempSalesIndex++;
    }
  });

  if (Object.keys(positionToBookMap).length > 0) {
    console.log("Sales post book assignments:", Object.entries(positionToBookMap).map(([pos, book]) => `Position ${pos}: ${book.title}`).join(", "));
  } else {
    console.log("No sales posts - no book assignments for sales");
  }

  // Generate posts in batches of 5 to avoid rate limits
  const batchSize = 5;
  
  try {
    for (let i = 0; i < structure.length; i += batchSize) {
      const batch = structure.slice(i, i + batchSize);

      const batchPromises = batch.map(async (item: any) => {
        let prompt = categoryPrompts[item.category] || categoryPrompts["trivia"];
        let bookData = null;

        // For sales posts, use book with rotation
        if (item.category === "sales") {
          // ROTATION: use modulo to cycle through books
          bookData = booksForSales[salesBookIndex % booksForSales.length];
          salesBookIndex++;
          
          // Fallback URL in case product_url is null
          const bookUrl = bookData.product_url || "https://sklep.antyk.org.pl";

          if (hasFacebook && !hasX) {
            // Rich Facebook post for sales
            prompt = `Stwórz bogaty w treść post promocyjny o tym produkcie:
Tytuł: ${bookData.title}
${bookData.author ? `Autor: ${bookData.author}` : ""}
${bookData.description ? `Opis: ${bookData.description}` : ""}
${bookData.sale_price ? `Cena: ${bookData.sale_price} zł` : ""}
Link do produktu: ${bookUrl}

Post może mieć do ${maxTextLength} znaków. Powinien:
- Przedstawić produkt w atrakcyjny sposób
- Podkreślić wartości patriotyczne (jeśli dotyczy)
- Zachęcić do zakupu
- Kończyć się DOKŁADNIE tym linkiem: ${bookUrl}

KRYTYCZNE ZASADY:
- Używaj TYLKO podanych powyżej danych (tytuł, autor, opis, cena, link)
- NIE wymyślaj żadnych informacji, których nie podano
- NIE używaj placeholderów w nawiasach kwadratowych typu [link], [autor], [tytuł] itp.
- Jeśli nie ma opisu - skup się na tytule i tematyce
- NIE dodawaj informacji o liczbie znaków do treści posta`;
          } else {
            // Short post for X or mixed platforms
            prompt = `Stwórz krótki post promocyjny (max 240 znaków ŁĄCZNIE z linkiem) o tym produkcie:
Tytuł: ${bookData.title}
${bookData.author ? `Autor: ${bookData.author}` : ""}
${bookData.sale_price ? `Cena: ${bookData.sale_price} zł` : ""}
Link: ${bookUrl}

KRYTYCZNE ZASADY:
- Używaj TYLKO podanych powyżej danych
- NIE wymyślaj informacji, których nie podano
- NIE używaj placeholderów w nawiasach kwadratowych
- Kończyć się DOKŁADNIE tym linkiem: ${bookUrl}
- NIE dodawaj informacji o liczbie znaków`;
          }
        } else if (item.type === 'content' && item.category === 'trivia') {
          // For trivia, find the nearest sales post's book to create related content
          let nearestBook = null;
          let minDistance = Infinity;
          
          for (const [pos, book] of Object.entries(positionToBookMap)) {
            const distance = Math.abs(Number(pos) - item.position);
            if (distance < minDistance) {
              minDistance = distance;
              nearestBook = book;
            }
          }
          
          // Fallback: if no sales posts, use random book from all selected books
          if (!nearestBook && allBooksForContent.length > 0) {
            nearestBook = allBooksForContent[Math.floor(Math.random() * allBooksForContent.length)];
          }
          
          // If we found a book, create trivia specifically about its topic
          if (nearestBook) {
            const bookUrl = nearestBook.product_url || "https://sklep.antyk.org.pl";
            const triviaContext = `Stwórz ciekawostkę BEZPOŚREDNIO związaną z tematyką tego produktu:
Tytuł: ${nearestBook.title}
${nearestBook.author ? `Autor: ${nearestBook.author}` : ""}
${nearestBook.description ? `Opis: ${nearestBook.description}` : ""}

WAŻNE:
- NIE wspominaj bezpośrednio tytułu produktu ani autora
- Stwórz ciekawostkę o temacie/okresie/postaci, o których traktuje ten produkt
- Ciekawostka ma wzbudzić zainteresowanie tematem, żeby czytelnik chciał poznać więcej
- Musi być samodzielna i wartościowa, nie tylko "wstępem" do sprzedaży
- NIE używaj placeholderów w nawiasach kwadratowych
- Zakończ DOKŁADNIE tym linkiem: ${bookUrl}

`;
            prompt = triviaContext + (hasFacebook && !hasX 
              ? `Post może mieć do ${maxTextLength} znaków. NIE dodawaj informacji o liczbie znaków do treści.`
              : `Max 240 znaków ŁĄCZNIE z linkiem. NIE dodawaj informacji o liczbie znaków do treści.`);
          } else {
            // Ultimate fallback: generic bookstore trivia
            console.log("No books available for trivia - using generic prompt");
            prompt = `Stwórz krótką ciekawostkę o książkach, literaturze lub historii Polski.
- NIE używaj placeholderów w nawiasach kwadratowych
- Zakończ linkiem: https://sklep.antyk.org.pl

` + (hasFacebook && !hasX 
              ? `Post może mieć do ${maxTextLength} znaków.`
              : `Max 240 znaków ŁĄCZNIE z linkiem.`);
          }

          // Add deduplication instruction for content posts
          let deduplicationNote = '\n\n';
          
          for (const platformId of platformIds) {
            const history = contentHistory[platformId] || [];
            if (history.length > 0) {
              const categoryHistory = history.filter(h => h.category === item.category);
              if (categoryHistory.length > 0) {
                const topics = categoryHistory.map(h => h.topic_summary).join('\n- ');
                deduplicationNote += `UNIKAJ tych tematów, które były już użyte na ${platformId}:\n- ${topics}\n\n`;
              }
            }
          }
          
          if (deduplicationNote.trim()) {
            prompt += deduplicationNote + 'Wygeneruj NOWY, UNIKALNY temat.';
          }
        }

        const response = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "grok-4-fast-reasoning",
            messages: [
              {
                role: "system",
                content: hasFacebook && !hasX
                  ? `Jesteś ekspertem od content marketingu dla księgarni patriotycznej. Piszesz bogate w treść, angażujące posty na Facebook.

BEZWZGLĘDNE ZASADY:
1. NIGDY nie używaj placeholderów w nawiasach kwadratowych typu [link], [tytuł], [autor], [cena] itp.
2. Używaj TYLKO konkretnych danych, które zostały Ci podane.
3. Jeśli czegoś nie wiesz - pomiń to, NIE wymyślaj.
4. Każdy post musi być kompletny i gotowy do publikacji bez żadnych edycji.`
                  : `Jesteś ekspertem od content marketingu dla księgarni patriotycznej. Piszesz krótkie, angażujące posty na Twitter/X (max 240 znaków).

BEZWZGLĘDNE ZASADY:
1. NIGDY nie używaj placeholderów w nawiasach kwadratowych typu [link], [tytuł], [autor] itp.
2. Używaj TYLKO konkretnych danych, które zostały Ci podane.
3. Jeśli czegoś nie wiesz - pomiń to, NIE wymyślaj.
4. Każdy post musi być kompletny i gotowy do publikacji bez żadnych edycji.`,
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.8,
            max_tokens: hasFacebook && !hasX ? 600 : 300,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Grok API error in batch:", response.status, errorText);
          
          // Handle rate limit specifically
          if (response.status === 429) {
            throw { isRateLimit: true, status: 429 };
          }
          if (response.status === 401 || response.status === 403) {
            throw { isAuthError: true, status: response.status };
          }
          
          throw new Error(`Failed to generate post: ${response.status}`);
        }

        const data = await response.json();
        let text = data.choices[0].message.content.trim();

        // VALIDATION: Check for and warn about placeholder patterns
        const placeholderPattern = /\[[^\]]+\]/g;
        const placeholders = text.match(placeholderPattern);
        if (placeholders) {
          console.warn(`WARNING: Post ${item.position} contains placeholders: ${placeholders.join(', ')}`);
          console.warn(`Original text: ${text}`);
        }

        // Always sanitize output (even if the model didn't use [placeholders])
        text = sanitizeGeneratedText(text, bookData);

        if (placeholders) {
          console.log(`Cleaned text: ${text}`);
        }

        return {
          position: item.position,
          type: item.type,
          category: item.category,
          text: text,
          bookId: bookData?.id || null,
        };
      });

      const batchResults = await Promise.all(batchPromises);
      posts.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < structure.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  } catch (error: any) {
    // Handle rate limit error with user-friendly message
    if (error?.isRateLimit) {
      return new Response(
        JSON.stringify({
          success: false,
          errorCode: "RATE_LIMIT",
          error: "Przekroczono limit API Grok. Konto wyczerpało kredyty lub osiągnęło limit zapytań. Spróbuj ponownie później lub doładuj kredyty w panelu x.ai.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    if (error?.isAuthError) {
      return new Response(
        JSON.stringify({
          success: false,
          errorCode: "AUTH_ERROR",
          error: "Nieprawidłowy lub wygasły klucz API Grok. Sprawdź konfigurację klucza w ustawieniach.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Re-throw other errors
    throw error;
  }

  console.log(`Generated content for ${posts.length} posts`);

  return new Response(JSON.stringify({ success: true, posts }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generateSimpleCampaign(body: any, apiKey: string) {
  const { campaignType, bookData, numberOfPosts } = body;

  console.log("Generating simple campaign:", { campaignType, numberOfPosts });

  const systemPrompts: Record<string, string> = {
    trivia: `Jesteś ekspertem od książek i literatury. Twórz fascynujące ciekawostki literackie, które są:
- Krótkie (max 250 znaków z URL-em)
- Interesujące i angażujące
- Związane z książkami, autorami lub literaturą
- Napisane w przystępny, przyjazny sposób
- Zakończone zaproszeniem do odwiedzenia sklepu
WAŻNE: NIE dodawaj informacji o liczbie znaków do treści posta. NIE używaj placeholderów w nawiasach kwadratowych.`,

    quiz: `Jesteś kreatorem quizów literackich. Twórz angażujące zagadki i pytania:
- Pytanie jest intrygujące i ma tło (nie tylko "zgadnij autora")
- Długość max 250 znaków z URL-em
- Zachęcaj do interakcji (np. "Odpowiedź w komentarzach!")
- Pytania powinny być ciekawe dla miłośników książek
- Dodaj link do sklepu na końcu
WAŻNE: NIE dodawaj informacji o liczbie znaków do treści posta. NIE używaj placeholderów w nawiasach kwadratowych.`,

    recommendation: `Jesteś pasjonatem książek polecającym lektury. Twórz rekomendacje które:
- Opisują książkę w intrygujący sposób
- Wyjaśniają dla kogo jest ta książka
- Max 250 znaków z URL-em
- Używają emocjonalnego języka
- Zachęcają do zakupu
WAŻNE: NIE dodawaj informacji o liczbie znaków do treści posta. NIE używaj placeholderów w nawiasach kwadratowych.`,

    event: `Tworzysz posty o wydarzeniach literackich. Posty powinny:
- Informować o wydarzeniach, rocznicach, świętach literackich
- Być aktualne i sezonowe
- Max 250 znaków z URL-em
- Łączyć wydarzenie z ofertą księgarni
- Zachęcać do odwiedzin
WAŻNE: NIE dodawaj informacji o liczbie znaków do treści posta. NIE używaj placeholderów w nawiasach kwadratowych.`,
  };

  const userPrompt = bookData
    ? `Stwórz ${numberOfPosts} różnych postów typu "${campaignType}" o książce:
Tytuł: ${bookData.title}
Opis: ${bookData.description || "Brak opisu"}
Cena: ${bookData.sale_price || bookData.promotional_price} zł
URL: ${bookData.product_url}

Każdy post powinien:
- Być unikalny i oryginalny
- Zawierać odpowiednie emoji
- Kończyć się linkiem do produktu
- Nie przekraczać 250 znaków ŁĄCZNIE z linkiem

WAŻNE: NIE dodawaj informacji o liczbie znaków do treści posta. NIE używaj placeholderów w nawiasach kwadratowych.

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

WAŻNE: NIE dodawaj informacji o liczbie znaków do treści posta. NIE używaj placeholderów w nawiasach kwadratowych.

Zwróć TYLKO tablicę JSON z postami w formacie:
[
  {
    "text": "treść posta z emoji i linkiem",
    "type": "${campaignType}"
  }
]`;

  const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4-fast-reasoning",
      messages: [
        {
          role: "system",
          content: systemPrompts[campaignType] || systemPrompts["trivia"],
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 2000,
    }),
  });

  if (!grokResponse.ok) {
    const errorText = await grokResponse.text();
    console.error("Grok API error:", grokResponse.status, errorText);
    throw new Error(`Grok API error: ${grokResponse.status}`);
  }

  const grokData = await grokResponse.json();
  let content = grokData.choices[0].message.content;

  content = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

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
      count: posts.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
