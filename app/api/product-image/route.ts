import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

// In-memory buffer cache for remote images
const remoteBufferCache = new Map<string, { buffer: Buffer; mime: string }>();

// Curated verified authentic FMCG product package photos (stored locally in public/products/)
const CURATED_LOCAL_PRODUCTS: Array<{ pattern: RegExp; file: string }> = [
  { pattern: /(?:water\s*bottle|bottle|flask|thermos|sipper|milton|aquafina|kinley|bisleri|tupperware)/i, file: "water-bottle.png" },
  { pattern: /(?:chocos|kellogg)/i, file: "chocos.jpg" },
  { pattern: /(?:coconut\s*oil|parachute|nariyal)/i, file: "coconut-oil.jpg" },
  { pattern: /(?:maggi|noodle|yippee)/i, file: "maggi.jpg" },
  { pattern: /(?:parle[-\s]?g|biscuit|cookie|marie|good\s*day|oreo)/i, file: "parle-g.jpg" },
  { pattern: /(?:lays|kurkure|chips|wafer|namkeen|bhujia|bingo)/i, file: "chips.jpg" },
  { pattern: /(?:dairy\s*milk|cadbury|chocolate|kitkat|5\s*star|perk)/i, file: "chocolate.jpg" },
  { pattern: /(?:colgate|toothpaste|close\s*up|pepsodent|dant\s*kanti|sensodyne)/i, file: "toothpaste.jpg" },
];

const fileBufferCache = new Map<string, { buffer: Buffer; mime: string }>();

function getMimeType(buf: Buffer): string {
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return "image/gif";
  }
  if (buf.length >= 4 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    return "image/webp";
  }
  return "image/jpeg";
}

async function getLocalImage(filename: string): Promise<{ buffer: Buffer; mime: string } | null> {
  if (fileBufferCache.has(filename)) {
    return fileBufferCache.get(filename)!;
  }
  try {
    const fullPath = path.join(process.cwd(), "public", "products", filename);
    const buffer = await fs.readFile(fullPath);
    const mime = getMimeType(buffer);
    const item = { buffer, mime };
    fileBufferCache.set(filename, item);
    return item;
  } catch {
    return null;
  }
}

interface CategoryStyle {
  bg: string;
  badge: string;
  icon: string;
}

function getCategoryStyle(name: string): CategoryStyle {
  const n = name.toLowerCase();

  if (n.includes("bottle") || n.includes("water") || n.includes("flask") || n.includes("thermos") || n.includes("sipper")) {
    return { bg: "#0288D1", badge: "WATER BOTTLE", icon: "🍶" };
  }
  if (n.includes("coconut") || n.includes("parachute")) {
    return { bg: "#00529B", badge: "COCONUT OIL", icon: "🥥" };
  }
  if (n.includes("oil") || n.includes("tel") || n.includes("ghee") || n.includes("fortune")) {
    return { bg: "#C78200", badge: "EDIBLE OIL", icon: "🫒" };
  }
  if (n.includes("chocos") || n.includes("cereal") || n.includes("flakes")) {
    return { bg: "#5C2D16", badge: "CEREAL PACK", icon: "🥣" };
  }
  if (n.includes("noodle") || n.includes("maggi") || n.includes("pasta")) {
    return { bg: "#D6001C", badge: "NOODLES", icon: "🍜" };
  }
  if (n.includes("biscuit") || n.includes("cookie") || n.includes("parle") || n.includes("rusk")) {
    return { bg: "#B57B23", badge: "BISCUITS", icon: "🍪" };
  }
  if (n.includes("salt") || n.includes("namak")) {
    return { bg: "#004B87", badge: "IODIZED SALT", icon: "🧂" };
  }
  if (n.includes("sugar") || n.includes("cheeni")) {
    return { bg: "#2E7D32", badge: "PURE SUGAR", icon: "🍬" };
  }
  if (n.includes("tea") || n.includes("chai")) {
    return { bg: "#7A1C14", badge: "TEA LEAVES", icon: "☕" };
  }
  if (n.includes("coffee") || n.includes("nescafe") || n.includes("bru")) {
    return { bg: "#3E2723", badge: "COFFEE", icon: "☕" };
  }
  if (n.includes("atta") || n.includes("flour") || n.includes("wheat") || n.includes("rice") || n.includes("dal")) {
    return { bg: "#8D6E63", badge: "GRAIN PACK", icon: "🌾" };
  }
  if (n.includes("chips") || n.includes("kurkure") || n.includes("snack") || n.includes("namkeen")) {
    return { bg: "#E65100", badge: "SNACK POUCH", icon: "🍿" };
  }
  if (n.includes("chocolate") || n.includes("cadbury")) {
    return { bg: "#4A148C", badge: "CHOCOLATE", icon: "🍫" };
  }
  if (n.includes("soap") || n.includes("dettol") || n.includes("lux") || n.includes("lifebuoy")) {
    return { bg: "#00695C", badge: "BATH SOAP", icon: "🧼" };
  }
  if (n.includes("shampoo") || n.includes("hair")) {
    return { bg: "#00838F", badge: "SHAMPOO", icon: "🧴" };
  }
  if (n.includes("paste") || n.includes("colgate")) {
    return { bg: "#C62828", badge: "TOOTHPASTE", icon: "🪥" };
  }
  if (n.includes("detergent") || n.includes("surf") || n.includes("rin") || n.includes("vim")) {
    return { bg: "#1565C0", badge: "CLEANER", icon: "🫧" };
  }
  if (n.includes("milk") || n.includes("butter") || n.includes("curd") || n.includes("amul")) {
    return { bg: "#0277BD", badge: "DAIRY PRODUCT", icon: "🧈" };
  }
  if (n.includes("drink") || n.includes("coke") || n.includes("pepsi") || n.includes("juice") || n.includes("frooti")) {
    return { bg: "#C2185B", badge: "BEVERAGE", icon: "🥤" };
  }
  if (n.includes("masala") || n.includes("spice") || n.includes("mirch") || n.includes("haldi")) {
    return { bg: "#B71C1C", badge: "SPICES", icon: "🌶️" };
  }

  return { bg: "#1E5B43", badge: "KIRANA PACK", icon: "📦" };
}

