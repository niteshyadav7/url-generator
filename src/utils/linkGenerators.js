/**
 * URL Link Generation Engine
 */
import { generateOrganicUrl } from './organicParams';
export const generators = {
  CLEAN: (asin, marketplace) => 
    `https://www.${marketplace}/dp/${asin}`,

  KEYWORD: (asin, marketplace, params) => {
    const keywordStr = params.keywords?.join('+') || '';
    return `https://www.${marketplace}/dp/${asin}?keywords=${encodeURIComponent(keywordStr)}`;
  },

  AFFILIATE: (asin, marketplace, params) => 
    `https://www.${marketplace}/dp/${asin}?tag=${params.affiliateTag}`,

  AFFILIATE_KEYWORD: (asin, marketplace, params) => {
    const keywordStr = params.keywords?.join('+') || '';
    return `https://www.${marketplace}/dp/${asin}?tag=${params.affiliateTag}&keywords=${encodeURIComponent(keywordStr)}`;
  },

  UTM: (asin, marketplace, params) => {
    const base = `https://www.${marketplace}/dp/${asin}`;
    const utm = new URLSearchParams();
    if (params.utmParams?.source) utm.set('utm_source', params.utmParams.source);
    if (params.utmParams?.medium) utm.set('utm_medium', params.utmParams.medium);
    if (params.utmParams?.campaign) utm.set('utm_campaign', params.utmParams.campaign);
    
    // Also include affiliate tag if present in UTM
    if (params.affiliateTag) utm.set('tag', params.affiliateTag);
    
    return `${base}?${utm.toString()}`;
  },

  SEARCH_PAGE: (_asin, marketplace, params) => {
    const keywordStr = params.keywords?.join('+') || '';
    return `https://www.${marketplace}/s?k=${encodeURIComponent(keywordStr)}`;
  },

  VARIANT: (asin, marketplace, params) => {
    const base = `https://www.${marketplace}/dp/${asin}`;
    if (!params.variantParams) return base;
    return `${base}?${params.variantParams}`;
  },

  CUSTOM_PARAMS: (asin, marketplace, params) => {
    const base = `https://www.${marketplace}/dp/${asin}`;
    const searchParams = new URLSearchParams();
    
    // Include affiliate tag if present
    if (params.affiliateTag) searchParams.set('tag', params.affiliateTag);
    
    // Include custom parameters
    if (params.customParams && Array.isArray(params.customParams)) {
      params.customParams.forEach(p => {
        if (p.key.trim() && p.value.trim()) {
          searchParams.set(p.key.trim(), p.value.trim());
        }
      });
    }
    
    const queryStr = searchParams.toString();
    return queryStr ? `${base}?${queryStr}` : base;
  },

  CUSTOM_TEMPLATE: (asin, marketplace, params) => {
    let template = params.customTemplate || '';
    if (!template.trim()) {
      return `https://yourbrand.com/go/${asin}`;
    }
    // Replace placeholders
    return template
      .replace(/{asin}/gi, asin)
      .replace(/{marketplace}/gi, marketplace)
      .replace(/{tag}/gi, params.affiliateTag || '');
  },

  ORGANIC: (asin, marketplace, params) => {
    // Flatten multi-word keyword tags into individual words
    const allWords = (params.keywords || [])
      .flatMap(k => k.split(/\s+/))
      .filter(w => w.length > 0);

    // Fall back to title slug words if no keywords entered
    let effectiveKeywords = allWords.length > 0
      ? allWords
      : (params.titleSlug || '')
          .split('-')
          .filter(w => w.length > 2)
          .slice(0, 5);

    if (effectiveKeywords.length === 0) {
      effectiveKeywords = [asin];
    }

    return generateOrganicUrl({
      asin,
      marketplace,
      titleSlug: params.titleSlug || '',
      keywords: effectiveKeywords,
      category: params.category || 'aps',
    });
  }
};

/**
 * High-level link generator dispatcher
 */
export function generateLinkUrl(type, asin, marketplace, params = {}) {
  const generator = generators[type];
  if (!generator) {
    throw new Error(`Unknown link type generator: ${type}`);
  }
  return generator(asin, marketplace, params);
}
