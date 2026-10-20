// Downloads seed content from the CURRENT PCI WordPress site's public REST API.
// Read-only: only anonymous GET requests to public endpoints; no credentials
// are used and nothing is written to the WordPress site.
//
// Output: prisma/seed-assets/{images…, manifest.json}
// Usage:  npm run seed:assets
import fs from "node:fs";
import path from "node:path";

const BASE = "https://premierchoiceint.com/wp-json/wp/v2";
const OUT = path.resolve("prisma/seed-assets");
fs.mkdirSync(OUT, { recursive: true });

const PROJECTS = {
  "grand-orchard": /^Grand-Orchard/i,
  "buraq-heights": /^Buraq-Heights/i,
  "river-courtyard": /^River-Courtyard-1-\d/i,
  "river-hills-5": /^River-Hills-5-\d/i,
  "box-park-2": /^Box-Park-2-\d/i,
  "grand-gallery": /^Grand-Gallery-\d/i,
  "spring-arch": /^Spring-Arch-\d/i,
  "roman-grove-1": /^Roman-Grove-1-2-\d/i,
  gateway: /^Gateway-\d/i,
};

// Marketing renders used for project cards / heroes (WordPress uploads 2024/01).
const CARD_IMAGES = {
  gateway: "2024/01/Gateway-v1.webp",
  "grand-orchard": "2024/01/Grand-Orchard-2.webp",
  "buraq-heights": "2024/01/Buraq-Heights-2.webp",
  "barari-views": "2024/01/Barari-Views-2.webp",
  "68-high-street": "2024/01/68-High-Street-1.webp",
  "box-park": "2024/01/Box-Park-1.webp",
  "river-courtyard": "2024/01/River-Courtyard-1.webp",
  "river-courtyard-2": "2024/01/River-Courtyard-2-1.webp",
  "stettler-crossroads": "2024/01/Stettler-Cross-Roads-1.webp",
  "river-hills-5": "2024/01/River-Hills-5.webp",
  "box-park-2": "2024/01/Box-Park-2-1.webp",
  "grand-gallery": "2024/01/Grand-Gallery-1.webp",
  fortunato: "2024/01/Fortunato-1.webp",
  "spring-arch": "2024/01/Spring-Arch-1.webp",
  "roman-grove-1": "2024/01/Roman-Grove-1.webp",
  "roman-grove-2": "2024/01/Roman-Grove-2-1.webp",
  "river-loft": "2024/01/River-Loft-2.webp",
  "river-hills-1": "2024/01/River-Hills.webp",
  "river-hills-2": "2024/01/River-Hills-2.webp",
  "river-hills-3": "2024/01/River-Hills-3.webp",
  "river-hills-4": "2024/01/River-Hills-4.webp",
};
const BRAND = {
  logo: "2024/07/pci-logo-color-64df0877a1ba1.webp",
  logoLight: "2019/10/pci-logo-1-1-64df092b687f2.webp",
  homeBanner: "2024/06/Home-Banner-3-new.webp",
  hilton: "2024/07/Hilton-Logo.webp",
};

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "PCI-Orbit seed import (read-only)" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function download(url, name) {
  const file = path.join(OUT, name);
  if (fs.existsSync(file)) return name;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return name;
}

const safe = (s) => s.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();

// 1. Media library index (with resized variants).
const media = [];
for (let page = 1; page < 30; page++) {
  const res = await fetch(`${BASE}/media?per_page=100&page=${page}&_fields=id,source_url,alt_text,media_details,date`);
  if (!res.ok) break;
  const items = await res.json();
  if (!items.length) break;
  media.push(...items);
}
console.log(`indexed ${media.length} media items`);
const rel = (m) => m.source_url.replace(/^https?:\/\/premierchoiceint\.com\/wp-content\/uploads\//, "");
const medium = (m) => {
  const s = m.media_details?.sizes ?? {};
  return (s["1536x1536"] ?? s.large ?? s.full ?? { source_url: m.source_url }).source_url;
};

const manifest = { brand: {}, cards: {}, updates: {}, posts: [] };

for (const [key, p] of Object.entries(BRAND)) {
  manifest.brand[key] = await download(`https://premierchoiceint.com/wp-content/uploads/${p}`, `brand-${safe(path.basename(p))}`);
}
for (const [slug, p] of Object.entries(CARD_IMAGES)) {
  try {
    manifest.cards[slug] = await download(`https://premierchoiceint.com/wp-content/uploads/${p}`, `card-${slug}${path.extname(p)}`);
  } catch (e) {
    console.warn("card missing", slug, e.message);
  }
}

// 2. Construction photos: two most recent months per ongoing project, up to 3 photos each.
for (const [slug, pattern] of Object.entries(PROJECTS)) {
  const matches = media.filter((m) => /^\d{4}\/\d{2}\//.test(rel(m)) && pattern.test(path.basename(rel(m))) && /\.(jpe?g|png|webp)$/i.test(rel(m)) && rel(m) >= "2025/");
  const byMonth = new Map();
  for (const m of matches) {
    const month = rel(m).slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(m);
  }
  const months = [...byMonth.keys()].sort().reverse().slice(0, 2);
  manifest.updates[slug] = [];
  for (const month of months) {
    const files = [];
    for (const m of byMonth.get(month).slice(0, 3)) {
      const url = medium(m);
      files.push(await download(url, `upd-${slug}-${month.replace("/", "-")}-${safe(path.basename(url))}`));
    }
    manifest.updates[slug].push({ month, files });
  }
  console.log(slug, months);
}

// 3. News posts with featured images (content is sanitised at seed time).
const posts = await getJson(`${BASE}/posts?per_page=50&_embed=wp:featuredmedia&_fields=id,slug,title,date,excerpt,content,_links,_embedded`);
for (const post of posts) {
  const fm = post._embedded?.["wp:featuredmedia"]?.[0];
  let cover = null;
  if (fm?.source_url) {
    const url = fm.media_details?.sizes?.large?.source_url ?? fm.source_url;
    try {
      cover = await download(url, `post-${safe(post.slug).slice(0, 60)}${path.extname(url)}`);
    } catch {
      cover = null;
    }
  }
  manifest.posts.push({
    slug: post.slug,
    title: post.title.rendered,
    date: post.date,
    excerpt: post.excerpt.rendered,
    content: post.content.rendered,
    cover,
    coverAlt: fm?.alt_text ?? "",
  });
}

fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("done:", Object.keys(manifest.cards).length, "cards,", manifest.posts.length, "posts");
