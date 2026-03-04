import React from 'react';
import { ConnectionStatus } from '../types';

export const Header: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${
        status === ConnectionStatus.CONNECTED ? 'bg-emerald-500' :
        status === ConnectionStatus.ERROR ? 'bg-rose-500' : 'bg-slate-500'
      }`} />
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {status}
      </span>
    </div>
  );
};
