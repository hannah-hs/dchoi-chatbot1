// dchoi09.com 전집 카테고리의 모든 상품을 상세페이지까지 읽어서 data/products.json 으로 저장합니다.
// 실행: npm run scrape   (그 다음 npm run excel 로 엑셀 파일을 다시 만듭니다)
import { writeFile } from "node:fs/promises";
import type { Product } from "../lib/types";

const SITE = "https://dchoi09.com";
const ALL_COLLECTION = "series-books-all";
const AGE_COLLECTIONS: Record<string, string> = {
  "전집-0-1-세": "전집 0-1세",
  "전집-1-2-세": "전집 1-2세",
  "전집-2-3세": "전집 2-3세",
  "전집-3-4세": "전집 3-4세",
  "전집-5세-이상": "전집 5세 이상",
};
const UA = "Mozilla/5.0 (dchoi-chatbot catalog sync)";

interface ShopifyVariant {
  title: string;
  price: string;
  sku: string | null;
  available: boolean;
}
interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  tags: string[];
  variants: ShopifyVariant[];
  images: { src: string }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getText(url: string): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.text();
    // 429 = 너무 자주 요청함. 잠시 쉬었다가 다시 시도합니다.
    if (res.status === 429 || res.status >= 500) await sleep(5000 * (attempt + 1));
    else throw new Error(`${res.status} ${url}`);
  }
  throw new Error(`failed: ${url}`);
}

async function collectionProducts(handle: string): Promise<ShopifyProduct[]> {
  const out: ShopifyProduct[] = [];
  for (let page = 1; ; page++) {
    const url = `${SITE}/collections/${encodeURIComponent(handle)}/products.json?limit=250&page=${page}`;
    const json = JSON.parse(await getText(url)) as { products: ShopifyProduct[] };
    out.push(...json.products);
    if (json.products.length < 250) break;
  }
  return out;
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// 상세페이지의 "구성 / 연령 / 세이펜" 같은 정보 블록 읽기
function parseSpecs(pageHtml: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const blocks = pageHtml.match(/<div class="metafield-rich_text_field">([\s\S]*?)<\/div>/g) ?? [];
  for (const block of blocks) {
    const re = /<strong>([\s\S]*?)<\/strong>([\s\S]*?)(?=<strong>|<\/p>|$)/g;
    for (const m of block.matchAll(re)) {
      // 굵은 글씨 안에 "(필독) 안내문 <br> 구성" 처럼 안내문이 함께 들어있는 경우가 있어 마지막 줄만 항목 이름으로 씁니다.
      const lines = htmlToText(m[1]).split("\n");
      const key = (lines.pop() ?? "").trim();
      if (lines.length) specs["안내"] = [specs["안내"], lines.join(" ")].filter(Boolean).join(" / ");
      const value = htmlToText(m[2]).replace(/\n/g, " ").trim();
      if (key && value && key.length <= 12) specs[key] = specs[key] ? `${specs[key]} / ${value}` : value;
    }
  }
  return specs;
}

function parseReviews(pageHtml: string) {
  const reviews: { score: number; title: string; body: string }[] = [];
  const re =
    /class='jdgm-rev__rating' data-score='(\d)'[\s\S]*?<b class='jdgm-rev__title'>([\s\S]*?)<\/b>\s*<div class='jdgm-rev__body'>([\s\S]*?)<\/div>/g;
  for (const m of pageHtml.matchAll(re)) {
    reviews.push({ score: Number(m[1]), title: htmlToText(m[2]), body: htmlToText(m[3]).replace(/\n/g, " ") });
  }
  const badge = pageHtml.match(/data-average-rating='([\d.]+)' data-number-of-reviews='(\d+)'/);
  const avgMatch = badge && Number(badge[1]) > 0 ? badge : null;
  const count = badge ? Number(badge[2]) : reviews.length;
  const avg = avgMatch
    ? Number(avgMatch[1])
    : reviews.length
      ? reviews.reduce((a, r) => a + r.score, 0) / reviews.length
      : 0;
  return { reviews, count, avg: Math.round(avg * 10) / 10 };
}

async function main() {
  console.log("전집 전체 목록 불러오는 중...");
  const all = await collectionProducts(ALL_COLLECTION);
  const ageMap = new Map<number, string[]>();
  for (const [handle, label] of Object.entries(AGE_COLLECTIONS)) {
    for (const p of await collectionProducts(handle)) {
      ageMap.set(p.id, [...(ageMap.get(p.id) ?? []), label]);
      if (!all.some((a) => a.id === p.id)) all.push(p);
    }
  }
  console.log(`상품 ${all.length}개. 상세페이지 읽는 중...`);

  const products: Product[] = [];
  for (const [i, p] of all.entries()) {
    const url = `${SITE}/products/${encodeURIComponent(p.handle)}`;
    let page = "";
    try {
      page = await getText(url);
    } catch (e) {
      console.warn(`  상세페이지 실패: ${p.title} (${(e as Error).message})`);
    }
    const specs = parseSpecs(page);
    const { reviews, count, avg } = parseReviews(page);
    const ship = p.variants.find((v) => /ship/i.test(v.title)) ?? p.variants[0];
    const pick = p.variants.find((v) => /pick/i.test(v.title));
    const known = new Set(["구성", "연령", "세이펜"]);
    const extraSpecs = Object.entries(specs)
      .filter(([k]) => !known.has(k))
      .map(([k, v]) => `${k}: ${v}`);
    const description = [htmlToText(p.body_html), ...extraSpecs].filter(Boolean).join("\n").slice(0, 3000);

    products.push({
      id: String(p.id),
      title: p.title,
      url,
      publisher: p.vendor,
      ageLabel: specs["연령"] ?? "",
      ageCategories: ageMap.get(p.id) ?? [],
      composition: specs["구성"] ?? "",
      saypen: specs["세이펜"] ?? "",
      priceShipping: ship?.price ?? "",
      pricePickup: pick?.price ?? "",
      available: p.variants.some((v) => v.available),
      sku: ship?.sku ?? "",
      tags: p.tags,
      image: p.images[0]?.src ?? "",
      description,
      reviewCount: count,
      rating: avg,
      reviewHighlights: reviews
        .slice(0, 3)
        .map((r) => `★${r.score} ${r.title}: ${r.body}`.slice(0, 300))
        .join("\n"),
    });
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${all.length}`);
    await sleep(400); // 사이트에 부담 주지 않도록 천천히
  }

  products.sort((a, b) => a.title.localeCompare(b.title, "ko"));
  await writeFile("data/products.json", JSON.stringify(products, null, 2));
  console.log(`완료: data/products.json (${products.length}개)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
