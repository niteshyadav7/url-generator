/**
 * Organic Amazon URL Parameter Generator
 * Creates realistic-looking Amazon search result URL parameters
 * so generated links are indistinguishable from real search clicks.
 */

const CRID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const B64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function randomString(length, charset) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Generate CRID — Amazon search session identifier.
 * Format: 12–13 char uppercase alphanumeric.
 */
export function generateCrid() {
  return randomString(12 + Math.floor(Math.random() * 2), CRID_CHARS);
}

/**
 * Generate DIB — Amazon search digest / session token.
 * Format: JWT-like base64url string  header.payload.signature
 * Header is always eyJ2IjoiMSJ9 (base64url of {"v":"1"}).
 */
export function generateDib() {
  const header = 'eyJ2IjoiMSJ9';
  const payloadLen = 120 + Math.floor(Math.random() * 60);   // 120-179 chars
  const sigLen     = 40  + Math.floor(Math.random() * 8);    // 40-47 chars
  return `${header}.${randomString(payloadLen, B64URL_CHARS)}.${randomString(sigLen, B64URL_CHARS)}`;
}

/**
 * Generate QID — query timestamp.
 * 10-digit Unix epoch with a small random offset (±5 min) per call.
 */
export function generateQid() {
  const now = Math.floor(Date.now() / 1000);
  const drift = Math.floor(Math.random() * 600) - 300; // ±300 s
  return String(now + drift);
}

/**
 * Pick a weighted-random search-result position (1–48).
 * Skews toward early positions like real user clicks.
 */
export function generatePosition() {
  const r = Math.random() * 100;
  if (r < 40) return 1 + Math.floor(Math.random() * 5);    // 1-5   (40 %)
  if (r < 75) return 6 + Math.floor(Math.random() * 11);   // 6-16  (35 %)
  if (r < 90) return 17 + Math.floor(Math.random() * 16);  // 17-32 (15 %)
  return 33 + Math.floor(Math.random() * 16);               // 33-48 (10 %)
}

/**
 * Amazon store / category codes.
 */
export const AMAZON_CATEGORIES = [
  { code: 'aps',             label: 'All Departments' },
  { code: 'hpc',             label: 'Health & Personal Care' },
  { code: 'beauty',          label: 'Beauty' },
  { code: 'electronics',     label: 'Electronics' },
  { code: 'fashion',         label: 'Clothing & Accessories' },
  { code: 'kitchen',         label: 'Home & Kitchen' },
  { code: 'books',           label: 'Books' },
  { code: 'toys',            label: 'Toys & Games' },
  { code: 'sports',          label: 'Sports & Fitness' },
  { code: 'grocery',         label: 'Grocery & Gourmet' },
  { code: 'automotive',      label: 'Car & Motorbike' },
  { code: 'baby',            label: 'Baby Products' },
  { code: 'garden',          label: 'Garden & Outdoors' },
  { code: 'office-products', label: 'Office Products' },
  { code: 'pet-supplies',    label: 'Pet Supplies' },
  { code: 'shoes',           label: 'Shoes & Handbags' },
  { code: 'watches',         label: 'Watches' },
  { code: 'computers',       label: 'Computers & Accessories' },
  { code: 'mobile-phones',   label: 'Smartphones' },
  { code: 'appliances',      label: 'Home Appliances' },
];

/**
 * Assemble a complete organic Amazon search-result URL.
 *
 * @param {Object} opts
 * @param {string}   opts.asin         - 10-char Amazon ASIN
 * @param {string}   opts.marketplace  - e.g. "amazon.in"
 * @param {string}   opts.titleSlug    - product-name slug from URL path (optional)
 * @param {string[]} opts.keywords     - individual search-term words
 * @param {string}   opts.category     - store category code (default "aps")
 * @returns {string} Full organic URL
 */
