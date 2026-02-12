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

function fixBrokenUrls(text: string): string {
  // Fix URLs that have spaces, newlines or other breaks in them
  // Pattern: find URLs and remove any whitespace within them
  
  // First, find all potential URL patterns (broken or not)
  let result = text;
  
  // Fix common patterns where URLs get broken by spaces/newlines
  // Pattern 1: "https://..." followed by spaces/newlines and more URL parts
  result = result.replace(
    /(https?:\/\/[^\s,\n]*?)[\s\n]+([^\s,\n]*?\.(?:html?|php|aspx?|jsp|com|org|pl|net|eu)[^\s,\n]*)/gi,
    '$1$2'
  );
  
  // Pattern 2: URL path segments broken by spaces (e.g., "/path /more" -> "/path/more")
  result = result.replace(
    /(https?:\/\/[^\s,\n]+?)[\s\n]+([a-zA-Z0-9\-_]+(?:\/|\.html?|\.php|$))/gi,
    (match, p1, p2) => {
      // Only join if p2 looks like a URL continuation (starts with lowercase or is a file extension)
      if (p2.match(/^[a-z0-9\-_\/]/i)) {
        return p1 + p2;
      }
      return match;
    }
  );
  
  // Pattern 3: Fix spaces before common URL suffixes
  result = result.replace(
    /(https?:\/\/[^\s,\n]+?)[\s\n]+(html?|php|aspx?|jsp)\b/gi,
    '$1.$2'
  );
  
  // Pattern 4: Fix ".html" broken as ". html" or "/ html"
  result = result.replace(/([\/\.])\s+(html?|php|aspx?|jsp)\b/gi, '$1$2');
  
  // Pattern 5: Fix comma or space right after URL path before extension
  result = result.replace(
    /(https?:\/\/[^\s,\n]+\/[^\s,\n]+?)\s*[,\s]+([a-zA-Z0-9\-_]+\.html?)/gi,
    '$1,$2'
  );
  
  return result;
}

