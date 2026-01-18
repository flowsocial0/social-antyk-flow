import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Loader2, ArrowLeft } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export default function BookPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Tables<"books"> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBook = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching book:", error);
        navigate("/");
        return;
      }

      setBook(data);
      setLoading(false);
    };

    fetchBook();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!book) return null;

  const imageUrl = book.storage_path
    ? `https://dmrfbokchkxjzslfzeps.supabase.co/storage/v1/object/public/ObrazkiKsiazek/${book.storage_path}`
    : book.image_url || "";

  const productUrl = book.product_url || "";
  const title = `${book.title} - Antykwariat`;
  const description = book.sale_price
    ? `${book.title} - Cena: ${book.sale_price} zł. Sprawdź w księgarni Antyk.`
    : `${book.title} - Sprawdź w księgarni Antyk.`;

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="product" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {imageUrl && <meta property="og:image" content={imageUrl} />}
        {imageUrl && <meta property="og:image:width" content="1200" />}
        {imageUrl && <meta property="og:image:height" content="630" />}
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={window.location.href} />
        <meta property="twitter:title" content={title} />
        <meta property="twitter:description" content={description} />
        {imageUrl && <meta property="twitter:image" content={imageUrl} />}
        
        {/* Product specific */}
        {book.sale_price && (
          <meta property="product:price:amount" content={book.sale_price.toString()} />
        )}
        <meta property="product:price:currency" content="PLN" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 py-12 px-4">
        <div className="container max-w-4xl mx-auto">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="mb-6 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Powrót
          </Button>
          <Card className="overflow-hidden shadow-elegant">
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-8">
                {imageUrl && (
                  <div className="flex items-center justify-center">
                    <img
                      src={imageUrl}
                      alt={book.title}
                      className="max-w-full h-auto rounded-lg shadow-md"
                    />
                  </div>
                )}
                
                <div className="flex flex-col justify-center space-y-6">
                  <div>
                    <h1 className="text-3xl font-bold mb-2 text-foreground">
                      {book.title}
                    </h1>
                    {book.code && (
                      <p className="text-sm text-muted-foreground">
                        Kod: {book.code}
                      </p>
                    )}
                  </div>

                  {book.sale_price && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-primary">
                        {book.sale_price} zł
                      </span>
                    </div>
                  )}

                  {book.stock_status && (
                    <div className="inline-block">
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {book.stock_status}
                      </span>
                    </div>
                  )}

                  {productUrl && (
                    <Button
                      onClick={() => window.location.href = productUrl}
                      size="lg"
                      className="w-full gap-2"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Zobacz w księgarni
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
