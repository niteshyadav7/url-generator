import React from 'react';
import { BarChart3, TrendingUp, Laptop, Smartphone, Users, Globe2 } from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

export default function Analytics() {
  const chartData = [
    { name: 'Mon', clicks: 240 },
    { name: 'Tue', clicks: 320 },
    { name: 'Wed', clicks: 480 },
    { name: 'Thu', clicks: 410 },
    { name: 'Fri', clicks: 590 },
    { name: 'Sat', clicks: 710 },
    { name: 'Sun', clicks: 680 },
  ];

  const deviceData = [
    { name: 'Mobile', value: 65, color: '#8b5cf6' },
    { name: 'Desktop', value: 30, color: '#3b82f6' },
    { name: 'Tablet', value: 5, color: '#10b981' },
  ];

  const topLinks = [
    { title: 'Mask Spotlight (Clean Link)', clicks: 450, ctr: '4.8%' },
    { title: 'Instant Mask (Affiliate Keyword)', clicks: 380, ctr: '3.9%' },
    { title: 'Ergonomic Desk Chair (Clean Link)', clicks: 290, ctr: '3.1%' },
    { title: 'Skincare Anti Wrinkle (UTM tagged)', clicks: 190, ctr: '2.5%' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-violet-400" /> Analytics Command Center
        </h2>
        <p className="text-xs text-slate-400 mt-1">Geographical maps, device, and traffic details for all active product listings.</p>
      </div>

      {/* Top metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Link Clicks', value: '3,430', change: '+12.4%', icon: TrendingUp, color: 'text-violet-400' },
          { label: 'Unique Visitors', value: '1,890', change: '+8.1%', icon: Users, color: 'text-cyan-400' },
          { label: 'Mobile Share', value: '65.2%', change: '+4.3%', icon: Globe2, color: 'text-emerald-400' },
          { label: 'Average CTR', value: '3.58%', change: '+0.8%', icon: BarChart3, color: 'text-yellow-400' },
        ].map((m, idx) => {
          const Icon = m.icon;
          return (
            <div key={idx} className="glass-panel border border-slate-800/40 rounded-2xl p-5 space-y-2 hover:border-slate-800 transition-colors">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{m.label}</span>
                <Icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold text-slate-100">{m.value}</p>
                <span className="text-[10px] font-bold text-emerald-400">{m.change}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Graphs area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Click Trends chart */}
        <div className="lg:col-span-8 glass-panel border border-slate-800/40 rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Click Volume Trends (Weekly)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#f8fafc', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="clicks" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Device breakdown chart */}
        <div className="lg:col-span-4 glass-panel border border-slate-800/40 rounded-2xl p-6 flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Device Allocations</h3>
          <div className="h-44 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={65}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {deviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-xl font-bold text-slate-100">65%</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Mobile</span>
            </div>
          </div>
          <div className="space-y-2 pt-4 border-t border-slate-800/40">
            {deviceData.map((d, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="font-bold text-slate-200">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performers */}
      <div className="glass-panel border border-slate-800/40 rounded-2xl p-6">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Top Performing Affiliate Links</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-500 pb-3">
                <th className="pb-3 pl-2">Product Target</th>
                <th className="pb-3 text-center">Total Clicks</th>
                <th className="pb-3 text-right pr-2">Avg Click-Through-Rate (CTR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {topLinks.map((link, idx) => (
                <tr key={idx} className="hover:bg-slate-900/10 transition-colors">
                  <td className="py-3 pl-2 font-medium text-slate-200">{link.title}</td>
                  <td className="py-3 text-center text-slate-400">{link.clicks} clicks</td>
                  <td className="py-3 text-right pr-2 font-semibold text-emerald-400">{link.ctr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
