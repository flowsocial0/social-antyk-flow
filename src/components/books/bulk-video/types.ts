export interface FileMatch {
  file?: File;
  url?: string;
  fileName: string;
  bookId: string | null;
  bookTitle: string | null;
  similarity: number;
  status: "matched" | "partial" | "unmatched";
}

export interface UploadResult {
  fileName: string;
  success: boolean;
  error?: string;
}

export interface BookRecord {
  id: string;
  title: string;
  code: string;
  video_url?: string | null;
}