function sanitizeGeneratedText(text: string, bookData?: any, defaultWebsiteUrl?: string): string {
  let out = safeText(text);

  // FIRST: Fix any broken URLs before other processing
  out = fixBrokenUrls(out);

  // Replace common placeholders with real values (or empty strings)
  const fallbackUrl = defaultWebsiteUrl || "https://sklep.antyk.org.pl";
  const url = safeText(bookData?.product_url) || fallbackUrl;
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

  // Extract URLs before whitespace cleanup to protect them
  const urlPlaceholders: string[] = [];
  out = out.replace(/(https?:\/\/[^\s,\n\]]+)/g, (match) => {
    urlPlaceholders.push(match);
    return `__URL_PLACEHOLDER_${urlPlaceholders.length - 1}__`;
  });

  // Final whitespace cleanup (now URLs are protected)
  out = out.replace(/\s{2,}/g, " ").trim();

  // Restore URLs
  out = out.replace(/__URL_PLACEHOLDER_(\d+)__/g, (_, index) => {
    return urlPlaceholders[parseInt(index)];
  });

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
    } else if (action === "generate_posts_batch") {
      return await generatePostsBatched(body, GROK_API_KEY);
    } else if (action === "get_generation_progress") {
      return await getGenerationProgress(body);
    } else if (action === "cleanup_generation") {
      return await cleanupGeneration(body);
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
        success: false,
        error: errorMessage,
        details: errorDetails,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function generateCampaignStructure(body: any, apiKey: string) {
  let { totalPosts, contentPosts, salesPosts, durationDays, postsPerDay, useRandomContent, randomContentTopic } = body;

  // If random content is enabled: all posts are trivia/content (no sales, no books)
  if (useRandomContent) {
    console.log("Random content mode - generating structure locally", { totalPosts, durationDays, postsPerDay, randomContentTopic });
    const structure = Array.from({ length: totalPosts }, (_, idx) => ({
      position: idx + 1,
      type: "content",
      category: "trivia",
    }));

    return new Response(JSON.stringify({ success: true, structure }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // WAŻNE: Jeśli jest tylko 1 post, musi być sprzedażowy
  if (totalPosts === 1) {
    salesPosts = 1;
    contentPosts = 0;
    console.log("Single post campaign - forcing sales post");
  }

  console.log("Generating campaign structure:", { totalPosts, contentPosts, salesPosts });

  // For large campaigns (>50 posts), generate structure locally without AI
  // This avoids Grok API token limits and is much faster
  if (totalPosts > 50) {
    console.log(`Large campaign detected (${totalPosts} posts) - generating structure locally`);
    const structure = generateLocalStructure(totalPosts, contentPosts, salesPosts);
    console.log(`Generated local structure with ${structure.length} posts`);
    return new Response(JSON.stringify({ success: true, structure }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const systemPrompt = `Jesteś ekspertem od strategii content marketingu dla księgarni patriotycznej. 
Twoim zadaniem jest stworzyć optymalny plan kampanii z przewagą postów sprzedażowych (80% sprzedaż, 20% content).

WAŻNE: Zawsze odpowiadaj TYLKO po polsku. Nigdy nie używaj angielskiego.

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

  // Dynamic max_tokens based on post count (each post needs ~50-60 tokens in JSON)
  const estimatedTokens = Math.min(Math.max(totalPosts * 60, 1500), 8000);

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
      max_tokens: estimatedTokens,
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
      // Fallback to local generation if AI parsing fails
      console.warn("Could not parse Grok response, falling back to local structure generation");
      structure = generateLocalStructure(totalPosts, contentPosts, salesPosts);
    }
  }

  console.log(`Generated structure with ${structure.length} posts`);

  return new Response(JSON.stringify({ success: true, structure }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Generate campaign structure locally without AI
function generateLocalStructure(totalPosts: number, contentPosts: number, salesPosts: number): any[] {
  const structure: any[] = [];
  
  // Calculate interval for content posts (spread evenly)
  // e.g., 80 sales + 20 content = every 5th post is content
  const contentInterval = contentPosts > 0 ? Math.floor(totalPosts / contentPosts) : Infinity;
  
  let contentCount = 0;
  let salesCount = 0;
  
  for (let i = 1; i <= totalPosts; i++) {
    // Place content post at regular intervals, but not as first post
    const shouldBeContent = contentPosts > 0 && 
                           contentCount < contentPosts && 
                           i > 1 && 
                           (i % contentInterval === 0 || 
                            (totalPosts - i < contentPosts - contentCount)); // Ensure remaining content posts are placed
    
    if (shouldBeContent && salesCount > 0) {
      structure.push({
        position: i,
        type: "content",
        category: "trivia"
      });
      contentCount++;
    } else if (salesCount < salesPosts) {
      structure.push({
        position: i,
        type: "sales",
        category: "sales"
      });
      salesCount++;
    } else {
      // Fallback: add remaining as content
      structure.push({
        position: i,
        type: "content",
        category: "trivia"
      });
      contentCount++;
    }
  }
  
  return structure;
}

async function generatePostsContent(body: any, apiKey: string) {
  let { structure, targetPlatforms, selectedBooks, cachedTexts, regenerateTexts, useRandomContent, randomContentTopic, userId } = body;

  console.log("=== generatePostsContent START ===");
  console.log("Generating content for posts:", structure.length);
  console.log("Target platforms:", targetPlatforms);
  console.log("Selected books:", selectedBooks?.length || 0);
  console.log("regenerateTexts flag:", regenerateTexts);
  console.log("useRandomContent:", useRandomContent);
  console.log("randomContentTopic:", randomContentTopic || "(not set)");

  // Safety: random content mode must NEVER produce sales posts (no books required)
  if (useRandomContent) {
    structure = (structure || []).map((item: any, idx: number) => ({
      position: item?.position ?? idx + 1,
      type: "content",
      category: "trivia",
    }));
    console.log("Random content mode - normalized structure to trivia-only", { count: structure.length });
  }

  console.log("cachedTexts received:", cachedTexts ? `object with ${Object.keys(cachedTexts).length} book IDs` : "null/undefined");
  if (cachedTexts && Object.keys(cachedTexts).length > 0) {
    console.log("First few cached book IDs:", Object.keys(cachedTexts).slice(0, 5).join(", "));
  }
  console.log("Will use cached texts:", !regenerateTexts && cachedTexts ? Object.keys(cachedTexts).length : 0);
  
  // Check if Facebook is in target platforms
  const hasFacebook = targetPlatforms && targetPlatforms.some((p: any) => p.id === 'facebook' || p === 'facebook');
  const hasX = targetPlatforms && targetPlatforms.some((p: any) => p.id === 'x' || p === 'x');
  
  // Determine text limits based on platforms
  const maxTextLength = hasFacebook && !hasX ? 1800 : (hasFacebook && hasX ? 240 : 240);

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch default website URL from user_settings
  let defaultWebsiteUrl = "https://sklep.antyk.org.pl";
  if (userId) {
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('default_website_url')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (userSettings?.default_website_url) {
      defaultWebsiteUrl = userSettings.default_website_url;
      console.log("Using default website URL from user settings:", defaultWebsiteUrl);
    }
  }

  // Get available books for sales posts - filter by selectedBooks if provided
  const salesPostsCount = structure.filter((item: any) => item.type === "sales").length;
  
  let availableBooks: any[] = [];
  
  // Allow empty books when using random content generation
  if (!useRandomContent && (!selectedBooks || selectedBooks.length === 0)) {
    console.error("No books selected for campaign and random content is disabled");
    return new Response(
      JSON.stringify({
        success: false,
        errorCode: "NO_BOOKS",
        error: "Nie wybrano żadnych książek do kampanii. Proszę wybrać co najmniej jedną książkę lub włącz generowanie losowych treści.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Only fetch books if we have selectedBooks and not in random content mode
  if (selectedBooks && selectedBooks.length > 0) {
    console.log(`Fetching ${selectedBooks.length} selected books...`);
    
    // Fetch selected books in batches
    const fetchBatchSize = 100;
    const allFetchedBooks: any[] = [];
    
    for (let i = 0; i < selectedBooks.length; i += fetchBatchSize) {
      const batch = selectedBooks.slice(i, i + fetchBatchSize);
      const { data: batchBooks, error: batchError } = await supabase
        .from("books")
        .select("id, title, description, sale_price, product_url, campaign_post_count, author")
        .in("id", batch)
        .eq("user_id", userId);
      
      if (batchError) {
        console.error(`Error fetching books batch ${i / fetchBatchSize}:`, batchError);
        continue;
      }
      
      if (batchBooks) {
        allFetchedBooks.push(...batchBooks);
      }
    }

    if (allFetchedBooks.length === 0 && !useRandomContent) {
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
    
    availableBooks = allFetchedBooks;
  } else if (useRandomContent) {
    console.log("Using random content mode - no books needed");
  }

  // Sort by price DESC - if more books than sales posts, use most expensive ones
  if (availableBooks.length > 0) {
    availableBooks = availableBooks.sort((a: any, b: any) => {
      if (a.sale_price !== b.sale_price) {
        if (a.sale_price === null) return 1;
        if (b.sale_price === null) return -1;
        return b.sale_price - a.sale_price;
      }
      return 0;
    });
  }

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

  // Platform-specific prompts - updated to reference ONLY selected books or random topic
  const getFacebookPrompts = (booksList: string): Record<string, string> => {
    // If using random content, use the topic instead of books
    const contentSource = useRandomContent && randomContentTopic 
      ? `Stwórz ciekawostkę na temat: ${randomContentTopic}`
      : `Stwórz ciekawostkę powiązaną z tematyką JEDNEJ z tych książek/produktów:\n${booksList}`;
    
    return {
      trivia: `${contentSource}

Post może mieć do ${maxTextLength} znaków. Powinien:
- ${useRandomContent ? 'Opowiadać fascynującą historię lub fakt na podany temat' : 'Opowiadać o temacie, okresie historycznym, postaci lub wydarzeniu związanym z jedną z powyższych książek'}
- NIE wspominać bezpośrednio tytułu książki - to ma być ciekawostka, która wzbudzi zainteresowanie tematem
- Być fascynujący i angażujący
- Kończyć się linkiem: ${defaultWebsiteUrl}

WAŻNE: 
- NIE używaj placeholderów w nawiasach kwadratowych typu [link], [tytuł] itp.
- NIE dodawaj informacji o liczbie znaków do treści posta.
- Pisz KONKRETNE fakty, nie ogólniki.`,
      sales: "Promocja konkretnej książki - szczegóły zostaną dodane dynamicznie",
    };
  };

  const getXPrompts = (booksList: string): Record<string, string> => {
    const contentSource = useRandomContent && randomContentTopic 
      ? `Stwórz krótką ciekawostkę (max 240 znaków) na temat: ${randomContentTopic}`
      : `Stwórz krótką ciekawostkę (max 240 znaków) powiązaną z tematyką JEDNEJ z tych książek/produktów:\n${booksList}`;
    
    return {
      trivia: `${contentSource}

Ciekawostka powinna:
- ${useRandomContent ? 'Dotyczyć podanego tematu i być fascynująca' : 'Dotyczyć tematu, okresu historycznego lub postaci związanej z jedną z powyższych książek'}
- NIE wspominać bezpośrednio tytułu - ma wzbudzić zainteresowanie tematem
- Kończyć się linkiem: ${defaultWebsiteUrl}

WAŻNE: NIE używaj placeholderów w nawiasach kwadratowych. NIE dodawaj informacji o liczbie znaków.`,
      sales: "Promocja konkretnej książki - szczegóły zostaną dodane dynamicznie",
    };
  };

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
          
          // Check for cached text FIRST
          const primaryPlatform = hasFacebook && !hasX ? 'facebook' : 'x';
          const cacheKey = `${primaryPlatform}_sales`;
          
          if (!regenerateTexts && cachedTexts && cachedTexts[bookData.id] && cachedTexts[bookData.id][cacheKey]) {
            console.log(`Using cached sales text for book ${bookData.id}`);
            return {
              type: item.type,
              category: item.category,
              text: cachedTexts[bookData.id][cacheKey],
              bookId: bookData.id,
              fromCache: true
            };
          }
          
          // Fallback URL in case product_url is null - use user's default
          const bookUrl = bookData.product_url || defaultWebsiteUrl;

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
          
          // Check for cached content text FIRST
          if (nearestBook) {
            const primaryPlatform = hasFacebook && !hasX ? 'facebook' : 'x';
            const cacheKey = `${primaryPlatform}_content`;
            
            if (!regenerateTexts && cachedTexts && cachedTexts[nearestBook.id] && cachedTexts[nearestBook.id][cacheKey]) {
              console.log(`Using cached content text for book ${nearestBook.id}`);
              return {
                type: item.type,
                category: item.category,
                text: cachedTexts[nearestBook.id][cacheKey],
                bookId: nearestBook.id,
                fromCache: true
              };
            }
          }
          
          // If we found a book, create trivia specifically about its topic
          if (nearestBook && !useRandomContent) {
            bookData = nearestBook; // Set bookData for the return value
            const bookUrl = nearestBook.product_url || defaultWebsiteUrl;
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
          } else if (useRandomContent && randomContentTopic) {
            // Use random content topic
            console.log(`Generating random content trivia for topic: ${randomContentTopic}`);
            const triviaContext = `Stwórz fascynującą ciekawostkę na temat: ${randomContentTopic}

WAŻNE:
- Pisz o konkretnych faktach, postaciach lub wydarzeniach związanych z tematem
- Ciekawostka ma być wartościowa i angażująca
- NIE używaj placeholderów w nawiasach kwadratowych
- Zakończ DOKŁADNIE tym linkiem: ${defaultWebsiteUrl}

`;
            prompt = triviaContext + (hasFacebook && !hasX 
              ? `Post może mieć do ${maxTextLength} znaków. NIE dodawaj informacji o liczbie znaków do treści.`
              : `Max 240 znaków ŁĄCZNIE z linkiem. NIE dodawaj informacji o liczbie znaków do treści.`);
          } else {
            // Ultimate fallback: generic bookstore trivia
            console.log("No books available for trivia - using generic prompt");
            prompt = `Stwórz krótką ciekawostkę o książkach, literaturze lub historii Polski.
- NIE używaj placeholderów w nawiasach kwadratowych
- Zakończ linkiem: ${defaultWebsiteUrl}

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
1. ZAWSZE pisz TYLKO po polsku. Nigdy nie używaj angielskiego.
2. NIGDY nie używaj placeholderów w nawiasach kwadratowych typu [link], [tytuł], [autor], [cena] itp.
3. Używaj TYLKO konkretnych danych, które zostały Ci podane.
4. Jeśli czegoś nie wiesz - pomiń to, NIE wymyślaj.
5. Każdy post musi być kompletny i gotowy do publikacji bez żadnych edycji.`
                  : `Jesteś ekspertem od content marketingu dla księgarni patriotycznej. Piszesz krótkie, angażujące posty na Twitter/X (max 240 znaków).

BEZWZGLĘDNE ZASADY:
1. ZAWSZE pisz TYLKO po polsku. Nigdy nie używaj angielskiego.
2. NIGDY nie używaj placeholderów w nawiasach kwadratowych typu [link], [tytuł], [autor] itp.
3. Używaj TYLKO konkretnych danych, które zostały Ci podane.
4. Jeśli czegoś nie wiesz - pomiń to, NIE wymyślaj.
5. Każdy post musi być kompletny i gotowy do publikacji bez żadnych edycji.`,
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
        text = sanitizeGeneratedText(text, bookData, defaultWebsiteUrl);

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

// ==================== BATCH GENERATION FUNCTIONS ====================

async function getGenerationProgress(body: any) {
  const { progressId } = body;
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('campaign_generation_progress')
    .select('*')
    .eq('id', progressId)
    .maybeSingle();
  
  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  return new Response(
    JSON.stringify({ success: true, progress: data }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function cleanupGeneration(body: any) {
  const { progressId } = body;
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  await supabase
    .from('campaign_generation_progress')
    .delete()
    .eq('id', progressId);
  
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function generatePostsBatched(body: any, apiKey: string) {
  const { 
    progressId,
    batchIndex = 0, 
    batchSize = 10,
    // Initial config (only needed for first batch)
    structure,
    targetPlatforms,
    selectedBooks,
    cachedTexts,
    regenerateTexts,
    useRandomContent,
    randomContentTopic,
    userId
  } = body;

  console.log(`=== generatePostsBatched START (batch ${batchIndex}) ===`);
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let progress: any = null;
  let currentProgressId = progressId;

  // If no progressId, this is the first batch - create progress record
  if (!currentProgressId && batchIndex === 0) {
    console.log("First batch - creating progress record");
    
    const { data: newProgress, error: createError } = await supabase
      .from('campaign_generation_progress')
      .insert({
        user_id: userId,
        total_posts: structure.length,
        generated_posts: 0,
        structure: structure,
        posts: [],
        config: {
          targetPlatforms,
          selectedBooks,
          cachedTexts: cachedTexts || null,
          regenerateTexts,
          useRandomContent,
          randomContentTopic
        },
        status: 'in_progress'
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating progress:", createError);
      return new Response(
        JSON.stringify({ success: false, error: createError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    progress = newProgress;
    currentProgressId = newProgress.id;
    console.log("Created progress record:", currentProgressId);
  } else {
    // Fetch existing progress
    const { data: existingProgress, error: fetchError } = await supabase
      .from('campaign_generation_progress')
      .select('*')
      .eq('id', currentProgressId)
      .single();

    if (fetchError || !existingProgress) {
      console.error("Error fetching progress:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Progress record not found' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    progress = existingProgress;
  }

  // Extract data from progress
  const fullStructure = progress.structure as any[];
  const existingPosts = (progress.posts || []) as any[];
  const config = progress.config as any;
  const totalPosts = progress.total_posts;

  // Calculate which posts to generate in this batch
  const startIdx = batchIndex * batchSize;
  const endIdx = Math.min(startIdx + batchSize, totalPosts);
  
  if (startIdx >= totalPosts) {
    // All posts already generated
    console.log("All posts already generated, returning completion");
    return new Response(
      JSON.stringify({
        success: true,
        progressId: currentProgressId,
        completed: totalPosts,
        total: totalPosts,
        hasMore: false,
        posts: existingPosts
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`Generating posts ${startIdx + 1} to ${endIdx} of ${totalPosts}`);

  // Get batch of structure items to process
  const batchStructure = fullStructure.slice(startIdx, endIdx);

  // Prepare context for generation (simplified version of generatePostsContent logic)
  const hasFacebook = config.targetPlatforms?.some((p: any) => p.id === 'facebook' || p === 'facebook');
  const hasX = config.targetPlatforms?.some((p: any) => p.id === 'x' || p === 'x');
  const maxTextLength = hasFacebook && !hasX ? 1800 : 240;

  // Fetch default website URL
  let defaultWebsiteUrl = "https://sklep.antyk.org.pl";
  if (userId) {
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('default_website_url')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (userSettings?.default_website_url) {
      defaultWebsiteUrl = userSettings.default_website_url;
    }
  }

  // Fetch books if needed
  let availableBooks: any[] = [];
  if (config.selectedBooks && config.selectedBooks.length > 0) {
    const { data: books } = await supabase
      .from("books")
      .select("id, title, description, sale_price, product_url, author")
      .in("id", config.selectedBooks)
      .eq("user_id", userId);
    
    if (books) {
      availableBooks = books.sort((a: any, b: any) => {
        if (a.sale_price !== b.sale_price) {
          if (a.sale_price === null) return 1;
          if (b.sale_price === null) return -1;
          return b.sale_price - a.sale_price;
        }
        return 0;
      });
    }
  }

  // Generate posts for this batch
  const batchPosts: any[] = [];
  
  try {
    for (const item of batchStructure) {
      let text = "";
      let bookId = null;
      let fromCache = false;

      // Determine book for this post position
      const salesPostsBeforeThis = fullStructure.slice(0, item.position - 1).filter((s: any) => s.type === 'sales').length;
      const bookIndex = salesPostsBeforeThis % Math.max(1, availableBooks.length);
      const book = availableBooks[bookIndex] || null;

      if (item.category === "sales" && book) {
        bookId = book.id;
        
        // Check cache first
        const primaryPlatform = hasFacebook && !hasX ? 'facebook' : 'x';
        const cacheKey = `${primaryPlatform}_sales`;
        
        if (!config.regenerateTexts && config.cachedTexts?.[book.id]?.[cacheKey]) {
          text = config.cachedTexts[book.id][cacheKey];
          fromCache = true;
          console.log(`Using cached text for book ${book.id}`);
        } else {
          // Generate sales post
          const bookUrl = book.product_url || defaultWebsiteUrl;
          const prompt = hasFacebook && !hasX
            ? `Stwórz bogaty post promocyjny (do ${maxTextLength} znaków) o:
Tytuł: ${book.title}
${book.author ? `Autor: ${book.author}` : ""}
${book.description ? `Opis: ${book.description}` : ""}
${book.sale_price ? `Cena: ${book.sale_price} zł` : ""}
Link: ${bookUrl}

NIE używaj placeholderów []. Kończyć się linkiem: ${bookUrl}`
            : `Stwórz krótki post (max 240 znaków z linkiem) o:
Tytuł: ${book.title}
${book.author ? `Autor: ${book.author}` : ""}
${book.sale_price ? `Cena: ${book.sale_price} zł` : ""}
Link: ${bookUrl}

NIE używaj placeholderów []. Kończyć się linkiem: ${bookUrl}`;

          text = await callGrokAPI(apiKey, prompt, hasFacebook && !hasX);
          text = sanitizeGeneratedText(text, book, defaultWebsiteUrl);
        }
      } else if (item.type === "content" && item.category === "trivia") {
        // Find nearest book for trivia context
        const nearestBook = book || (availableBooks.length > 0 ? availableBooks[0] : null);
        
        if (nearestBook) {
          bookId = nearestBook.id;
          
          // Check cache
          const primaryPlatform = hasFacebook && !hasX ? 'facebook' : 'x';
          const cacheKey = `${primaryPlatform}_content`;
          
          if (!config.regenerateTexts && config.cachedTexts?.[nearestBook.id]?.[cacheKey]) {
            text = config.cachedTexts[nearestBook.id][cacheKey];
            fromCache = true;
          }
        }
        
        if (!text) {
          // Generate trivia
          const triviaUrl = nearestBook?.product_url || defaultWebsiteUrl;
          let prompt: string;
          
          if (config.useRandomContent && config.randomContentTopic) {
            prompt = `Stwórz fascynującą ciekawostkę na temat: ${config.randomContentTopic}
NIE używaj placeholderów []. Zakończ linkiem: ${defaultWebsiteUrl}
${hasFacebook && !hasX ? `Max ${maxTextLength} znaków.` : 'Max 240 znaków z linkiem.'}`;
          } else if (nearestBook) {
            prompt = `Stwórz ciekawostkę związaną z tematyką: ${nearestBook.title}
${nearestBook.description ? `Kontekst: ${nearestBook.description}` : ""}
NIE wspominaj tytułu. NIE używaj placeholderów []. Zakończ linkiem: ${triviaUrl}
${hasFacebook && !hasX ? `Max ${maxTextLength} znaków.` : 'Max 240 znaków z linkiem.'}`;
          } else {
            prompt = `Stwórz krótką ciekawostkę o książkach lub historii Polski.
NIE używaj placeholderów []. Zakończ linkiem: ${defaultWebsiteUrl}
${hasFacebook && !hasX ? `Max ${maxTextLength} znaków.` : 'Max 240 znaków z linkiem.'}`;
          }

          text = await callGrokAPI(apiKey, prompt, hasFacebook && !hasX);
          text = sanitizeGeneratedText(text, nearestBook, defaultWebsiteUrl);
        }
      }

      batchPosts.push({
        position: item.position,
        type: item.type,
        category: item.category,
        text: text,
        bookId: bookId,
        fromCache: fromCache
      });

      // Small delay between posts in batch
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } catch (error: any) {
    console.error("Error in batch generation:", error);
    
    // Update progress with error
    await supabase
      .from('campaign_generation_progress')
      .update({ status: 'error', error_message: error.message })
      .eq('id', currentProgressId);

    // Handle rate limit
    if (error?.isRateLimit || error?.message?.includes('429')) {
      return new Response(
        JSON.stringify({
          success: false,
          errorCode: "RATE_LIMIT",
          error: "Przekroczono limit API Grok. Spróbuj ponownie za kilka minut.",
          progressId: currentProgressId
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message, progressId: currentProgressId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Append new posts to existing posts
  const updatedPosts = [...existingPosts, ...batchPosts];
  const newGeneratedCount = updatedPosts.length;
  const hasMore = newGeneratedCount < totalPosts;

  // Update progress in database
  const { error: updateError } = await supabase
    .from('campaign_generation_progress')
    .update({
      posts: updatedPosts,
      generated_posts: newGeneratedCount,
      status: hasMore ? 'in_progress' : 'completed'
    })
    .eq('id', currentProgressId);

  if (updateError) {
    console.error("Error updating progress:", updateError);
  }

  console.log(`Batch ${batchIndex} complete: ${newGeneratedCount}/${totalPosts} posts generated`);

  return new Response(
    JSON.stringify({
      success: true,
      progressId: currentProgressId,
      completed: newGeneratedCount,
      total: totalPosts,
      hasMore: hasMore,
      nextBatchIndex: hasMore ? batchIndex + 1 : null,
      posts: hasMore ? null : updatedPosts // Only return all posts when complete
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Helper function to call Grok API
async function callGrokAPI(apiKey: string, prompt: string, isLongForm: boolean): Promise<string> {
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
          content: `Jesteś ekspertem od content marketingu dla księgarni patriotycznej. Piszesz ${isLongForm ? 'bogate' : 'krótkie'} posty po polsku.

ZASADY:
1. TYLKO po polsku
2. NIGDY nie używaj placeholderów []
3. Używaj TYLKO podanych danych
4. Post musi być gotowy do publikacji`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: isLongForm ? 600 : 300,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Grok API error:", response.status, errorText);
    
    if (response.status === 429) {
      throw { isRateLimit: true, message: "Rate limit exceeded" };
    }
    if (response.status === 401 || response.status === 403) {
      throw { isAuthError: true, message: "Authentication error" };
    }
    
    throw new Error(`Grok API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}
