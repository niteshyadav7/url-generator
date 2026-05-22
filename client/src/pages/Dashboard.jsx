import React, { useState, useEffect } from 'react';
import { extractASIN, isValidAmazonUrl, extractTitleSlug } from '../utils/asinExtractor';
import { detectMarketplace } from '../utils/marketplace';
import { generateLinkUrl } from '../utils/linkGenerators';
import { supabase } from '../lib/supabase';
import { AMAZON_CATEGORIES, detectCategoryFromSlug } from '../utils/organicParams';
import { useAuthStore } from '../stores/authStore';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  HelpCircle, 
  Link2, 
  Zap, 
  Sparkles, 
  Globe, 
  Hash, 
  AlertCircle,
  Upload,
  FileText,
  Download,
  CheckCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
 
export default function Dashboard() {
  const { user } = useAuthStore();
  const [urlInput, setUrlInput] = useState('');
  const [asin, setAsin] = useState('');
  const [marketplace, setMarketplace] = useState(null);
  
  // Custom states for link generations
  const [affiliateTag, setAffiliateTag] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [selectedTypes, setSelectedTypes] = useState(['ORGANIC']);
  
  // Custom tracking / link builder states
  const [customParams, setCustomParams] = useState([]);
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamVal, setNewParamVal] = useState('');
  const [customTemplate, setCustomTemplate] = useState('');
  
  // Bulk Link Count States
  const [linkCount, setLinkCount] = useState(1);
  const [trackingKey, setTrackingKey] = useState('subid');

  // Organic link states
  const [titleSlug, setTitleSlug] = useState('');
  const [organicCategory, setOrganicCategory] = useState('aps');
  
  // UTM parameters
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');

  // Results state
  const [generatedResults, setGeneratedResults] = useState([]);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Bulk CSV engine states
  const [activeMode, setActiveMode] = useState('single'); // 'single' or 'bulk'
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState([]);
  const [error, setError] = useState('');

  const handleResetBulk = () => {
    setBulkResults([]);
    setError('');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) processFile(file);
  };

  const processFile = (file) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setError('Invalid file format. Please upload a .csv or .txt file.');
      return;
    }

    setError('');
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/);
        const rows = [];

        lines.forEach((line) => {
          const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          
          let foundUrl = '';
          for (let cell of cells) {
            const cleanCell = cell.trim().replace(/^["']|["']$/g, '');
            if (cleanCell.startsWith('http') && isValidAmazonUrl(cleanCell)) {
              foundUrl = cleanCell;
              break;
            }
          }

          if (!foundUrl) {
            const match = line.match(/(https?:\/\/[^\s,"]+)/);
            if (match && isValidAmazonUrl(match[0])) {
              foundUrl = match[0];
            }
          }

          if (foundUrl) {
            rows.push(foundUrl);
          }
        });

        if (rows.length === 0) {
          setError('No valid Amazon URLs found in the uploaded file.');
          setIsProcessing(false);
          return;
        }

        const results = rows.map((url) => {
          const extractedAsin = extractASIN(url);
          const market = detectMarketplace(url);
          const slug = extractTitleSlug(url);
          const category = slug ? detectCategoryFromSlug(slug) : 'aps';
          
          const keywords = slug 
            ? slug.split('-').slice(0, 3).filter(word => word.length > 2)
            : [];

          const organicLinks = [];
          for (let i = 1; i <= 5; i++) {
            const organicUrl = generateLinkUrl('ORGANIC', extractedAsin, market?.domain || 'amazon.com', {
              keywords,
              titleSlug: slug,
              category,
            });
            organicLinks.push(organicUrl);
          }

          return {
            originalUrl: url,
            asin: extractedAsin || 'N/A',
            marketplace: market?.domain || 'amazon.com',
            organicLinks,
          };
        });

        setBulkResults(results);
      } catch (err) {
        console.error(err);
        setError('An error occurred while parsing the CSV file.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsText(file);
  };

  const handleDownloadCSV = () => {
    if (!bulkResults.length) return;

    const headers = ['Original URL', 'ASIN', 'Marketplace', 'Organic Link 1', 'Organic Link 2', 'Organic Link 3', 'Organic Link 4', 'Organic Link 5'];
    const csvContent = [
      headers.join(','),
      ...bulkResults.map(row => {
        const columns = [
          `"${row.originalUrl.replace(/"/g, '""')}"`,
          `"${row.asin}"`,
          `"${row.marketplace}"`,
          ...row.organicLinks.map(link => `"${link.replace(/"/g, '""')}"`)
        ];
        return columns.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `amzlinker_bulk_organic_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load default settings if profile exists
  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('affiliate_tag, default_marketplace').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            if (data.affiliate_tag) setAffiliateTag(data.affiliate_tag);
            if (data.default_marketplace) {
              const defaultMarket = detectMarketplace(`https://${data.default_marketplace}`);
              setMarketplace(defaultMarket);
            }
          }
        });
    }
  }, [user]);

  // Parse URL dynamically on input change
  useEffect(() => {
    if (urlInput) {
      if (isValidAmazonUrl(urlInput)) {
        const extracted = extractASIN(urlInput);
        const market = detectMarketplace(urlInput);
        if (extracted) {
          setAsin(extracted);
        } else {
          setAsin('');
        }
        setMarketplace(market);
        
        const slug = extractTitleSlug(urlInput);
        setTitleSlug(slug);
        if (slug) {
          setOrganicCategory(detectCategoryFromSlug(slug));
        } else {
          setOrganicCategory('aps');
        }
      } else {
        setAsin('');
        setMarketplace(null);
        setTitleSlug('');
        setOrganicCategory('aps');
      }
    } else {
      setAsin('');
      setMarketplace(null);
      setTitleSlug('');
      setOrganicCategory('aps');
    }
  }, [urlInput]);

  // Add keyword tag
  const handleAddKeyword = (e) => {
    e.preventDefault();
    const clean = keywordInput.trim().toLowerCase();
    if (clean && !keywords.includes(clean)) {
      setKeywords([...keywords, clean]);
      setKeywordInput('');
    }
  };

  // Remove keyword tag
  const handleRemoveKeyword = (indexToRemove) => {
    setKeywords(keywords.filter((_, idx) => idx !== indexToRemove));
  };

  // Toggle selected link types
  const toggleType = (type) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  // Live Reactive Generation of links
  useEffect(() => {
    if (!asin || !marketplace) {
      setGeneratedResults([]);
      return;
    }

    const results = [];
    const count = Math.max(1, Math.min(50, Number(linkCount) || 1));

    selectedTypes.forEach(type => {
      // Organic links: each copy gets unique random session params
      if (type === 'ORGANIC') {
        const organicCount = Math.max(5, count);
        for (let i = 1; i <= organicCount; i++) {
          try {
            const url = generateLinkUrl('ORGANIC', asin, marketplace.domain, {
              keywords,
              titleSlug,
              category: organicCategory,
            });
            results.push({
              type: `ORGANIC_${i}`,
              url,
              label: `Organic Link ${i}`,
            });
          } catch (err) {
            console.error(err);
          }
        }
        return;
      }

      let baseVal = '';
      try {
        baseVal = generateLinkUrl(type, asin, marketplace.domain, {
          keywords,
          affiliateTag,
          utmParams: {
            source: utmSource,
            medium: utmMedium,
            campaign: utmCampaign
          },
          customParams,
          customTemplate
        });
      } catch (err) {
        console.error(err);
      }

      if (count === 1) {
        results.push({
          type,
          url: baseVal,
          label: type.replace('_', ' ')
        });
      } else {
        for (let i = 1; i <= count; i++) {
          let customUrl = baseVal;
          if (customUrl) {
            const cleanKey = (trackingKey || 'subid').trim();
            if (cleanKey) {
              const joinChar = customUrl.includes('?') ? '&' : '?';
              customUrl = `${customUrl}${joinChar}${cleanKey}=${i}`;
            }
          }
          results.push({
            type: `${type}_COPY_${i}`,
            url: customUrl,
            label: `${type.replace('_', ' ')} (Copy ${i})`
          });
        }
      }
    });

    setGeneratedResults(results);
    setSaveStatus('');
  }, [
    asin,
    marketplace,
    titleSlug,
    selectedTypes,
    linkCount,
    keywords,
    affiliateTag,
    utmSource,
    utmMedium,
    utmCampaign,
    customParams,
    customTemplate,
    trackingKey,
    organicCategory
  ]);

  // Handle generation action
  const handleGenerate = (e) => {
    e.preventDefault();
    // Fully handled by live reactive useEffect above
  };

  // Save to Database (proactively support server integrations)
  const handleSaveToDashboard = async () => {
    if (!user || generatedResults.length === 0) return;
    
    setLoading(true);
    setSaveStatus('');
    try {
      // 1. Insert product record
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          asin,
          original_url: urlInput,
          marketplace: marketplace.domain,
          keywords: keywords,
          total_links: generatedResults.length
        })
        .select()
        .single();

      if (productError) throw productError;

      // 2. Insert links records
      const linksPayload = generatedResults.map(item => ({
        product_id: product.id,
        user_id: user.id,
        link_type: item.type,
        url: item.url,
        keywords: keywords.length > 0 ? keywords : null,
        affiliate_tag: affiliateTag || null,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null
      }));

      const { error: linksError } = await supabase
        .from('generated_links')
        .insert(linksPayload);

      if (linksError) throw linksError;

      setSaveStatus('success');
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // Copy helper
  const handleCopy = (url, index) => {
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const linkTypesDef = [
    { type: 'ORGANIC', label: '🔍 Organic Search Link', desc: 'Realistic Amazon search click — unique session per link' },
    { type: 'CLEAN', label: 'Clean Link', desc: 'Removes all trackers & tags' },
    { type: 'KEYWORD', label: 'Keyword Targeted', desc: 'Appends keywords parameter' },
    { type: 'AFFILIATE', label: 'Affiliate Tagged', desc: 'Adds affiliate associate tag' },
    { type: 'AFFILIATE_KEYWORD', label: 'Affiliate + Keywords', desc: 'Combines tags and terms' },
    { type: 'UTM', label: 'UTM Trackers', desc: 'Standard GA source/campaign tags' },
    { type: 'SEARCH_PAGE', label: 'Store Search URL', desc: 'Points to marketplace search terms' },
    { type: 'CUSTOM_PARAMS', label: 'Custom Params Link', desc: 'Appends custom query parameters' },
    { type: 'CUSTOM_TEMPLATE', label: 'Custom Branded Link', desc: 'Uses your custom domain template' },
  ];

  return (
    <div className="space-y-6">
      {/* Intro Banner & Mode Switcher */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/40 p-6 glass-panel flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-bold text-slate-100">Optimized Amazon Link Engine</h2>
          </div>
          <p className="text-sm text-slate-400 max-w-xl">
            Generate highly authentic organic search click links instantly, or upload a CSV file to process links in bulk.
          </p>
        </div>

        {/* Mode Switcher Toggle */}
        <div className="flex p-1 bg-slate-900/80 border border-slate-800/60 rounded-xl w-full md:w-auto">
          <button
            onClick={() => setActiveMode('single')}
            className={`flex-1 md:flex-none py-2 px-4 rounded-lg text-xs font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeMode === 'single'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Single Link
          </button>
          <button
            onClick={() => setActiveMode('bulk')}
            className={`flex-1 md:flex-none py-2 px-4 rounded-lg text-xs font-bold tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeMode === 'bulk'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> Bulk CSV Upload
          </button>
        </div>
      </div>

      {/* Mode 1: Single Link Panel */}
      {activeMode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* URL Input Form Card */}
          <div className="lg:col-span-6 space-y-6">
            <div className="glass-panel border border-slate-800/40 rounded-2xl p-6 space-y-6">
              <form onSubmit={(e) => e.preventDefault()} className="space-y-5">
                
                {/* Target Amazon URL */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-violet-400" /> Paste Amazon Product URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.amazon.in/dp/B0CJRTFY9F"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-800/80 rounded-xl px-4 py-4 text-sm text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 placeholder:text-slate-500 transition-all font-mono shadow-inner"
                    required
                  />
                </div>

                {/* Live Extraction Indicators */}
                {urlInput && (
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-950/40 border border-slate-800/40 text-xs">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Globe className="w-4 h-4 text-emerald-400" />
                      <div>
                        <p className="font-semibold text-[10px] uppercase text-slate-500">Marketplace</p>
                        <p className="text-slate-200">{marketplace ? marketplace.domain : 'Detecting...'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Hash className="w-4 h-4 text-cyan-400" />
                      <div>
                        <p className="font-semibold text-[10px] uppercase text-slate-500">Product ASIN</p>
                        <p className="text-slate-200 font-mono">{asin ? asin : 'Extracting...'}</p>
                      </div>
                    </div>
                    {titleSlug && (
                      <div className="col-span-2 flex items-center gap-2 text-slate-400 mt-1">
                        <Link2 className="w-4 h-4 text-amber-400" />
                        <div className="min-w-0">
                          <p className="font-semibold text-[10px] uppercase text-slate-500">Product Slug</p>
                          <p className="text-slate-200 text-[10px] truncate">{titleSlug}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Results Live Preview Card */}
          <div className="lg:col-span-6">
            <div className="glass-panel border border-slate-800/40 rounded-2xl p-6 h-full flex flex-col min-h-[400px]">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/40 mb-4">
                <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400 animate-pulse" /> Live Previews
                </h3>
                {generatedResults.length > 0 && (
                  <button
                    onClick={handleSaveToDashboard}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-lg bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 hover:text-white border border-violet-500/25 transition-all text-xs font-semibold"
                  >
                    {loading ? 'Saving...' : 'Save to Dashboard'}
                  </button>
                )}
              </div>

              {saveStatus === 'success' && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  Successfully saved product and links to database!
                </div>
              )}
              
              {saveStatus === 'error' && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                  Unable to save. Please check your Supabase credentials.
                </div>
              )}

              {generatedResults.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-3.5">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <p className="text-slate-400 text-sm font-semibold">No Links Generated</p>
                  <p className="text-slate-500 text-xs mt-1 max-w-[220px]">
                    Paste an Amazon product URL on the left to instantly generate organic search clicks.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 flex-grow overflow-y-auto pr-1">
                  {generatedResults.map((item, index) => (
                    <div key={index} className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/40 space-y-2 hover:border-slate-800 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/15">
                          {item.label}
                        </span>
                        <button
                          onClick={() => handleCopy(item.url, index)}
                          className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedIndex === index ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="text-xs text-slate-300 font-mono break-all p-2 rounded bg-slate-950/80 border border-slate-900/60 max-h-[60px] overflow-y-auto">
                        {item.url}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Bulk CSV Upload Panel */}
      {activeMode === 'bulk' && (
        <div className="space-y-6">
          <div className="glass-panel border border-slate-800/40 rounded-2xl p-6 space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Upload className="w-5 h-5 text-violet-400" /> Bulk CSV Link Generator
              </h3>
              <p className="text-sm text-slate-400">
                Upload a CSV file containing Amazon product URLs. We will instantly extract the ASINs, slugs, and marketplaces, and generate 5 highly optimized organic search links for each product.
              </p>
            </div>

            {/* Drag & Drop Zone */}
            {!bulkResults.length && !isProcessing && (
              <div 
                className="border-2 border-dashed border-slate-800 hover:border-violet-500/50 bg-slate-900/20 hover:bg-slate-900/40 transition-all rounded-2xl p-10 text-center cursor-pointer relative"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => document.getElementById('csv-file-input').click()}
              >
                <input 
                  type="file" 
                  id="csv-file-input" 
                  accept=".csv,.txt" 
                  className="hidden" 
                  onChange={handleFileSelect} 
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-600/10 flex items-center justify-center border border-violet-500/20 text-violet-400 shadow-md">
                    <Upload className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      Click to upload or drag & drop CSV file
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports .csv or .txt (one Amazon URL per line or in a CSV column)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Processing State */}
            {isProcessing && (
              <div className="p-8 text-center space-y-4">
                <Loader2 className="w-10 h-10 text-violet-500 animate-spin mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">Processing CSV File...</p>
                  <p className="text-xs text-slate-500 mt-1">Extracting ASINs and generating organic search links...</p>
                </div>
              </div>
            )}

            {/* Results State */}
            {bulkResults.length > 0 && !isProcessing && (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-emerald-400">
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold">Generation Completed!</p>
                      <p className="text-xs text-slate-400 font-semibold">Processed {bulkResults.length} Amazon URLs and generated {bulkResults.length * 5} organic links successfully.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleDownloadCSV}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-500/20 transition-all border border-violet-500/30"
                    >
                      <Download className="w-4 h-4" /> Download CSV Results
                    </button>
                    
                    <button
                      onClick={handleResetBulk}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                      title="Process another file"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Table Preview */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Preview (First 5 Rows)
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-800/40 bg-slate-950/40">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800/60 bg-slate-900/30 text-slate-400 font-semibold">
                          <th className="p-3">Original URL</th>
                          <th className="p-3">ASIN</th>
                          <th className="p-3">Marketplace</th>
                          <th className="p-3">Generated Organic Link 1</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30 text-slate-300 font-mono">
                        {bulkResults.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/20 transition-colors">
                            <td className="p-3 max-w-[200px] truncate text-slate-400" title={row.originalUrl}>
                              {row.originalUrl}
                            </td>
                            <td className="p-3 text-cyan-400 font-bold">{row.asin}</td>
                            <td className="p-3 text-emerald-400">{row.marketplace}</td>
                            <td className="p-3 max-w-[300px] truncate text-violet-400" title={row.organicLinks[0]}>
                              {row.organicLinks[0]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
