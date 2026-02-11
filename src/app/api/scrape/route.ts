import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

function parseViewCount(str: string): number {
  const lower = str.toLowerCase().replace(/,/g, "");
  if (lower.endsWith("k")) return Math.round(parseFloat(lower) * 1000);
  if (lower.endsWith("m")) return Math.round(parseFloat(lower) * 1000000);
  if (lower.endsWith("b")) return Math.round(parseFloat(lower) * 1000000000);
  return parseInt(lower, 10);
}

interface ScrapeResult {
  views: number | null;
  creator: string | null;
}

async function scrapeTikTok(url: string): Promise<ScrapeResult> {
  let creator: string | null = null;
  let views: number | null = null;

  // Extract creator from URL pattern (@username)
  const urlCreator = url.match(/@([a-zA-Z0-9_.]+)/);
  if (urlCreator) creator = urlCreator[1];

  // Try oEmbed — has author_name
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const oembedRes = await fetch(oembedUrl, {
      headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] },
    });
    if (oembedRes.ok) {
      const data = await oembedRes.json();
      if (data.author_name) creator = data.author_name;
      if (data.view_count) views = data.view_count;
      if (views) return { views, creator };
    }
  } catch {}

  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
  if (!res.ok) throw new Error(`TikTok returned ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Try to get creator from page data
  const authorMatch = html.match(/"author"\s*:\s*\{[^}]*"uniqueId"\s*:\s*"([^"]+)"/);
  if (authorMatch && !creator) creator = authorMatch[1];
  const nicknameMatch = html.match(/"nickname"\s*:\s*"([^"]+)"/);
  if (nicknameMatch && !creator) creator = nicknameMatch[1];

  const universalScript = $("#__UNIVERSAL_DATA_FOR_REHYDRATION__").html();
  if (universalScript) {
    try {
      const data = JSON.parse(universalScript);
      const defaultScope = data["__DEFAULT_SCOPE__"];
      if (defaultScope) {
        const videoDetail = defaultScope["webapp.video-detail"];
        if (videoDetail?.itemInfo?.itemStruct?.stats?.playCount != null) {
          views = videoDetail.itemInfo.itemStruct.stats.playCount;
        }
        const author = videoDetail?.itemInfo?.itemStruct?.author;
        if (author?.uniqueId && !creator) creator = author.uniqueId;
        if (author?.nickname && !creator) creator = author.nickname;
      }
      if (!views) {
        const jsonStr = JSON.stringify(data);
        const m = jsonStr.match(/"playCount"\s*:\s*(\d+)/);
        if (m) views = parseInt(m[1], 10);
      }
    } catch {}
  }

  if (!views) {
    const sigiScript = $("#SIGI_STATE").html() || $("#sigi-persisted-data").html();
    if (sigiScript) {
      try {
        const jsonStr = JSON.stringify(JSON.parse(sigiScript));
        const m = jsonStr.match(/"playCount"\s*:\s*(\d+)/);
        if (m) views = parseInt(m[1], 10);
      } catch {}
    }
  }

  if (!views) {
    const rawMatch = html.match(/"playCount"\s*:\s*(\d+)/);
    if (rawMatch) views = parseInt(rawMatch[1], 10);
  }

  if (!views) {
    const metaContent = $('meta[property="og:description"]').attr("content") || "";
    const viewMatch = metaContent.match(/([\d.]+[KkMm]?)\s*(?:views|Likes)/i);
    if (viewMatch) views = parseViewCount(viewMatch[1]);
  }

  return { views, creator };
}

async function scrapeFacebook(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
  if (!res.ok) throw new Error(`Facebook returned ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  let views: number | null = null;
  let creator: string | null = null;

  // FB og:title format: "81M views · 952K reactions | caption text | CreatorName"
  const ogTitle = $('meta[property="og:title"]').attr("content") || "";
  const ogTitleMatch = ogTitle.match(/(\d[\d,.]*[KkMm]?)\s*views/i);
  if (ogTitleMatch) views = parseViewCount(ogTitleMatch[1]);
  // Creator is typically after the last pipe
  const titleParts = ogTitle.split("|").map((s: string) => s.trim());
  if (titleParts.length > 1) creator = titleParts[titleParts.length - 1];

  if (!views) {
    const ogDesc = $('meta[property="og:description"]').attr("content") || "";
    const ogDescMatch = ogDesc.match(/(\d[\d,.]*[KkMm]?)\s*views/i);
    if (ogDescMatch) views = parseViewCount(ogDescMatch[1]);
  }

  if (!views) {
    const htmlPatterns = [
      /"video_view_count"\s*:\s*(\d+)/,
      /"view_count"\s*:\s*(\d+)/,
      /"play_count"\s*:\s*(\d+)/,
      /"viewCount"\s*:\s*"?(\d+)/,
      /"interactionCount"\s*:\s*"?(\d+)/,
    ];
    for (const p of htmlPatterns) {
      const m = html.match(p);
      if (m) { views = parseInt(m[1], 10); break; }
    }
  }

  if (!views) {
    const rawMatch = html.match(/(\d[\d,.]*[KkMm]?)\s*views/i);
    if (rawMatch) views = parseViewCount(rawMatch[1]);
  }

  return { views, creator };
}

