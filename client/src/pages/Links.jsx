import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { Link2, Search, Trash2, Copy, Check, ExternalLink, Calendar } from 'lucide-react';

export default function Links() {
  const { user } = useAuthStore();
  const [links, setLinks] = useState([]);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchLinks();
    }
  }, [user]);

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('generated_links')
        .select(`
          id,
          url,
          link_type,
          click_count,
          created_at,
          products (asin, marketplace)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (err) {
      console.error(err);
      // Mock data for pure client-side experience
      setLinks([
        {
          id: '1',
          url: 'https://www.amazon.in/dp/B0CJRTFY9F?tag=mytag-21',
          link_type: 'AFFILIATE',
          click_count: 42,
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          products: { asin: 'B0CJRTFY9F', marketplace: 'amazon.in' }
        },
        {
          id: '2',
          url: 'https://www.amazon.in/dp/B0CJRTFY9F?keywords=instant+mask',
          link_type: 'KEYWORD',
          click_count: 15,
          created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          products: { asin: 'B0CJRTFY9F', marketplace: 'amazon.in' }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('generated_links').delete().eq('id', id);
      if (error) throw error;
      setLinks(links.filter(l => l.id !== id));
    } catch (err) {
      console.error(err);
      setLinks(links.filter(l => l.id !== id)); // optimistically delete in mockup
    }
  };

  const filteredLinks = links.filter(link => 
    link.url.toLowerCase().includes(search.toLowerCase()) ||
    link.link_type.toLowerCase().includes(search.toLowerCase()) ||
    (link.products?.asin && link.products.asin.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-violet-400" /> Generated Links
          </h2>
          <p className="text-xs text-slate-400 mt-1">Manage and track your generated Amazon link library.</p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search links, ASIN, or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">Loading link database...</div>
      ) : filteredLinks.length === 0 ? (
        <div className="glass-panel border border-slate-800/40 rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-sm font-semibold">No Links Found</p>
          <p className="text-slate-500 text-xs mt-1">Create some links on the Dashboard to see them indexed here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLinks.map((link) => (
            <div key={link.id} className="glass-panel border border-slate-800/40 rounded-2xl p-5 space-y-3 hover:border-slate-800 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2.5 py-0.5 rounded-md border border-violet-500/15">
                    {link.link_type}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(link.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {link.click_count || 0} clicks
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 font-mono break-all bg-slate-950/40 border border-slate-900/60 p-2.5 rounded-xl">
                  {link.url}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800/30">
                <div className="text-[10px] text-slate-500">
                  ASIN:{' '}
                  <span className="text-slate-300 font-mono font-bold">
                    {link.products?.asin || 'N/A'}
                  </span>{' '}
                  • Marketplace:{' '}
                  <span className="text-slate-300 uppercase font-bold">
                    {link.products?.marketplace || 'N/A'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                    title="Open Link"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => handleCopy(link.url, link.id)}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center justify-center"
                    title="Copy Link"
                  >
                    {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(link.id)}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    title="Delete Link"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
