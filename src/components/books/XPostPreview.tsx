import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface XPostPreviewProps {
  book: Tables<"books">;
}

export const XPostPreview = ({ book }: XPostPreviewProps) => {
  const handleClick = () => {
    if (book.product_url) {
      window.open(book.product_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Card className="max-w-xl overflow-hidden bg-gradient-card backdrop-blur-sm shadow-card hover:shadow-glow transition-all duration-300">
      <CardContent className="p-0">
        {/* Book Cover - Clickable */}
        {book.image_url && (
          <div
            onClick={handleClick}
            className="relative overflow-hidden cursor-pointer group"
          >
            <img
              src={book.image_url}
              alt={book.title}
              className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <ExternalLink className="w-6 h-6 text-primary-foreground drop-shadow-lg" />
            </div>
          </div>
        )}

        {/* Content Section */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <h3 className="text-xl font-bold text-card-foreground leading-tight">
            {book.title}
          </h3>

          {/* Price Badge */}
          {(book.promotional_price || book.sale_price) && (
            <div className="flex items-center gap-2">
              <Badge className="bg-gradient-primary text-primary-foreground px-3 py-1 text-base font-semibold shadow-sm">
                {book.promotional_price
                  ? `${book.promotional_price.toFixed(2)} PLN`
                  : book.sale_price
                  ? `${book.sale_price.toFixed(2)} PLN`
                  : null}
              </Badge>
              {book.promotional_price && book.sale_price && (
                <span className="text-sm text-muted-foreground line-through">
                  {book.sale_price.toFixed(2)} PLN
                </span>
              )}
            </div>
          )}

          {/* Stock Status */}
          {book.stock_status && (
            <div className="text-sm text-muted-foreground">
              Status: <span className="text-card-foreground font-medium">{book.stock_status}</span>
            </div>
          )}

          {/* Link Button */}
          {book.product_url && (
            <button
              onClick={handleClick}
              className="w-full mt-4 px-6 py-3 bg-gradient-primary text-primary-foreground font-semibold rounded-lg shadow-md hover:shadow-glow transition-all duration-300 flex items-center justify-center gap-2 group"
            >
              <span>Zobacz w księgarni</span>
              <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          )}

          {/* Code */}
          <div className="pt-2 border-t border-border text-xs text-muted-foreground">
            Kod: {book.code}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
