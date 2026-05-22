import React, { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ExternalLink, Flame } from 'lucide-react';

export default function Layout({ children }) {
  useEffect(() => {
    // 1. Instantly apply theme from localStorage to avoid visual flashes
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 2. Sync from Supabase profiles in the background
    const syncTheme = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const { data } = await supabase
            .from('profiles')
            .select('theme_preference')
            .eq('id', session.user.id)
            .single();
          if (data && data.theme_preference) {
            localStorage.setItem('theme', data.theme_preference);
            if (data.theme_preference === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }
        }
      } catch (err) {
        // Silent fallback for offline first
      }
    };
    syncTheme();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans gradient-bg overflow-x-hidden">
      {/* Header Bar */}
      <header className="h-16 border-b border-slate-800/40 bg-slate-900/20 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Flame className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight bg-gradient-to-r from-violet-400 via-indigo-200 to-white bg-clip-text text-transparent">
                AmzLinker
              </h1>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block -mt-0.5">Link Engine</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <span className="text-xs font-semibold text-slate-400 hidden sm:block">
            Welcome back, <span className="text-violet-400">System Operator</span>
          </span>
          <a 
            href="https://amazon.in" 
            target="_blank" 
            rel="noreferrer" 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs font-semibold text-yellow-500 hover:bg-yellow-500/15 transition-all"
          >
            Go to Amazon <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Content Body */}
        <main className="flex-grow p-6">
          <div className="max-w-6xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

