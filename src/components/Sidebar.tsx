import React from 'react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: any) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  return (
    <div className="w-64 border-r border-white/5 bg-[#0a0f1d] flex flex-col">
      <div className="p-6">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-8">Navigation</h2>
        {/* Add sidebar items here if needed */}
      </div>
    </div>
  );
};
