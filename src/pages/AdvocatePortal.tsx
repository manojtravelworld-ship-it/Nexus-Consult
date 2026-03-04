import React from 'react';
import { Shield, FileText, Users, Calendar, Clock, AlertCircle } from 'lucide-react';

export default function AdvocatePortal() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-500" />
            Advocate Portal
          </h1>
          <p className="text-slate-400 mt-2">Manage your cases, clients, and schedule.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          + New Case
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Active Cases</h3>
            <FileText className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-bold text-white">24</p>
          <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1">
            <span>+3 this week</span>
          </p>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Pending Reviews</h3>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-white">12</p>
          <p className="text-sm text-amber-400 mt-2 flex items-center gap-1">
            <span>Requires attention</span>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Upcoming Hearings</h3>
            <Calendar className="w-5 h-5 text-rose-400" />
          </div>
          <p className="text-3xl font-bold text-white">5</p>
          <p className="text-sm text-slate-400 mt-2 flex items-center gap-1">
            <span>Next: Tomorrow 10:00 AM</span>
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Recent Cases</h2>
          <button className="text-sm text-indigo-400 hover:text-indigo-300">View All</button>
        </div>
        <div className="divide-y divide-slate-800">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                  C{i}
                </div>
                <div>
                  <h4 className="text-white font-medium">State vs. Johnson</h4>
                  <p className="text-sm text-slate-400">Case #{2024000 + i} • Criminal Defense</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
                <span className="text-slate-500 text-sm">Updated 2h ago</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
