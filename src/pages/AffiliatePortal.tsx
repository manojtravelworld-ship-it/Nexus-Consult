import React from 'react';
import { Users, Link as LinkIcon, DollarSign, Award, ArrowUpRight, Copy } from 'lucide-react';

export default function AffiliatePortal() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-amber-500" />
            Affiliate Portal
          </h1>
          <p className="text-slate-400 mt-2">Track your referrals, commissions, and network growth.</p>
        </div>
        <button className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
          Withdraw Funds
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Total Earnings</h3>
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-white">$12,450</p>
          <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" />
            <span>+$850 this month</span>
          </p>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Active Referrals</h3>
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-bold text-white">48</p>
          <p className="text-sm text-indigo-400 mt-2 flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" />
            <span>+5 this month</span>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Conversion Rate</h3>
            <Award className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-white">12.5%</p>
          <p className="text-sm text-emerald-400 mt-2 flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" />
            <span>+1.2% vs last month</span>
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 font-medium">Pending Payout</h3>
            <DollarSign className="w-5 h-5 text-rose-400" />
          </div>
          <p className="text-3xl font-bold text-white">$1,250</p>
          <p className="text-sm text-slate-400 mt-2 flex items-center gap-1">
            <span>Available on 15th</span>
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Your Referral Link</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-slate-300 font-mono text-sm">https://nexusjustice.com/ref/user123</span>
            <button className="text-amber-400 hover:text-amber-300 flex items-center gap-2 text-sm font-medium">
              <Copy className="w-4 h-4" />
              Copy
            </button>
          </div>
          <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Recent Referrals</h2>
          <button className="text-sm text-amber-400 hover:text-amber-300">View All</button>
        </div>
        <div className="divide-y divide-slate-800">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold">
                  R{i}
                </div>
                <div>
                  <h4 className="text-white font-medium">Referral User {i}</h4>
                  <p className="text-sm text-slate-400">Joined {i * 2} days ago</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-emerald-400 font-medium">+$150.00</span>
                <span className="text-slate-500 text-sm">Commission</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
