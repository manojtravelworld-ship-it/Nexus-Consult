import React from 'react';
import { Building2, Users, Briefcase, TrendingUp, Activity, BarChart3 } from 'lucide-react';

export default function AgencyHQ() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-emerald-500" />
            Agency HQ
          </h1>
          <p className="text-slate-400 mt-2">Centralized dashboard for agency operations and oversight.</p>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          Download Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Total Advocates</h3>
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-white">142</p>
          <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>+12 this month</span>
          </p>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Active Cases</h3>
            <Briefcase className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-bold text-white">1,845</p>
          <p className="text-sm text-indigo-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>+84 this month</span>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Success Rate</h3>
            <Activity className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-white">87.4%</p>
          <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>+2.1% vs last year</span>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Revenue (YTD)</h3>
            <BarChart3 className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-white">$4.2M</p>
          <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>+15% vs last year</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Top Performing Advocates</h2>
            <button className="text-sm text-emerald-400 hover:text-emerald-300">View All</button>
          </div>
          <div className="divide-y divide-slate-800">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold">
                    A{i}
                  </div>
                  <div>
                    <h4 className="text-white font-medium">Advocate Name {i}</h4>
                    <p className="text-sm text-slate-400">Corporate Law • Senior Partner</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-white font-medium">{95 - i * 2}% Success</span>
                  <span className="text-slate-500 text-sm">{40 - i * 3} Active Cases</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          </div>
          <div className="p-6 space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="w-2 h-2 mt-2 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">New case assigned</p>
                  <p className="text-xs text-slate-400 mt-1">Case #202400{i} assigned to Advocate {i}</p>
                  <p className="text-xs text-slate-500 mt-1">{i * 2} hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
