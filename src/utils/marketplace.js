/**
 * Amazon Marketplace detection and metadata library.
 */
export const MARKETPLACES = {
  'amazon.com': { domain: 'amazon.com', code: 'US', currency: '$', country: 'United States' },
  'amazon.in': { domain: 'amazon.in', code: 'IN', currency: '₹', country: 'India' },
  'amazon.co.uk': { domain: 'amazon.co.uk', code: 'UK', currency: '£', country: 'United Kingdom' },
  'amazon.ca': { domain: 'amazon.ca', code: 'CA', currency: 'CA$', country: 'Canada' },
  'amazon.de': { domain: 'amazon.de', code: 'DE', currency: '€', country: 'Germany' },
  'amazon.fr': { domain: 'amazon.fr', code: 'FR', currency: '€', country: 'France' },
  'amazon.it': { domain: 'amazon.it', code: 'IT', currency: '€', country: 'Italy' },
  'amazon.es': { domain: 'amazon.es', code: 'ES', currency: '€', country: 'Spain' },
  'amazon.co.jp': { domain: 'amazon.co.jp', code: 'JP', currency: '¥', country: 'Japan' },
  'amazon.com.au': { domain: 'amazon.com.au', code: 'AU', currency: 'A$', country: 'Australia' },
  'amazon.com.br': { domain: 'amazon.com.br', code: 'BR', currency: 'R$', country: 'Brazil' },
  'amazon.com.mx': { domain: 'amazon.com.mx', code: 'MX', currency: 'MX$', country: 'Mexico' }
};

/**
 * Detects Amazon marketplace from a given URL hostname.
 */
export function detectMarketplace(url) {
  if (!url) return MARKETPLACES['amazon.com'];
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    
    // Check direct matches
    if (MARKETPLACES[hostname]) {
      return MARKETPLACES[hostname];
    }
    
    // Check partial matches (e.g. if host contains 'amazon.in' etc)
    for (const key of Object.keys(MARKETPLACES)) {
      if (hostname.includes(key)) {
        return MARKETPLACES[key];
      }
    }
  } catch {
    // Ignore URL parse error
  }
  
  return MARKETPLACES['amazon.com'];
}
