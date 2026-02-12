// LCS-based similarity
export function lcsLength(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const lcs = lcsLength(a, b);
  return lcs / Math.max(a.length, b.length);
}

export function normalize(s: string): string {
  return s
    .replace(/\.[^/.]+$/, "") // remove extension
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .trim();
}

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function extractFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").pop() || "";
    return decodeURIComponent(lastSegment);
  } catch {
    return url.split("/").pop() || url;
  }
}

export function isValidUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}
