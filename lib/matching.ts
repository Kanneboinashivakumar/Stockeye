export interface CandidateProduct {
  id: string;
  name: string;
  name_normalized: string;
  size?: string | null;
  variant?: string | null;
  brand?: string | null;
  category?: string | null;
  price?: number | null;
  stock?: number | null;
  status?: string;
  confidence?: number | null;
  source?: string;
  created_at?: string;
  updated_at?: string;
}

export type MatchResult<T extends CandidateProduct = CandidateProduct> =
  | { ok: true; product: T }
  | { ok: false; error: "ambiguous"; candidates: T[] }
  | { ok: false; error: "not_found"; message: string };

/**
 * Normalizes a product name by:
 * - lowercasing
 * - trimming
 * - stripping attached size/weight specifications
 * - stripping punctuation
 * - collapsing whitespace
 */
export function normalizeProductName(name: string): string {
  if (!name) return "";

  let cleaned = name.toLowerCase().trim();

  // Strip common size/unit patterns, e.g. "70g", "1 kg", "500 ml", "10 packets", "2-minute" (keep minute or remove weight)
  cleaned = cleaned.replace(
    /\b\d+(\.\d+)?\s*(g|gm|gms|gram|grams|kg|kgs|kilo|ml|l|ltr|litre|litres|pcs|pieces|pack|packets|pkt|pkts)\b/gi,
    " ",
  );

  // Strip punctuation (replace with space to keep words separate)
  cleaned = cleaned.replace(/[^a-z0-9\s]/gi, " ");

  // Collapse multiple spaces into one
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned;
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const val = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
      row[j - 1] = prev;
      prev = val;
    }
    row[n] = prev;
  }

  return row[n];
}

/**
 * Deterministic product matching:
 * 1. Exact ID
 * 2. Exact normalized name (+ size/variant if provided)
 * 3. Substring contains (if exactly one candidate matches)
 * 4. Fuzzy fallback (only if exactly one candidate is clearly best)
 * 5. If more than one plausible candidate: return ambiguous
 */
export function matchProduct<T extends CandidateProduct>(
  query: string,
  candidates: T[],
  extraInfo?: { size?: string | null; variant?: string | null },
): MatchResult<T> {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "not_found",
      message: "Please specify a product name.",
    };
  }

  // 1. Exact ID match
  const byId = candidates.find(
    (c) => c.id.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byId) {
    return { ok: true, product: byId };
  }

  const normQuery = normalizeProductName(trimmed);
  if (!normQuery) {
    return {
      ok: false,
      error: "not_found",
      message: `Could not recognize product "${query}".`,
    };
  }

  // 2. Exact normalized name match
  const exactMatches = candidates.filter((c) => {
    const cNorm = c.name_normalized || normalizeProductName(c.name);
    return cNorm === normQuery;
  });

  if (exactMatches.length === 1) {
    return { ok: true, product: exactMatches[0] };
  }

  if (exactMatches.length > 1) {
    // If extra size or variant given, try filtering
    if (extraInfo?.size) {
      const normSize = extraInfo.size.toLowerCase().replace(/\s+/g, "");
      const sizeFiltered = exactMatches.filter(
        (c) => c.size?.toLowerCase().replace(/\s+/g, "") === normSize,
      );
      if (sizeFiltered.length === 1) {
        return { ok: true, product: sizeFiltered[0] };
      }
    }
    return { ok: false, error: "ambiguous", candidates: exactMatches };
  }

  // 3. Normalized contains or is contained by
  const containsMatches = candidates.filter((c) => {
    const cNorm = c.name_normalized || normalizeProductName(c.name);
    return cNorm.includes(normQuery) || normQuery.includes(cNorm);
  });

  if (containsMatches.length === 1) {
    return { ok: true, product: containsMatches[0] };
  }

  if (containsMatches.length > 1) {
    return { ok: false, error: "ambiguous", candidates: containsMatches };
  }

  // 4. Fuzzy matching fallback
  const scored = candidates
    .map((c) => {
      const cNorm = c.name_normalized || normalizeProductName(c.name);
      const wholeMax = Math.max(normQuery.length, cNorm.length);
      const wholeDist = levenshteinDistance(normQuery, cNorm);
      const wholeSim = wholeMax > 0 ? 1 - wholeDist / wholeMax : 0;

      // Also compute best word-level similarity for multi-word product names
      const words = cNorm.split(" ").filter(Boolean);
      let bestWordSim = 0;
      let minWordDist = 999;
      for (const w of words) {
        const wMax = Math.max(normQuery.length, w.length);
        const wDist = levenshteinDistance(normQuery, w);
        const wSim = wMax > 0 ? 1 - wDist / wMax : 0;
        if (wSim > bestWordSim) bestWordSim = wSim;
        if (wDist < minWordDist) minWordDist = wDist;
      }

      const similarity = Math.max(wholeSim, bestWordSim);
      const dist = Math.min(wholeDist, minWordDist);
      return { candidate: c, dist, similarity };
    })
    .filter((s) => s.similarity >= 0.7 || s.dist <= 2)
    .sort((a, b) => b.similarity - a.similarity);

  if (scored.length === 0) {
    return {
      ok: false,
      error: "not_found",
      message: `No product found matching "${query}".`,
    };
  }

  if (scored.length === 1) {
    return { ok: true, product: scored[0].candidate };
  }

  // Check if first candidate is clearly best
  const best = scored[0];
  const second = scored[1];
  if (best.similarity >= 0.75 && best.similarity - second.similarity >= 0.2) {
    return { ok: true, product: best.candidate };
  }

  // Otherwise ambiguous
  return {
    ok: false,
    error: "ambiguous",
    candidates: scored.slice(0, 5).map((s) => s.candidate),
  };
}