export function generateOrganicUrl({
  asin,
  marketplace,
  titleSlug = '',
  keywords = [],
  category = 'aps',
}) {
  const pos  = generatePosition();
  const crid = generateCrid();
  const dib  = generateDib();
  const qid  = generateQid();

  // ---- path ----
  const slugPart = titleSlug ? `/${titleSlug}` : '';
  const path = `https://www.${marketplace}${slugPart}/dp/${asin}/ref=sr_1_${pos}`;

  // ---- keywords  (joined with %2B like real Amazon URLs) ----
  const keywordStr = keywords
    .map(w => encodeURIComponent(w))
    .join('%2B');

  // ---- sprefix   (truncated keywords + category + 3-digit number) ----
  const rawKw     = keywords.join('+');
  const truncLen  = Math.max(3, rawKw.length - Math.floor(Math.random() * 4));
  const truncated = rawKw.substring(0, truncLen);
  const truncEnc  = encodeURIComponent(truncated).replace(/%20/g, '+');
  const suffixNum = 200 + Math.floor(Math.random() * 200);

  // ---- query string (hand-built to match Amazon's exact format) ----
  const parts = [
    `crid=${crid}`,
    `dib=${dib}`,
    `dib_tag=se`,
    `keywords=${keywordStr}`,
    `qid=${qid}`,
  ];

  if (category && category !== 'aps') {
    parts.push(`s=${category}`);
  }

  parts.push(`sprefix=${truncEnc}%2C${category}%2C${suffixNum}`);
  parts.push(`sr=1-${pos}`);
  parts.push(`th=1`);

  return `${path}?${parts.join('&')}`;
}

/**
 * Auto-detect a realistic Amazon category code from the product title slug
 */
export function detectCategoryFromSlug(slug) {
  if (!slug) return 'aps';
  const clean = slug.toLowerCase();

  const mappings = [
    { code: 'hpc', keywords: ['underarm', 'detanning', 'spotlite', 'sanfe', 'skin', 'cream', 'serum', 'body', 'wash', 'face', 'shampoo', 'hair', 'soap', 'oil', 'gel', 'lotion', 'hygiene', 'personal', 'care', 'health', 'wellness', 'supplement', 'vitamin'] },
    { code: 'beauty', keywords: ['makeup', 'lipstick', 'liner', 'mascara', 'foundation', 'eyebrow', 'perfume', 'fragrance', 'grooming', 'trimmer', 'shaver', 'wax', 'hair-styling'] },
    { code: 'electronics', keywords: ['phone', 'mobile', 'charger', 'cable', 'earphone', 'headphone', 'speaker', 'camera', 'lens', 'tripod', 'powerbank', 'adapter', 'tv', 'television', 'audio'] },
    { code: 'computers', keywords: ['laptop', 'pc', 'monitor', 'keyboard', 'mouse', 'router', 'wifi', 'hard-drive', 'ssd', 'usb', 'ram', 'motherboard', 'printer'] },
    { code: 'fashion', keywords: ['shirt', 'pant', 'dress', 'jeans', 'tshirt', 't-shirt', 'jacket', 'coat', 'sweater', 'socks', 'underwear', 'clothing', 'apparel'] },
    { code: 'shoes', keywords: ['shoe', 'sneaker', 'boot', 'sandal', 'slipper', 'bag', 'backpack', 'handbag', 'wallet', 'purse'] },
    { code: 'watches', keywords: ['watch', 'smartwatch', 'clock', 'timepiece'] },
    { code: 'kitchen', keywords: ['kitchen', 'cooker', 'pan', 'bottle', 'knife', 'spoon', 'fork', 'cup', 'mug', 'blender', 'toaster', 'mixer', 'cookware', 'oven'] },
    { code: 'appliances', keywords: ['fridge', 'refrigerator', 'washing-machine', 'dryer', 'dishwasher', 'vacuum', 'ac', 'air-conditioner', 'heater'] },
    { code: 'books', keywords: ['book', 'novel', 'paperback', 'hardcover', 'dictionary', 'biography', 'story'] },
    { code: 'toys', keywords: ['toy', 'game', 'puzzle', 'doll', 'action-figure', 'boardgame', 'lego', 'clay'] },
    { code: 'sports', keywords: ['sport', 'fitness', 'dumbbells', 'yoga', 'mat', 'treadmill', 'cycle', 'racket', 'bat', 'ball', 'gym'] },
    { code: 'grocery', keywords: ['tea', 'coffee', 'snack', 'spices', 'salt', 'sugar', 'rice', 'dal', 'oil', 'honey', 'chocolate', 'cookie', 'biscuit', 'food'] },
    { code: 'baby', keywords: ['baby', 'diaper', 'wipes', 'stroller', 'crib', 'pacifier', 'feeder', 'infant'] },
    { code: 'pet-supplies', keywords: ['dog', 'cat', 'pet', 'aquarium', 'fish', 'bird', 'leash', 'collar', 'kibble'] },
    { code: 'automotive', keywords: ['car', 'bike', 'helmet', 'tyre', 'tire', 'polish', 'wiper', 'seat-cover'] }
  ];

  for (const map of mappings) {
    if (map.keywords.some(kw => clean.includes(kw))) {
      return map.code;
    }
  }

  return 'aps'; // Default to All Departments
}
