import axios from "axios";
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";

const BASE_URL = "https://lombahub.com";
const USER_AGENT = "PartnerinCompetitionBot";

const ALLOWED_HOSTS = new Set(["lombahub.com", "www.lombahub.com"]);

export interface LombaHubPreview {
  sourceUrl: string;
  namaLomba: string;
  penyelenggara: string | null;
  kategori: string | null;
  deadline: string | null;
  peserta: string | null;
  hadiah: string | null;
  biayaPendaftaran: string | null;
  tingkatLomba: string | null;
  infoPendaftaran: string | null;
  ketentuan: string | null;
  registrationUrl: string | null;
  gambarUrl: string | null;
}

export interface CrawlItem {
  sourceUrl: string;
  ok: boolean;
  data?: LombaHubPreview;
  error?: string;
}

let cachedRobots: any = undefined;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validateLombaHubUrl(rawUrl: string): URL {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL tidak valid.");
  }

  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password
  ) {
    throw new Error("URL harus berasal dari domain HTTPS LombaHub.");
  }

  url.hash = "";
  url.search = "";

  return url;
}

async function assertRobotsAllowed(url: URL): Promise<void> {
  if (cachedRobots === undefined) {
    try {
      const response = await axios.get<string>(`${BASE_URL}/robots.txt`, {
        timeout: 10000,
        maxRedirects: 2,
        responseType: "text",
        headers: {
          "User-Agent": USER_AGENT,
        },
      });

      cachedRobots = robotsParser(`${BASE_URL}/robots.txt`, response.data);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        cachedRobots = null;
      } else {
        throw new Error(
          "Aturan robots.txt tidak dapat diperiksa. " +
            "Hentikan crawling sampai aturan akses jelas.",
        );
      }
    }
  }

  if (
    cachedRobots &&
    cachedRobots.isAllowed(url.toString(), USER_AGENT) === false
  ) {
    throw new Error(`Crawling tidak diizinkan untuk halaman ${url.pathname}.`);
  }
}

async function fetchHtml(rawUrl: string): Promise<string> {
  const url = validateLombaHubUrl(rawUrl);

  await assertRobotsAllowed(url);

  const response = await axios.get<string>(url.toString(), {
    timeout: 15000,
    maxRedirects: 0,
    maxContentLength: 2 * 1024 * 1024,
    responseType: "text",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
    },
  });

  const contentType = String(
    response.headers["content-type"] || "",
  ).toLowerCase();

  if (!contentType.includes("text/html")) {
    throw new Error("Respons sumber bukan halaman HTML.");
  }

  return response.data;
}

function extractField(
  text: string,
  startLabels: string[],
  stopLabels: string[],
  maxLength = 1000,
): string | null {
  const lowerText = text.toLowerCase();

  let start = -1;
  let labelLength = 0;

  for (const label of startLabels) {
    const index = lowerText.indexOf(label.toLowerCase());

    if (index !== -1 && (start === -1 || index < start)) {
      start = index;
      labelLength = label.length;
    }
  }

  if (start === -1) {
    return null;
  }

  let valueStart = start + labelLength;

  while (valueStart < text.length && /[\s:：-]/.test(text[valueStart])) {
    valueStart++;
  }

  let valueEnd = text.length;

  for (const label of stopLabels) {
    const index = lowerText.indexOf(label.toLowerCase(), valueStart);

    if (index !== -1 && index < valueEnd) {
      valueEnd = index;
    }
  }

  const value = cleanText(text.slice(valueStart, valueEnd)).slice(0, maxLength);

  return value || null;
}

const MONTHS: Record<string, number> = {
  januari: 1,
  january: 1,
  jan: 1,
  februari: 2,
  february: 2,
  feb: 2,
  maret: 3,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  may: 5,
  juni: 6,
  june: 6,
  jun: 6,
  juli: 7,
  july: 7,
  jul: 7,
  agustus: 8,
  august: 8,
  agu: 8,
  aug: 8,
  september: 9,
  sep: 9,
  oktober: 10,
  october: 10,
  okt: 10,
  oct: 10,
  november: 11,
  nov: 11,
  desember: 12,
  december: 12,
  des: 12,
  dec: 12,
};

