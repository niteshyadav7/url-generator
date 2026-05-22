import React, { useState, useEffect } from 'react';
import { addKeyword, deleteKeyword, getKeywords } from '../lib/localStore';
import { Hash, Plus, Trash2, Search, Tag } from 'lucide-react';

export default function Keywords() {
  const [keywords, setKeywords] = useState([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('general');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKeywords();
  }, []);

  const fetchKeywords = () => {
    try {
      setKeywords(getKeywords());
    } catch (err) {
      console.error(err);
      setKeywords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const cleanName = name.trim().toLowerCase();
    if (!cleanName) return;

    try {
      addKeyword({ name: cleanName, category });
      setKeywords(getKeywords());
    } catch (err) {
      console.error(err);
    } finally {
      setName('');
    }
  };

  const handleDelete = (id) => {
    try {
      setKeywords(deleteKeyword(id));
    } catch (err) {
      console.error(err);
      setKeywords(keywords.filter(k => k.id !== id));
    }
  };

  const filtered = keywords.filter(k => 
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    k.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Hash className="w-5 h-5 text-violet-400" /> Keyword Library
          </h2>
          <p className="text-xs text-slate-400 mt-1">Manage reusable keyword tags to easily configuration and append targeting strings.</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search keywords or categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Create Form */}
        <div className="glass-panel border border-slate-800/40 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-200">Register New Keyword</h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Keyword Name</label>
              <input
                type="text"
                placeholder="e.g. anti wrinkle cream"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-all"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Category Group</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-800/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-violet-500 transition-all"
              >
                <option value="general">General</option>
                <option value="beauty">Beauty & Cosmetics</option>
                <option value="electronics">Electronics</option>
                <option value="furniture">Furniture</option>
                <option value="kitchen">Home & Kitchen</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl py-2.5 text-xs font-semibold shadow-md flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" /> Save Tag
            </button>
          </form>
        </div>

        {/* Keywords Table list */}
        <div className="lg:col-span-2 glass-panel border border-slate-800/40 rounded-2xl p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs">Loading tags...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">No keywords matched your search query.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="pb-3.5 pl-2">Keyword</th>
                    <th className="pb-3.5">Category</th>
                    <th className="pb-3.5 text-center">Usage Count</th>
                    <th className="pb-3.5 text-right pr-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/20 group transition-colors">
                      <td className="py-3.5 pl-2 font-medium text-slate-200">{item.name}</td>
                      <td className="py-3.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-900 border border-slate-800/60 px-2 py-0.5 rounded-full text-slate-400 capitalize">
                          <Tag className="w-3 h-3" /> {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 text-center text-slate-400">{item.usage_count} times</td>
                      <td className="py-3.5 text-right pr-2">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1 rounded bg-slate-950/20 border border-slate-800/80 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                          title="Delete Tag"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
