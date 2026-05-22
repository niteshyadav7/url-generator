/**
 * Universal Amazon ASIN Extractor
 * Extracts 10-character Amazon standard identification numbers (ASIN) from any Amazon product URL.
 */
export function extractASIN(url) {
  if (!url) return null;

  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/ASIN\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})(?:[/?]|$)/i // Fallback pattern
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

/**
 * Checks if the URL has an Amazon domain.
 */
export function isValidAmazonUrl(url) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes('amazon.');
  } catch {
    return false;
  }
}

/**
 * Extracts the product title slug from an Amazon URL path.
 * e.g. "Sanfe-Spotlite-Underrams-Detanning-Tightening" from
 * https://www.amazon.in/Sanfe-Spotlite-Underrams-Detanning-Tightening/dp/B0CJRTFY9F
 */
export function extractTitleSlug(url) {
  if (!url) return '';
  try {
    const path = new URL(url).pathname;
    const match = path.match(/^\/([^/]+)\/dp\//i);
    if (match && match[1] && match[1].length > 2 && match[1] !== 'dp' && match[1] !== 'gp') {
      return match[1];
    }
  } catch { /* ignore */ }
  return '';
}
