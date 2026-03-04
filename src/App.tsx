import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Shield, Building2, Users, Mic } from 'lucide-react';

import AdvocatePortal from './pages/AdvocatePortal';
import AgencyHQ from './pages/AgencyHQ';
import AffiliatePortal from './pages/AffiliatePortal';
import VoiceAgent from './pages/VoiceAgent';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
        <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <Link to="/" className="flex items-center space-x-2 text-indigo-400 font-bold text-xl">
                  <Shield className="w-6 h-6" />
                  <span>Nexus Justice</span>
                </Link>
                <div className="hidden md:flex space-x-4">
                  <Link to="/advocate" className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2">
                    <Shield className="w-4 h-4" />
                    <span>Advocate Portal</span>
                  </Link>
                  <Link to="/agency" className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2">
                    <Building2 className="w-4 h-4" />
                    <span>Agency HQ</span>
                  </Link>
                  <Link to="/affiliate" className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2">
                    <Users className="w-4 h-4" />
                    <span>Affiliate Portal</span>
                  </Link>
                  <Link to="/voice" className="text-slate-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-2">
                    <Mic className="w-4 h-4" />
                    <span>Voice Agent</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/advocate" element={<AdvocatePortal />} />
            <Route path="/agency" element={<AgencyHQ />} />
            <Route path="/affiliate" element={<AffiliatePortal />} />
            <Route path="/voice" element={<VoiceAgent />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl">
          <span className="block">Welcome to</span>
          <span className="block text-indigo-500">Nexus Justice</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-slate-400 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Select a portal from the navigation menu above to get started.
        </p>
      </div>
      
      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
        <Link to="/advocate" className="relative group bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-indigo-500/50 transition-all">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Shield className="w-12 h-12 text-indigo-400 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Advocate Portal</h3>
          <p className="text-slate-400">Manage cases, clients, and legal documents securely.</p>
        </Link>
        
        <Link to="/agency" className="relative group bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition-all">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Building2 className="w-12 h-12 text-emerald-400 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Agency HQ</h3>
          <p className="text-slate-400">Centralized dashboard for agency operations and oversight.</p>
        </Link>
        
        <Link to="/affiliate" className="relative group bg-slate-900 p-6 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-all">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Users className="w-12 h-12 text-amber-400 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Affiliate Portal</h3>
          <p className="text-slate-400">Track referrals, commissions, and network growth.</p>
        </Link>
      </div>
    </div>
  );
}

export default App;
