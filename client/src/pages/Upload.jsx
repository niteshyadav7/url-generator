import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  AlertCircle, 
  Download, 
  ArrowRight, 
  Play, 
  Copy, 
  Check, 
  Layers, 
  FileDown, 
  Settings as SettingsIcon,
  ChevronDown,
  ChevronUp,
  Save
} from 'lucide-react';
import { getSettings, saveGeneratedProduct } from '../lib/localStore';
import { extractASIN, isValidAmazonUrl } from '../utils/asinExtractor';
import { detectMarketplace } from '../utils/marketplace';
import { generateLinkUrl } from '../utils/linkGenerators';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Batch Results states
  const [parsedProducts, setParsedProducts] = useState([]);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  // Global Override states
  const [globalAffiliateTag, setGlobalAffiliateTag] = useState('');
  const [selectedTypes, setSelectedTypes] = useState(['CLEAN', 'KEYWORD', 'AFFILIATE']);
  
  // Global UTM Overrides
  const [globalUtmSource, setGlobalUtmSource] = useState('');
  const [globalUtmMedium, setGlobalUtmMedium] = useState('');
  const [globalUtmCampaign, setGlobalUtmCampaign] = useState('');

  // Global Custom Parameters
  const [globalCustomTemplate, setGlobalCustomTemplate] = useState('');
  const [globalLinkCount, setGlobalLinkCount] = useState(1);
  const [globalTrackingKey, setGlobalTrackingKey] = useState('subid');

  const linkTypesDef = [
    { type: 'CLEAN', label: 'Clean Link', desc: 'Removes all trackers & tags' },
    { type: 'KEYWORD', label: 'Keyword Targeted', desc: 'Appends keywords parameter' },
    { type: 'AFFILIATE', label: 'Affiliate Tagged', desc: 'Adds affiliate associate tag' },
    { type: 'AFFILIATE_KEYWORD', label: 'Affiliate + Keywords', desc: 'Combines tags and terms' },
    { type: 'UTM', label: 'UTM Trackers', desc: 'Standard GA source/campaign tags' },
    { type: 'SEARCH_PAGE', label: 'Store Search URL', desc: 'Points to marketplace search terms' },
    { type: 'CUSTOM_PARAMS', label: 'Custom Params Link', desc: 'Appends custom query parameters' },
    { type: 'CUSTOM_TEMPLATE', label: 'Custom Branded Link', desc: 'Uses your custom domain template' },
  ];

  // Load default affiliate settings from this browser.
  useEffect(() => {
    const settings = getSettings();
    if (settings.affiliateTag) {
      setGlobalAffiliateTag(settings.affiliateTag);
    }
  }, []);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setErrorMsg('');
      setParsedProducts([]);
      setSaveStatus('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const downloadTemplate = () => {
    const headers = ['url', 'keywords', 'affiliate_tag', 'utm_source', 'utm_medium', 'utm_campaign'];
    const sample = [
      'https://www.amazon.in/dp/B0CJRTFY9F',
      'instant mask;spotlight',
      'mytag-21',
      'instagram',
      'social',
      'summer_sale'
    ];

    const csv = [headers.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'amazon_links_template.csv';
    a.click();
  };

  // CSV parsing logic
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    // Parse headers cleanly
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    const parsedRows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Basic CSV splitter considering quotes
      const values = [];
      let currentVal = '';
      let insideQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"' || char === "'") {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
      
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      parsedRows.push(row);
    }
    return parsedRows;
  };

  // Process the CSV file content locally
  const handleUpload = () => {
    if (!file) return;

    setUploading(true);
    setProgress(10);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        setProgress(40);
        
        const rows = parseCSV(text);
        setProgress(70);

        if (rows.length === 0) {
          throw new Error('CSV is empty or lacks valid headers.');
        }

        const processed = rows.map((row, index) => {
          const rawUrl = row.url || '';
          const isValid = isValidAmazonUrl(rawUrl);
          
          if (!isValid) {
            return {
              rowNumber: index + 1,
              originalUrl: rawUrl,
              isValid: false,
              asin: '',
              marketplace: '',
              links: []
            };
          }

          const asin = extractASIN(rawUrl) || '';
          const market = detectMarketplace(rawUrl);
          const domain = market ? market.domain : 'amazon.com';

          // Gather overrides
          const finalTag = (row.affiliate_tag || globalAffiliateTag).trim();
          const finalKeywords = row.keywords 
            ? row.keywords.split(';').map(k => k.trim()) 
            : [];
          
          const utmSource = (row.utm_source || globalUtmSource).trim();
          const utmMedium = (row.utm_medium || globalUtmMedium).trim();
          const utmCampaign = (row.utm_campaign || globalUtmCampaign).trim();

          const count = Math.max(1, Math.min(50, Number(globalLinkCount) || 1));
          const generated = [];

          selectedTypes.forEach(type => {
            let baseVal = '';
            try {
              baseVal = generateLinkUrl(type, asin, domain, {
                keywords: finalKeywords,
                affiliateTag: finalTag,
                utmParams: {
                  source: utmSource,
                  medium: utmMedium,
                  campaign: utmCampaign
                },
                customParams: [],
                customTemplate: globalCustomTemplate
              });
            } catch (err) {
              console.error(err);
            }

            if (count === 1) {
              generated.push({
                type,
                url: baseVal,
                label: type.replace('_', ' ')
              });
            } else {
              for (let i = 1; i <= count; i++) {
                let customUrl = baseVal;
                if (customUrl) {
                  const cleanKey = (globalTrackingKey || 'subid').trim();
                  if (cleanKey) {
                    const joinChar = customUrl.includes('?') ? '&' : '?';
                    customUrl = `${customUrl}${joinChar}${cleanKey}=${i}`;
                  }
                }
                generated.push({
                  type: `${type}_COPY_${i}`,
                  url: customUrl,
                  label: `${type.replace('_', ' ')} (Copy ${i})`
                });
              }
            }
          });

          return {
            rowNumber: index + 1,
            originalUrl: rawUrl,
            isValid: true,
            asin,
            marketplace: domain,
            keywords: finalKeywords,
            affiliateTag: finalTag,
            utmSource,
            utmMedium,
            utmCampaign,
            links: generated
          };
        });

        setProgress(100);
        setParsedProducts(processed);
        setUploading(false);
        setFile(null);
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message || 'Unable to parse spreadsheet. Please use our template structure.');
        setUploading(false);
      }
    };

    reader.readAsText(file);
  };

  const handleCopyLink = (url, uniqueIndex) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkIndex(uniqueIndex);
    setTimeout(() => setCopiedLinkIndex(null), 2000);
  };

  const handleCopyAllLinks = () => {
    const allUrls = parsedProducts
      .filter(p => p.isValid)
      .flatMap(p => p.links.map(l => l.url))
      .join('\n');
    
    if (allUrls) {
      navigator.clipboard.writeText(allUrls);
      alert('All generated URLs copied to clipboard!');
    }
  };

  // Exporter to compiled CSV download
  const handleDownloadCompiledCSV = () => {
    if (parsedProducts.length === 0) return;

    // Headers
    const headers = ['Row Number', 'Original URL', 'ASIN', 'Marketplace', 'Link Type', 'Compiled URL'];
    
    const rows = [];
    parsedProducts.forEach(p => {
      if (!p.isValid) {
        rows.push([p.rowNumber, p.originalUrl, 'INVALID', 'INVALID', 'INVALID', 'INVALID']);
      } else {
        p.links.forEach(l => {
          rows.push([
            p.rowNumber,
            p.originalUrl,
            p.asin,
            p.marketplace,
            l.label,
            l.url
          ]);
        });
      }
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `compiled_batch_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save the whole batch to local browser storage.
  const handleSaveBatch = async () => {
    if (parsedProducts.length === 0) return;

    setSaveLoading(true);
    setSaveStatus('');

    try {
      const validProducts = parsedProducts.filter(p => p.isValid);
      
      for (const p of validProducts) {
        saveGeneratedProduct({
          asin: p.asin,
          originalUrl: p.originalUrl,
          marketplace: p.marketplace,
          keywords: p.keywords,
          links: p.links,
          affiliateTag: p.affiliateTag,
          utmSource: p.utmSource,
          utmMedium: p.utmMedium,
          utmCampaign: p.utmCampaign,
        });
      }

      setSaveStatus('success');
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setSaveLoading(false);
    }
  };

  // Predefined toggle utilities
  const toggleType = (type) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/40 p-6 glass-panel flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-bold text-slate-100">Batch CSV Processing Suite</h2>
          </div>
          <p className="text-sm text-slate-400 max-w-2xl">
            Upload lists of products to generate thousands of unique, optimized tracker links instantly. Apply global override controls, keyword tags, and link tracking multipliers in real-time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Upload Form Area */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="glass-panel border border-slate-800/40 rounded-2xl p-6 space-y-6">
            
            {/* Override Controls Accordion */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800/40">
                <SettingsIcon className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-slate-200">Global Overrides & Suffix Rules</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Affiliate tag global override */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">Global Affiliate Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. yourtag-21"
                    value={globalAffiliateTag}
                    onChange={(e) => setGlobalAffiliateTag(e.target.value)}
                    className="w-full bg-slate-900/30 border border-slate-800/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-all font-mono"
                  />
                </div>

                {/* Branded domain template global override */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">Global Branded Template</label>
                  <input
                    type="text"
                    placeholder="https://deals.mybrand.com/go/{asin}"
                    value={globalCustomTemplate}
                    onChange={(e) => setGlobalCustomTemplate(e.target.value)}
                    className="w-full bg-slate-900/30 border border-slate-800/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-all font-mono"
                  />
                </div>
              </div>

              {/* UTM fields */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-semibold text-slate-300">Global UTM Tracker overrides (Optional)</label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Source (e.g. ig)"
                    value={globalUtmSource}
                    onChange={(e) => setGlobalUtmSource(e.target.value)}
                    className="bg-slate-900/20 border border-slate-800/50 rounded-lg px-2.5 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-all"
                  />
                  <input
                    type="text"
                    placeholder="Medium (e.g. bio)"
                    value={globalUtmMedium}
                    onChange={(e) => setGlobalUtmMedium(e.target.value)}
                    className="bg-slate-900/20 border border-slate-800/50 rounded-lg px-2.5 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-all"
                  />
                  <input
                    type="text"
                    placeholder="Campaign (e.g. promo)"
                    value={globalUtmCampaign}
                    onChange={(e) => setGlobalUtmCampaign(e.target.value)}
                    className="bg-slate-900/20 border border-slate-800/50 rounded-lg px-2.5 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-all"
                  />
                </div>
              </div>

              {/* Link generator multiplier */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800/20">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">Links to Generate per Row</label>
                  <div className="flex items-center bg-slate-900/20 border border-slate-800/50 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setGlobalLinkCount(Math.max(1, globalLinkCount - 1))}
                      className="w-8 h-8 rounded-md bg-slate-950/40 hover:bg-slate-900 border border-slate-800/60 text-slate-300 hover:text-white transition-all text-sm font-bold flex items-center justify-center"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={globalLinkCount}
                      onChange={(e) => setGlobalLinkCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                      className="w-full text-center bg-transparent border-none text-[11px] text-slate-100 focus:outline-none focus:ring-0 font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setGlobalLinkCount(Math.min(50, globalLinkCount + 1))}
                      className="w-8 h-8 rounded-md bg-slate-950/40 hover:bg-slate-900 border border-slate-800/60 text-slate-300 hover:text-white transition-all text-sm font-bold flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300">Tracking Suffix Key</label>
                  <input
                    type="text"
                    placeholder="e.g. subid"
                    value={globalTrackingKey}
                    onChange={(e) => setGlobalTrackingKey(e.target.value)}
                    className="w-full bg-slate-900/20 border border-slate-800/50 rounded-lg px-2.5 py-2.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Selected link types to compile checkboxes */}
            <div className="border-t border-slate-800/40 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Batch Formats to Compile</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTypes(linkTypesDef.map(d => d.type))}
                    className="px-2.5 py-1 rounded bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 text-[10px] font-bold border border-violet-500/20 transition-all"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTypes([])}
                    className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 text-[10px] font-bold transition-all"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {linkTypesDef.map((def) => {
                  const isChecked = selectedTypes.includes(def.type);
                  return (
                    <div 
                      key={def.type}
                      onClick={() => toggleType(def.type)}
                      className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                        isChecked 
                          ? 'bg-violet-600/5 border-violet-500/50' 
                          : 'bg-slate-900/20 border-slate-800/40 hover:bg-slate-900/30'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => {}} 
                        className="mt-0.5 accent-violet-500 scale-90" 
                      />
                      <div>
                        <p className="text-[11px] font-semibold text-slate-200">{def.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dropzone Container */}
            <div className="border-t border-slate-800/40 pt-5 space-y-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive 
                    ? 'border-violet-500 bg-violet-500/5' 
                    : 'border-slate-800/80 bg-slate-900/10 hover:bg-slate-900/20'
                }`}
              >
                <input {...getInputProps()} />
                <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-500 mb-3" />
                <p className="text-xs font-semibold text-slate-200">
                  {isDragActive ? 'Drop your CSV here...' : 'Drag & drop your CSV spreadsheet, or click to browse'}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Columns parsed: url, keywords, affiliate_tag, utm_source, utm_medium, utm_campaign</p>
              </div>

              {file && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-violet-400" />
                    <div>
                      <p className="text-xs font-semibold text-slate-200 truncate max-w-[200px]">{file.name}</p>
                      <p className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> {uploading ? 'Processing...' : 'Process CSV'}
                  </button>
                </div>
              )}

              {uploading && (
                <div className="space-y-2 p-4 rounded-xl bg-slate-950/40 border border-slate-800/40">
                  <div className="flex justify-between text-[11px] font-semibold">
                    <span className="text-slate-400">Parsing spreadsheet rows...</span>
                    <span className="text-violet-400">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-rose-400 text-xs font-semibold">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Parsing Error</p>
                  <p className="mt-1">{errorMsg}</p>
                </div>
              </div>
            )}

          </div>

          {/* Parsed Rows Display Area */}
          {parsedProducts.length > 0 && (
            <div className="glass-panel border border-slate-800/40 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-slate-100">Batch Processing Results ({parsedProducts.length} rows)</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyAllLinks}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[11px] font-bold text-slate-300 transition-all flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy All Links
                  </button>
                  <button
                    onClick={handleDownloadCompiledCSV}
                    className="px-3 py-1.5 rounded-lg bg-violet-600/10 hover:bg-violet-600/20 text-[11px] font-bold text-violet-400 border border-violet-500/20 transition-all flex items-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Download CSV
                  </button>
                </div>
              </div>

              {saveStatus === 'success' && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                  Batch saved to this browser.
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                  Unable to save batch locally.
                </div>
              )}

              <div className="overflow-hidden border border-slate-800/40 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/40 border-b border-slate-800/60 text-slate-400 text-[10px] uppercase font-bold">
                      <th className="p-3 text-center w-12">Row</th>
                      <th className="p-3">Amazon URL</th>
                      <th className="p-3 w-28">Parsed ASIN</th>
                      <th className="p-3 w-32">Marketplace</th>
                      <th className="p-3 text-center w-24">Link Count</th>
                      <th className="p-3 text-right w-16">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {parsedProducts.map((p, idx) => (
                      <React.Fragment key={idx}>
                        <tr className={`hover:bg-slate-900/10 transition-colors ${!p.isValid ? 'bg-rose-500/5' : ''}`}>
                          <td className="p-3 text-center font-mono text-slate-500">{p.rowNumber}</td>
                          <td className="p-3 font-mono text-slate-300 truncate max-w-[200px]" title={p.originalUrl}>
                            {p.originalUrl}
                          </td>
                          <td className="p-3">
                            {p.isValid ? (
                              <span className="font-mono text-cyan-400 bg-cyan-400/5 px-2 py-0.5 rounded border border-cyan-400/15">
                                {p.asin}
                              </span>
                            ) : (
                              <span className="text-rose-400 font-semibold bg-rose-400/5 px-2 py-0.5 rounded border border-rose-400/15">
                                Error
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-400">
                            {p.isValid ? p.marketplace : 'Unrecognized URL'}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-200">
                            {p.isValid ? p.links.length : 0}
                          </td>
                          <td className="p-3 text-right">
                            {p.isValid && (
                              <button
                                onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                                className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                              >
                                {expandedRow === idx ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </td>
                        </tr>

                        {expandedRow === idx && p.isValid && (
                          <tr className="bg-slate-950/30">
                            <td colSpan="6" className="p-4 border-t border-slate-800/40">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {p.links.map((link, lIdx) => {
                                  const uniqueIndex = `${idx}_${lIdx}`;
                                  return (
                                    <div key={lIdx} className="p-3 rounded-lg bg-slate-950/70 border border-slate-900/60 space-y-1.5 hover:border-slate-800/80 transition-colors">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wider bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/15">
                                          {link.label}
                                        </span>
                                        <button
                                          onClick={() => handleCopyLink(link.url, uniqueIndex)}
                                          className="p-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                          title="Copy to clipboard"
                                        >
                                          {copiedLinkIndex === uniqueIndex ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                      </div>
                                      <div className="text-[10px] text-slate-300 font-mono break-all bg-slate-950 p-2 rounded border border-slate-900/80 max-h-[50px] overflow-y-auto">
                                        {link.url}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleSaveBatch}
                disabled={saveLoading}
                className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 transition-all mt-4"
              >
                <Save className="w-4 h-4" /> {saveLoading ? 'Saving entire batch...' : 'Save Entire Batch'}
              </button>

            </div>
          )}

        </div>

        {/* Sidebar Instructions Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel border border-slate-800/40 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Spreadsheet Schema</h3>
            <ul className="space-y-3 text-xs text-slate-400 leading-relaxed">
              <li className="flex gap-2.5">
                <ArrowRight className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                <span>
                  The spreadsheet must match the downloaded schema. Only **CSV** files are accepted.
                </span>
              </li>
              <li className="flex gap-2.5">
                <ArrowRight className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                <span>
                  Multiple keywords can be separated by a semicolon (<code className="text-violet-400 font-mono">;</code>) in the keyword column.
                </span>
              </li>
              <li className="flex gap-2.5">
                <ArrowRight className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                <span>
                  Any blank cells inside the CSV columns will automatically fallback to the global overrides you configured on the left.
                </span>
              </li>
            </ul>

            <button
              onClick={downloadTemplate}
              className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-800 bg-slate-950/40 hover:bg-slate-900/40 text-xs text-slate-300 hover:text-white transition-all font-semibold shadow"
            >
              <Download className="w-4 h-4" /> Download template.csv
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
