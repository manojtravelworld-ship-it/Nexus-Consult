import React, { useState } from 'react';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { VoiceInterface } from '../components/VoiceInterface';
import { ConnectionStatus } from '../types';

export default function VoiceAgent() {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [currentView, setCurrentView] = useState('command'as any);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-950">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      <div className="flex-1 flex flex-col relative">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-5" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950" />
        
        <div className="relative z-10 flex flex-col h-full p-6">
          <Header status={status} />
          <div className="flex-1 flex items-center justify-center">
            <VoiceInterface status={status} setStatus={setStatus} />
          </div>
        </div>
      </div>
    </div>
  );
}
