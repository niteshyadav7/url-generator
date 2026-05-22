const SETTINGS_KEY = 'amzlinker_settings';
const LINKS_KEY = 'amzlinker_generated_links';
const KEYWORDS_KEY = 'amzlinker_keywords';

export const LOCAL_USER = {
  id: 'local-user',
  email: 'local@amzlinker.app',
  name: 'Local Operator',
};

const defaultSettings = {
  affiliateTag: '',
  defaultMarketplace: 'amazon.in',
  theme: 'dark',
};

const seedKeywords = [
  { id: 'kw_1', name: 'beauty care', usage_count: 14, category: 'beauty' },
  { id: 'kw_2', name: 'skincare serum', usage_count: 9, category: 'beauty' },
  { id: 'kw_3', name: 'ergonomic chair', usage_count: 5, category: 'furniture' },
  { id: 'kw_4', name: 'mechanical keyboard', usage_count: 12, category: 'electronics' },
  { id: 'kw_5', name: 'usb hub adapter', usage_count: 3, category: 'electronics' },
];

function hasStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readJson(key, fallback) {
  if (!hasStorage()) return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (err) {
    console.warn(`Unable to read ${key} from local storage:`, err);
    return fallback;
  }
}

function writeJson(key, value) {
  if (!hasStorage()) return value;

  window.localStorage.setItem(key, JSON.stringify(value));
  return value;
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getSettings() {
  return {
    ...defaultSettings,
    ...readJson(SETTINGS_KEY, {}),
  };
}

export function saveSettings(settings) {
  return writeJson(SETTINGS_KEY, {
    ...getSettings(),
    ...settings,
    updatedAt: new Date().toISOString(),
  });
}

export function applyStoredTheme() {
  const { theme } = getSettings();

  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function getLinks() {
  return readJson(LINKS_KEY, []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function saveGeneratedProduct({
  userId = LOCAL_USER.id,
  asin,
  originalUrl,
  marketplace,
  keywords = [],
  links = [],
  affiliateTag = '',
  utmSource = '',
  utmMedium = '',
  utmCampaign = '',
}) {
  const createdAt = new Date().toISOString();
  const productId = makeId('product');
  const records = links.map((item, index) => ({
    id: makeId(`link_${index + 1}`),
    product_id: productId,
    user_id: userId,
    url: item.url,
    link_type: item.type,
    click_count: 0,
    created_at: createdAt,
    keywords: keywords.length ? keywords : null,
    affiliate_tag: affiliateTag || null,
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
    products: {
      asin,
      marketplace,
      original_url: originalUrl,
    },
  }));

  writeJson(LINKS_KEY, [...records, ...getLinks()]);
  return records;
}

export function deleteLink(id) {
  const nextLinks = getLinks().filter((link) => link.id !== id);
  writeJson(LINKS_KEY, nextLinks);
  return nextLinks;
}

export function getKeywords() {
  return readJson(KEYWORDS_KEY, seedKeywords).sort(
    (a, b) => (b.usage_count || 0) - (a.usage_count || 0)
  );
}

export function addKeyword({ name, category = 'general' }) {
  const keywords = getKeywords();
  const existing = keywords.find(
    (keyword) => keyword.name === name && keyword.category === category
  );

  if (existing) {
    const nextKeywords = keywords.map((keyword) =>
      keyword.id === existing.id
        ? { ...keyword, usage_count: (keyword.usage_count || 0) + 1 }
        : keyword
    );
    writeJson(KEYWORDS_KEY, nextKeywords);
    return nextKeywords.find((keyword) => keyword.id === existing.id);
  }

  const keyword = {
    id: makeId('kw'),
    name,
    category,
    usage_count: 1,
  };

  writeJson(KEYWORDS_KEY, [keyword, ...keywords]);
  return keyword;
}

export function deleteKeyword(id) {
  const nextKeywords = getKeywords().filter((keyword) => keyword.id !== id);
  writeJson(KEYWORDS_KEY, nextKeywords);
  return nextKeywords;
}