function parseDeadline(text: string | null): string | null {
  if (!text) return null;

  let day: number;
  let month: number;
  let year: number;

  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);

  if (numeric) {
    day = Number(numeric[1]);
    month = Number(numeric[2]);
    year = Number(numeric[3]);
  } else {
    const named = text.match(/\b(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})\b/i);

    if (!named) return null;

    day = Number(named[1]);
    month = MONTHS[named[2].toLowerCase()] || 0;
    year = Number(named[3]);
  }

  if (!month || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return [
    year,
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function extractRegistrationUrl(
  $: cheerio.CheerioAPI,
  pageUrl: URL,
  pageText: string,
): string | null {
  const normalizeUrl = (rawUrl: string): string | null => {
    try {
      const cleanedUrl = rawUrl.replace(/[.,!?;:*]+$/, "");
      const url = new URL(cleanedUrl, pageUrl);

      if (
        !["http:", "https:"].includes(url.protocol) ||
        ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ||
        url.hostname.toLowerCase() === "api.lombahub.com" ||
        /\.(jpg|jpeg|png|webp|gif|svg|pdf)$/i.test(url.pathname)
      ) {
        return null;
      }

      return url.toString();
    } catch {
      return null;
    }
  };

  const patterns = [
    /(?:link\s*pendaftaran(?:\s*\([^)]*\))?|registration\s*link)\s*[:：-]?\s*(https?:\/\/[^\s<>"')\]}]+)/i,
    /(?:daftar\s+sekarang(?:\s+di)?|register\s+now|link\s+registrasi|registration\s+form)\s*[:：-]?\s*(https?:\/\/[^\s<>"')\]}]+)/i,
  ];

  for (const pattern of patterns) {
    const match = pageText.match(pattern);

    if (match?.[1]) {
      const url = normalizeUrl(match[1]);

      if (url) {
        return url;
      }
    }
  }

  const candidates: string[] = [];

  $("a[href]").each((_, element) => {
    const anchorText = cleanText($(element).text());
    const href = $(element).attr("href");

    if (
      !href ||
      !/daftar|registrasi|registration|register/i.test(anchorText) ||
      /guidebook|buku panduan/i.test(anchorText)
    ) {
      return;
    }

    const url = normalizeUrl(href);

    if (url) {
      candidates.push(url);
    }
  });

  return candidates[0] ?? null;
}

function extractEventDescription(
  pageText: string,
  namaLomba: string,
): string | null {
  const markers = [
    /OPEN REGISTRATION\b/i,
    /DAFTAR SEKARANG\b/i,
    /Gratis\.\s*Tanpa perlu bisa coding/i,
  ];

  let selected: { index: number; match: string } | undefined;

  for (const marker of markers) {
    const match = marker.exec(pageText);

    if (match && (!selected || match.index < selected.index)) {
      selected = {
        index: match.index,
        match: match[0],
      };
    }
  }

  if (!selected) {
    return null;
  }

  let description = pageText.slice(selected.index + selected.match.length);

  const normalizedDescription = description.trim().toLowerCase();

  const normalizedTitle = namaLomba.toLowerCase();

  if (normalizedDescription.startsWith(normalizedTitle)) {
    description = description.trim().slice(namaLomba.length);
  }

  const footerMatch =
    /Dibuat pada|Disunting pada|\(Validitas informasi|Jelajahi kompetisi terkait/i.exec(
      description,
    );

  if (footerMatch) {
    description = description.slice(0, footerMatch.index);
  }

  const result = cleanText(description)
    .replace(/^[\]\[|:—–\s]+/, "")
    .trim();

  return result.length >= 20 ? result.slice(0, 4000) : null;
}

export async function scrapeLombaHubDetail(
  rawUrl: string,
): Promise<LombaHubPreview> {
  const pageUrl = validateLombaHubUrl(rawUrl);

  if (!pageUrl.pathname.startsWith("/kompetisi-lomba/")) {
    throw new Error("Masukkan URL detail lomba, bukan halaman utama.");
  }

  const html = await fetchHtml(pageUrl.toString());
  const $ = cheerio.load(html);

  $("script, style, noscript, iframe, svg").remove();

  $("h1, h2, h3, h4, h5, p, li, section, article, div, br").each(
    (_, element) => {
      $(element).prepend(" ").append(" ");
    },
  );

  const rawTitle = cleanText(
    $("h1").first().text() ||
      $('meta[property="og:title"]').attr("content") ||
      "",
  );

  const namaLomba = cleanText(
    rawTitle.replace(/\s*[-|]\s*LombaHub\.com\s*$/i, ""),
  );

  if (!namaLomba) {
    throw new Error("Nama lomba tidak ditemukan.");
  }

  const pageText = cleanText($("body").text());

  const deadlineText = extractField(
    pageText,
    ["Deadline Pendaftaran"],
    ["Total Hadiah", "Peserta", "Penyelenggara"],
    150,
  );

  const hadiahMetadata = extractField(
    pageText,
    ["Total Hadiah"],
    ["Peserta", "Penyelenggara", "Open Registration"],
    250,
  );

  const adaKlaimHadiahJutaan = /TOTAL PRIZES WORTH MILLIONS OF RUPIAH/i.test(
    pageText,
  );

  const hadiah =
    adaKlaimHadiahJutaan &&
    hadiahMetadata &&
    /rp\s*10(?:[.]?000)\b/i.test(hadiahMetadata)
      ? null
      : hadiahMetadata;

  const peserta = extractField(
    pageText,
    ["Peserta"],
    ["Penyelenggara", "Open Registration"],
    250,
  );

  const penyelenggara = extractField(
    pageText,
    ["Penyelenggara"],
    [
      "OPEN REGISTRATION",
      "Daftar Sekarang",
      "Deadline Pendaftaran",
      "Total Hadiah",
      "Peserta",
      "Dibuat pada",
      "Disunting pada",
      "Validitas informasi",
      "Jelajahi kompetisi terkait",
      "Gratis.",
      "Yang kamu dapat:",
      "Yang perlu kamu tahu:",
    ],
    150,
  );

  const biaya = extractField(
    pageText,
    ["HTM (Registration Fee)", "Biaya Pendaftaran", "Registration Fee", "HTM"],
    [
      "Metode Pembayaran",
      "Payment Method",
      "Benefits",
      "Benefit Peserta",
      "Daftar Sekarang",
      "Contact Person",
      "Dibuat pada",
      "Disunting pada",
      "Validitas informasi",
      "Jelajahi kompetisi terkait",
    ],
    1000,
  );

  const biayaFinal =
    biaya ??
    (/Gratis\.\s*Tanpa perlu bisa coding/i.test(pageText) ? "Gratis" : null);

  const ketentuan = extractField(
    pageText,
    ["Syarat dan Ketentuan", "Persyaratan", "Yang perlu kamu tahu:"],
    [
      "Yang kamu dapat:",
      "Tiga pemilik usaha asli",
      "Daftar sekarang di:",
      "Contact Person",
      "Dibuat pada",
      "Disunting pada",
      "Validitas informasi",
      "Jelajahi kompetisi terkait",
    ],
    3000,
  );

  const extractedDescription = extractEventDescription(pageText, namaLomba);

  const metadataDescription = cleanText(
    $("meta[name='description']").attr("content") ||
      $("meta[property='og:description']").attr("content") ||
      "",
  );

  const isGenericMetadata =
    /info lomba terbaru/i.test(metadataDescription) &&
    /situs web informasi lomba/i.test(metadataDescription);

  const isSameAsTitle =
    metadataDescription.toLowerCase() === namaLomba.toLowerCase();

  const description =
    extractedDescription ||
    (metadataDescription && !isGenericMetadata && !isSameAsTitle
      ? metadataDescription
      : null);

  const categoryTags = new Set<string>();

  $("a").each((_, element) => {
    const anchorText = cleanText($(element).text());
    const match = anchorText.match(/^Kategori\s+(.+)$/i);

    if (match) {
      categoryTags.add(cleanText(match[1]));
    }
  });

  const category =
    cleanText($('meta[property="article:section"]').attr("content") || "") ||
    (categoryTags.size > 0 ? Array.from(categoryTags).join(", ") : null);

  const detectedLevels = new Set<string>();

  if (/\bNasional\b|\bNational Level\b/i.test(pageText)) {
    detectedLevels.add("Nasional");
  }

  if (/\bInternasional\b|\bInternational Level\b/i.test(pageText)) {
    detectedLevels.add("Internasional");
  }

  if (/\bRegional\b/i.test(pageText)) {
    detectedLevels.add("Regional");
  }

  if (/\bProvinsi\b/i.test(pageText)) {
    detectedLevels.add("Provinsi");
  }

  if (/\bKota\/Kabupaten\b/i.test(pageText)) {
    detectedLevels.add("Kota/Kabupaten");
  }

  const tingkatLomba =
    detectedLevels.size > 0 ? Array.from(detectedLevels).join(" & ") : null;

  const sourceUrl = pageUrl.toString();

  return {
    sourceUrl,
    namaLomba,
    penyelenggara: penyelenggara?.replace(/[\[\]]/g, "").trim() || null,
    kategori: category || null,
    deadline: parseDeadline(deadlineText),
    peserta,
    hadiah,
    biayaPendaftaran: biayaFinal?.replace(/\s*💳\s*$/, "").trim() || null,
    tingkatLomba,
    infoPendaftaran: description || null,
    ketentuan,
    registrationUrl: extractRegistrationUrl($, pageUrl, pageText),
    gambarUrl: $('meta[property="og:image"]').attr("content") || null,
  };
}

function createFallbackLomba(sourceUrl: string): LombaHubPreview {
  const slug =
    new URL(sourceUrl).pathname.split("/").filter(Boolean).pop() ?? "";

  const namaLomba = decodeURIComponent(slug)
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    sourceUrl,
    namaLomba: namaLomba || "Lomba dari LombaHub",
    penyelenggara: null,
    kategori: null,
    deadline: null,
    peserta: null,
    hadiah: null,
    biayaPendaftaran: null,
    tingkatLomba: null,
    infoPendaftaran: null,
    ketentuan: null,
    registrationUrl: null,
    gambarUrl: null,
  };
}

export async function crawlLombaHubHomepage(limit = 5): Promise<CrawlItem[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 8) {
    throw new Error("Limit crawling harus antara 1 dan 8.");
  }

  const html = await fetchHtml(`${BASE_URL}/`);
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");

    if (!href) return;

    try {
      const url = new URL(href, BASE_URL);

      if (
        !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ||
        !url.pathname.startsWith("/kompetisi-lomba/")
      ) {
        return;
      }

      url.hash = "";
      url.search = "";

      urls.add(url.toString());
    } catch {}
  });

  const selectedUrls = Array.from(urls).slice(0, limit);

  if (selectedUrls.length === 0) {
    throw new Error(
      "Tidak ada URL detail lomba yang ditemukan di halaman utama.",
    );
  }

  const results: CrawlItem[] = [];

  for (let i = 0; i < selectedUrls.length; i++) {
    const sourceUrl = selectedUrls[i];

    if (i > 0) {
      await sleep(1500);
    }

    try {
      const data = await scrapeLombaHubDetail(sourceUrl);

      results.push({
        sourceUrl,
        ok: true,
        data,
      });
    } catch (error: unknown) {
      results.push({
        sourceUrl,
        ok: false,
        data: createFallbackLomba(sourceUrl),
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengambil halaman detail.",
      });
    }
  }

  return results;
}