function generateSvgPlaceholder(name: string): string {
  const { bg, badge, icon } = getCategoryStyle(name);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">
  <rect width="88" height="88" rx="8" fill="${bg}" fill-opacity="0.10"/>
  <rect x="10" y="10" width="68" height="68" rx="6" fill="#FFFFFF" stroke="${bg}" stroke-width="1.2" stroke-opacity="0.25"/>
  <text x="44" y="44" font-size="26" text-anchor="middle" dominant-baseline="central">${icon}</text>
  <rect x="14" y="58" width="60" height="15" rx="3" fill="${bg}"/>
  <text x="44" y="69" font-family="system-ui, -apple-system, sans-serif" font-size="8" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.3">${badge}</text>
</svg>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();

  const headers = {
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
  };

  if (!name) {
    const svg = generateSvgPlaceholder("Item");
    return new Response(svg, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "image/svg+xml; charset=utf-8",
      },
    });
  }

  // 1. Check curated authentic local photos (0ms latency, zero redirects, 100% reliable)
  for (const item of CURATED_LOCAL_PRODUCTS) {
    if (item.pattern.test(name)) {
      const local = await getLocalImage(item.file);
      if (local) {
        return new Response(new Uint8Array(local.buffer), {
          status: 200,
          headers: {
            ...headers,
            "Content-Type": local.mime,
          },
        });
      }
    }
  }

  // 2. Check in-memory buffer cache for previously fetched remote images
  const cacheKey = name.toLowerCase();
  if (remoteBufferCache.has(cacheKey)) {
    const cached = remoteBufferCache.get(cacheKey)!;
    return new Response(new Uint8Array(cached.buffer), {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": cached.mime,
      },
    });
  }

  // 3. Try Wikimedia Commons search with short timeout (serve binary directly, no external redirect)
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      name + " product",
    )}&gsrlimit=1&prop=imageinfo&iiprop=url|mime&iiurlwidth=330&format=json`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "StockeyeApp/1.0 (contact@stockeye.local)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.pages;
      if (pages) {
        const page = Object.values(pages)[0] as {
          imageinfo?: Array<{ thumburl?: string; mime?: string }>;
        };
        const info = page?.imageinfo?.[0];
        if (
          info?.thumburl &&
          (info.mime?.startsWith("image/jpeg") || info.mime?.startsWith("image/png"))
        ) {
          const imgRes = await fetch(info.thumburl, {
            headers: { "User-Agent": "StockeyeApp/1.0" },
          });
          if (imgRes.ok) {
            const arrayBuf = await imgRes.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            const mime = info.mime;
            remoteBufferCache.set(cacheKey, { buffer: buf, mime });
            return new Response(new Uint8Array(buf), {
              status: 200,
              headers: {
                ...headers,
                "Content-Type": mime,
              },
            });
          }
        }
      }
    }
  } catch {
    // Network or timeout, proceed to fallback
  }

  // 4. Fallback: category-specific SVG packaging badge (Direct binary, zero redirects)
  const svg = generateSvgPlaceholder(name);
  return new Response(svg, {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
