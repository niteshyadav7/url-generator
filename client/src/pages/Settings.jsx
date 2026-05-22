import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../lib/localStore';
import { Settings as SettingsIcon, Save, Key, Shield, User } from 'lucide-react';

export default function Settings() {
  const initialSettings = getSettings();
  const [affiliateTag, setAffiliateTag] = useState(initialSettings.affiliateTag || '');
  const [marketplace, setMarketplace] = useState(initialSettings.defaultMarketplace || 'amazon.in');
  const [theme, setTheme] = useState(initialSettings.theme || 'dark');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('success');

  // Apply theme when selection changes
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      saveSettings({
        affiliateTag,
        defaultMarketplace: marketplace,
        theme,
      });
      setMsgType('success');
      setMessage('Preferences saved to this browser.');
    } catch (err) {
      console.error(err);
      setMsgType('error');
      setMessage('Unable to save preferences locally.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-violet-400" /> System Settings
        </h2>
        <p className="text-xs text-slate-400 mt-1">Configure default affiliate accounts and regional marketplaces for this browser.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-xs font-semibold ${
          msgType === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
        }`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        
        {/* Settings side menu */}
        <div className="glass-panel border border-slate-800/40 rounded-2xl p-4 space-y-1">
          {[
            { label: 'General Configuration', icon: User, active: true },
            { label: 'Marketplaces Defaults', icon: Shield, active: false },
            { label: 'Browser Storage', icon: Key, active: false },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all ${
                  item.active 
                    ? 'bg-violet-600/10 text-violet-400 border border-violet-500/15' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Configurations Form */}
        <div className="md:col-span-2 glass-panel border border-slate-800/40 rounded-2xl p-6">
          <form onSubmit={handleSave} className="space-y-5">
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Default Affiliate Associate Tag</label>
              <input
                type="text"
                placeholder="e.g. associates-21"
                value={affiliateTag}
                onChange={(e) => setAffiliateTag(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-800/80 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-all font-mono"
              />
              <p className="text-[10px] text-slate-500">Automatically pre-filled when generating links on the dashboard.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Default Marketplace Region</label>
              <select
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-800/80 rounded-xl px-3.5 py-3 text-xs text-slate-100 focus:outline-none focus:border-violet-500 transition-all"
              >
                <option value="amazon.com">Amazon US (amazon.com)</option>
                <option value="amazon.in">Amazon India (amazon.in)</option>
                <option value="amazon.co.uk">Amazon UK (amazon.co.uk)</option>
                <option value="amazon.ca">Amazon Canada (amazon.ca)</option>
                <option value="amazon.de">Amazon Germany (amazon.de)</option>
                <option value="amazon.com.au">Amazon Australia (amazon.com.au)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Theme Preferences</label>
              <div className="flex gap-3">
                {['dark', 'light'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold capitalize transition-all ${
                      theme === t
                        ? 'bg-violet-600/10 text-violet-400 border-violet-500/40 shadow-inner'
                        : 'bg-slate-900/25 border-slate-800/50 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t} Mode
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl py-3 text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 transition-all mt-4"
            >
              <Save className="w-4 h-4" /> {loading ? 'Saving Preferences...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
