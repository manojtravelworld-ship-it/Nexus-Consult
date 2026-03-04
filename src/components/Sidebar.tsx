import React from 'react';

type AppView = 'home' | 'advocate-signup' | 'reading-room' | 'toolbox' | 'command' | 'clients' | 'consult' | 'archive' | 'interaction-feed' | 'agency-hq' | 'agency-database' | 'affiliates' | 'support-chat' | 'agency-messages' | 'agency-broadcasts' | 'agency-knowledge' | 'agency-prompts' | 'agency-connectivity' | 'agency-api-usage' | 'notifications';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  return (
    <aside className="w-16 bg-[#0a0f1d] border-r border-white/5 flex flex-col items-center py-4 gap-4 z-[1000] relative">
      <button 
        onClick={() => onViewChange('home')}
        className={`p-3 rounded-xl transition-all ${currentView === 'home' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
        title="Home"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
      </button>
    </aside>
  );
};