async function scrapeInstagram(url: string): Promise<ScrapeResult> {
  const shortcodeMatch = url.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  const shortcode = shortcodeMatch ? shortcodeMatch[2] : null;
  if (!shortcode) return { views: null, creator: null };

  // Step 1: Get username from reel page og:description
  const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
  if (!res.ok) throw new Error(`Instagram returned ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const ogDesc = $('meta[property="og:description"]').attr("content") || "";
  const usernameMatch = ogDesc.match(/- ([a-zA-Z0-9_.]+) on /);
  const username = usernameMatch?.[1];
  if (!username) return { views: null, creator: null };

  // Step 2: Use Puppeteer to render the reels page and extract view counts
  const puppeteer = await import("puppeteer");
  let browser = null;
  try {
    const launchOptions: Record<string, unknown> = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browser = await puppeteer.default.launch(launchOptions);
    const page = await browser.newPage();
    await page.setUserAgent(BROWSER_HEADERS["User-Agent"]);
    await page.setViewport({ width: 1280, height: 900 });

    // Navigate to the creator's reels page
    const reelsUrl = `https://www.instagram.com/${username}/reels/`;
    await page.goto(reelsUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait a bit for dynamic content to load
    await new Promise((r) => setTimeout(r, 3000));

    // Extract reel data from the rendered page
    const result = await page.evaluate((targetShortcode: string) => {
      // Find all links that contain reel shortcodes
      const links = document.querySelectorAll('a[href*="/reel/"]');
      const reels: { shortcode: string; views: string | null }[] = [];

      for (const link of Array.from(links)) {
        const href = link.getAttribute("href") || "";
        const scMatch = href.match(/\/reel\/([A-Za-z0-9_-]+)/);
        if (!scMatch) continue;
        const sc = scMatch[1];

        // Look for view count near this link element
        // Instagram shows views as overlay text on reel thumbnails
        const container = link.closest("div") || link;
        const allText = container.textContent || "";

        // Look for patterns like "1.2M", "234K", "12,345", etc. followed by views/plays
        const viewMatch = allText.match(/(\d[\d,.]*[KkMm]?)\s*(?:views|plays)/i);
        // Also check for just numbers with K/M suffix (IG sometimes shows just the number)
        const numMatch = allText.match(/(\d[\d,.]*[KkMm])/);

        reels.push({
          shortcode: sc,
          views: viewMatch?.[1] || numMatch?.[1] || null,
        });
      }

      // Find our target reel
      const target = reels.find((r) => r.shortcode === targetShortcode);

      // Also try: look for any element with the shortcode and find nearby view count
      if (!target?.views) {
        // Search all elements for the shortcode
        const allElements = document.querySelectorAll("*");
        for (const el of Array.from(allElements)) {
          const html = el.innerHTML || "";
          if (html.includes(targetShortcode) && html.includes("views")) {
            const m = html.match(/(\d[\d,.]*[KkMm]?)\s*views/i);
            if (m) return { found: true, views: m[1], method: "innerHTML" };
          }
        }
      }

      // Try to get view count from SVG overlays or span elements near the reel
      if (!target?.views) {
        const allSpans = document.querySelectorAll("span");
        const viewSpans: string[] = [];
        for (const span of Array.from(allSpans)) {
          const text = span.textContent?.trim() || "";
          if (/^\d[\d,.]*[KkMm]?$/.test(text)) {
            viewSpans.push(text);
          }
        }
        return {
          found: false,
          reelCount: reels.length,
          reels: reels.slice(0, 10),
          viewSpans: viewSpans.slice(0, 20),
          bodyTextSample: document.body?.textContent?.slice(0, 500) || "",
        };
      }

      return { found: true, views: target.views, method: "link" };
    }, shortcode);

    if (result && "found" in result && result.found && result.views) {
      return { views: parseViewCount(result.views), creator: username };
    }

    return { views: null, creator: username };
  } catch {
    return { views: null, creator: username };
  } finally {
    if (browser) await browser.close();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, platform } = await request.json();

    if (!url || !platform) {
      return NextResponse.json(
        { success: false, error: "URL and platform are required" },
        { status: 400 }
      );
    }

    let result: ScrapeResult = { views: null, creator: null };
    let error: string | undefined;

    try {
      switch (platform) {
        case "tiktok":
          result = await scrapeTikTok(url);
          break;
        case "instagram":
          result = await scrapeInstagram(url);
          break;
        case "facebook":
          result = await scrapeFacebook(url);
          break;
        default:
          return NextResponse.json(
            { success: false, error: `Unsupported platform: ${platform}` },
            { status: 400 }
          );
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : "Unknown scraping error";
    }

    if (result.views !== null) {
      return NextResponse.json({ success: true, views: result.views, creator: result.creator, platform });
    } else {
      return NextResponse.json({
        success: false,
        views: null,
        creator: result.creator,
        platform,
        error: error || `Could not extract view count from ${platform}.`,
      });
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
