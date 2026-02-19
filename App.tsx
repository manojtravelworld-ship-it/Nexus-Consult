
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ConnectionStatus } from './types';
import { jsPDF } from 'jspdf';

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const FRAME_RATE = 2; 
const JPEG_QUALITY = 0.6;

type AppView = 'home' | 'reading-room' | 'toolbox' | 'command' | 'system-prompt' | 'clients' | 'consult' | 'archive' | 'interaction-feed';

interface ClientRecord {
  id: string;
  name: string;
  caseType: string;
  status: 'Active' | 'Pending' | 'Closed';
  lastInteraction: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are Nexus Justice, a high-level legal AI assistant. 
When the camera is active, you perform real-time OCR and summarize documents. 
Focus on legal clauses, headers, and specific names or dates. 
Be precise, professional, and act as a senior legal counsel advisor.`;

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('home');
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isLoading, setIsLoading] = useState(true);
  
  // System Prompt State
  const [systemPrompt, setSystemPrompt] = useState(() => {
    return localStorage.getItem('nexus_system_prompt') || DEFAULT_SYSTEM_PROMPT;
  });
  const [tempPrompt, setTempPrompt] = useState(systemPrompt);
  const [isPromptSaved, setIsPromptSaved] = useState(false);

  // Hardware States
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toolbox Specific State
  const [toolboxImage, setToolboxImage] = useState<string | null>(null);
  const [isScanningToolbox, setIsScanningToolbox] = useState(false);

  // Refs for stable state access in callbacks
  const cameraEnabledRef = useRef(false);
  const micEnabledRef = useRef(false);

  // Transcription States
  const [userTranscription, setUserTranscription] = useState("");
  const [aiTranscription, setAiTranscription] = useState("");
  const [history, setHistory] = useState<{role: 'user' | 'ai', text: string, id: number}[]>([]);

  // Drafting States
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [draftText, setDraftText] = useState("");

  // Mock Database Data
  const clients: ClientRecord[] = [
    { id: 'NX-402', name: 'Sreedharan K.', caseType: 'Corporate Litigation', status: 'Active', lastInteraction: '2 mins ago' },
    { id: 'NX-509', name: 'Elena Rodriguez', caseType: 'Intellectual Property', status: 'Active', lastInteraction: '1 hour ago' },
    { id: 'NX-112', name: 'Marcus Thorne', caseType: 'Real Estate Fraud', status: 'Pending', lastInteraction: 'Yesterday' },
    { id: 'NX-882', name: 'Sarah Jenkins', caseType: 'Family Law / Trust', status: 'Closed', lastInteraction: '3 days ago' },
    { id: 'NX-334', name: 'Orbital Tech Corp', caseType: 'Acquisitions', status: 'Active', lastInteraction: 'Now' },
  ];

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const frameIntervalRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view === 'interaction-feed' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, userTranscription, aiTranscription, view]);

  const stopHardware = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setCameraEnabled(false);
    cameraEnabledRef.current = false;
    setMicEnabled(false);
    micEnabledRef.current = false;
  }, [stream]);

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext) => {
    const dataInt16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, OUTPUT_SAMPLE_RATE);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
  };

  const toggleHardware = async (type: 'camera' | 'mic') => {
    if ((type === 'camera' && !cameraEnabled) || (type === 'mic' && !micEnabled)) {
      setIsActivating(true);
      setError(null);
      try {
        const constraints = {
          audio: true,
          video: type === 'camera' || cameraEnabled ? { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } : false
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const isCam = type === 'camera' || cameraEnabled;
        setStream(newStream);
        setCameraEnabled(isCam);
        cameraEnabledRef.current = isCam;
        setMicEnabled(true);
        micEnabledRef.current = true;

        if (sessionRef.current) {
          sessionRef.current.close();
        }
        startAiSession(newStream);
      } catch (err: any) {
        setError("Allow Camera/Mic access in browser settings.");
        setMicEnabled(false);
        micEnabledRef.current = false;
        setCameraEnabled(false);
        cameraEnabledRef.current = false;
      } finally {
        setIsActivating(false);
      }
    } else {
      stopHardware();
      if (sessionRef.current) sessionRef.current.close();
      setStatus(ConnectionStatus.DISCONNECTED);
    }
  };

  const startAiSession = async (mediaStream: MediaStream) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      setStatus(ConnectionStatus.CONNECTING);
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: systemPrompt 
        },
        callbacks: {
          onopen: () => setStatus(ConnectionStatus.CONNECTED),
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), ctx);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (msg.serverContent?.inputTranscription) setUserTranscription(prev => (prev + " " + msg.serverContent!.inputTranscription!.text).trim());
            if (msg.serverContent?.outputTranscription) setAiTranscription(prev => (prev + " " + msg.serverContent!.outputTranscription!.text).trim());
            if (msg.serverContent?.turnComplete) {
              setHistory(prev => [...prev, {role: 'user', text: userTranscription || "...", id: Date.now()}, {role: 'ai', text: aiTranscription || "...", id: Date.now() + 1}].slice(-100));
              setUserTranscription("");
              setAiTranscription("");
            }
          },
          onerror: (e) => setStatus(ConnectionStatus.ERROR),
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        }
      });
      sessionRef.current = session;

      const audioCtx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      const source = audioCtx.createMediaStreamSource(mediaStream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      const analyser = audioCtx.createAnalyser();
      source.connect(analyser);
      
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) pcm[i] = input[i] * 32767;
        session.sendRealtimeInput({ media: { data: encode(new Uint8Array(pcm.buffer)), mimeType: 'audio/pcm;rate=16000' } });
        
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        setMicLevel(data.reduce((a, b) => a + b, 0) / data.length / 128);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      audioContextRef.current = audioCtx;

      frameIntervalRef.current = window.setInterval(() => {
        if (!cameraEnabledRef.current || !videoRef.current || !canvasRef.current || videoRef.current.videoWidth === 0) return;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = 1024;
          canvasRef.current.height = 768;
          ctx.drawImage(videoRef.current, 0, 0, 1024, 768);
          canvasRef.current.toBlob(blob => {
            if (blob) {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                if (sessionRef.current) {
                  sessionRef.current.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } });
                }
              };
              reader.readAsDataURL(blob);
            }
          }, 'image/jpeg', JPEG_QUALITY);
        }
      }, 1000 / FRAME_RATE);

    } catch (e) { setStatus(ConnectionStatus.ERROR); }
  };

  useEffect(() => {
    if (cameraEnabled && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [cameraEnabled, stream]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const saveSystemPrompt = () => {
    setSystemPrompt(tempPrompt);
    localStorage.setItem('nexus_system_prompt', tempPrompt);
    setIsPromptSaved(true);
    setTimeout(() => setIsPromptSaved(false), 2000);
    if (sessionRef.current) {
        stopHardware();
        sessionRef.current.close();
        setStatus(ConnectionStatus.DISCONNECTED);
    }
  };

  const downloadPDF = (fromToolbox = false) => {
    const doc = new jsPDF();
    if (fromToolbox && toolboxImage) {
      const imgProps = doc.getImageProperties(toolboxImage);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      doc.setFontSize(10);
      doc.text("Nexus Justice - Document Processing Hub", 10, 10);
      doc.addImage(toolboxImage, 'JPEG', 0, 20, pdfWidth, pdfHeight);
    } else {
      const content = history.map(h => `${h.role === 'user' ? 'YOU' : 'NEXUS'}: ${h.text}`).join('\n\n');
      doc.text("Nexus Justice Legal Transcript", 10, 10);
      doc.text(doc.splitTextToSize(content || "Empty session", 180), 10, 20);
    }
    doc.save(`nexus_legal_${Date.now()}.pdf`);
  };

  const downloadWord = (fromToolbox = false, customContent?: string) => {
    let content = '';
    if (customContent) {
      content = `
        <div style="font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.5;">
          <h1 style="text-align: center; text-decoration: underline; margin-bottom: 30px;">LEGAL DRAFT</h1>
          <div style="white-space: pre-wrap;">${customContent.replace(/\n/g, '<br/>')}</div>
        </div>`;
    } else if (fromToolbox && toolboxImage) {
      content = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">Nexus Justice - Scanned Document</h2>
          <div style="margin: 20px 0; text-align: center;">
            <img src="${toolboxImage}" style="max-width: 100%; height: auto; border: 1px solid #ccc; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
          </div>
        </div>`;
    } else {
      content = history.map(h => `<p><b>${h.role === 'user' ? 'YOU' : 'NEXUS'}</b>: ${h.text}</p>`).join('');
    }
    const blob = new Blob(['\ufeff', "<html><body>" + content + "</body></html>"], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexus_legal_${Date.now()}.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleToolboxCaptureAndStop = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        setToolboxImage(canvas.toDataURL('image/jpeg'));
        setIsScanningToolbox(false);
        stopHardware();
      }
    }
  };

  const generateDraft = async () => {
    if (history.length === 0) {
      setError("No consultation history found. Please interact with Nexus first.");
      return;
    }
    setIsGeneratingDraft(true);
    setError(null);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const prompt = `You are a senior legal counsel. Based on the following consultation history between an advocate (NEXUS) and a client (YOU), generate a formal legal draft/petition for court submission. 
      Use professional legal formatting, formal language, and include placeholders for specific case details.
      
      CONSULTATION HISTORY:
      ${history.map(h => `${h.role === 'user' ? 'Client' : 'Advocate'}: ${h.text}`).join('\n')}
      
      Generate only the legal document content.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      setDraftText(response.text || "Failed to generate draft.");
    } catch (err) {
      console.error(err);
      setError("Failed to generate legal draft. Please check your connection.");
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const isAdvocatePortal = view !== 'home';

  const navigationItems: { id: AppView, label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'reading-room', label: 'Reading Room' },
    { id: 'toolbox', label: 'Toolbox' },
    { id: 'command', label: 'Command' },
    { id: 'system-prompt', label: 'System' },
    { id: 'clients', label: 'Clients' },
    { id: 'consult', label: 'Consult' },
    { id: 'archive', label: 'Archive' },
    { id: 'interaction-feed', label: 'Feed' }
  ];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 overflow-hidden font-sans">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Sidebar - Restricted to Advocate Portal only */}
      {isAdvocatePortal && <Sidebar currentView={view} onViewChange={setView} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/5 bg-[#0a0f1d] px-6 flex items-center justify-between shrink-0 z-[1000] relative pointer-events-auto shadow-2xl">
          <div className="flex items-center gap-4">
             {/* Full Navigation Menu - Restricted to Advocate Portal only */}
             {isAdvocatePortal && (
               <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/5 overflow-x-auto no-scrollbar max-w-[70vw]">
                  {navigationItems.map((item) => (
                    <button 
                      key={item.id}
                      onClick={() => {
                        if (isScanningToolbox) { setIsScanningToolbox(false); stopHardware(); }
                        setView(item.id);
                      }}
                      className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 whitespace-nowrap cursor-pointer select-none ${view === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                    >
                      {item.label}
                    </button>
                  ))}
               </div>
             )}
             {view === 'home' && (
                <h1 className="text-sm font-black text-white uppercase tracking-tighter">
                  Nexus Justice <span className="text-indigo-500">v3.1</span>
                </h1>
             )}
          </div>
          <Header status={status} />
        </header>

        <main className="flex-1 relative bg-black flex overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 z-[2000] bg-[#020617] flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 animate-pulse">Initializing Nexus...</span>
              </div>
            </div>
          )}

          <div className="flex-1 relative overflow-hidden bg-[#020617]">
            {error && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[3000] bg-rose-500/90 backdrop-blur-md px-6 py-3 rounded-xl border border-rose-400/50 shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-[11px] font-black uppercase tracking-widest text-white">{error}</span>
                <button onClick={() => setError(null)} className="ml-4 text-white/60 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            {view === 'home' && (
              <div className="w-full h-full flex flex-col p-12 overflow-y-auto custom-scrollbar animate-in fade-in duration-1000">
                 <div className="max-w-4xl mx-auto w-full pt-10">
                    <h1 className="text-[64px] font-black tracking-tighter italic mb-4 leading-[0.9]">ACCESS HUB</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-16">Select your role to initialize the Titan interface.</p>
                    
                    <div className="space-y-6">
                       <div className="group bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-10 flex flex-col gap-2 transition-all hover:bg-white/[0.03] cursor-not-allowed opacity-60">
                          <div className="text-amber-500 text-[10px] font-black uppercase tracking-[0.3em]">Master Command</div>
                          <h2 className="text-4xl font-black italic tracking-tighter">Agency HQ</h2>
                       </div>

                       <div className="group bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-10 flex flex-col gap-2 transition-all hover:bg-white/[0.03] cursor-not-allowed opacity-60">
                          <div className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em]">Growth & Rewards</div>
                          <h2 className="text-4xl font-black italic tracking-tighter">Affiliates</h2>
                       </div>

                       <button 
                         onClick={() => setView('command')}
                         className="w-full text-left group bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-10 flex flex-col gap-2 transition-all hover:bg-white/[0.05] hover:border-indigo-500/30 hover:shadow-[0_20px_60px_rgba(79,70,229,0.15)] transform active:scale-[0.99]"
                       >
                          <div className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em]">Legal Workflow</div>
                          <h2 className="text-4xl font-black italic tracking-tighter group-hover:text-indigo-400 transition-colors">Advocate Portal</h2>
                       </button>
                    </div>
                 </div>
              </div>
            )}

            {view === 'command' && (
              <div className="w-full h-full p-8 flex gap-8 overflow-hidden">
                 {/* Left Panel: Command Center Controls */}
                 <div className="w-[400px] flex flex-col gap-6 shrink-0">
                    <div className="bg-[#0a0f1d] rounded-[2rem] p-8 border border-white/5 shadow-2xl flex flex-col gap-4">
                       <div className="text-amber-500 text-[9px] font-black uppercase tracking-[0.4em]">Voice Node Alpha</div>
                       <h3 className="text-4xl font-black italic tracking-tighter">Command<span className="text-slate-500">Center</span></h3>
                       
                       <div className="mt-4 space-y-4">
                          <button className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/10 transition-all">
                             <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 11-2 0 1 1 0 012 0zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 14.95a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zM16.586 7.879l.707-.707a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414-1.414z" /></svg>
                             Simulate Inbound Call
                          </button>
                          
                          <button className="w-full py-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-amber-500">
                             <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                             Auto-Consult Active
                          </button>
                       </div>
                    </div>

                    <div className="bg-indigo-600 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center gap-4 shadow-2xl shadow-indigo-600/20 flex-1 group cursor-pointer hover:scale-[1.02] transition-transform">
                       <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center border border-white/20 mb-2">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                       </div>
                       <h4 className="text-xl font-black uppercase tracking-widest leading-none">Direct Agent Consultation</h4>
                       <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Internal Voice Link</p>
                    </div>

                    <div className="bg-white/2 border border-white/5 rounded-[2rem] p-6 flex items-center gap-4">
                       <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                       <div>
                          <div className="text-[10px] font-black uppercase tracking-widest">Nexus Mainnet</div>
                          <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Uplink: Primary-01</div>
                       </div>
                    </div>
                 </div>

                 {/* Right Panel: Voice Ledger */}
                 <div className="flex-1 bg-[#0a0f1d] rounded-[3rem] border border-white/5 p-12 flex flex-col shadow-2xl relative overflow-hidden">
                    <div className="flex justify-between items-start mb-12">
                       <div>
                          <h3 className="text-6xl font-black italic tracking-tighter">Voice<span className="text-slate-800">Ledger</span></h3>
                          <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-2">Scroll through practice records. Select a case to briefing Gemini.</p>
                       </div>
                       <div className="text-right">
                          <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Active Records</div>
                          <div className="text-4xl font-black text-amber-500 leading-none">1</div>
                       </div>
                    </div>

                    <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-[3rem] p-10 flex flex-col justify-between group shadow-inner">
                       <div className="flex justify-between items-start">
                          <div>
                             <div className="text-amber-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Session ID: H01</div>
                             <h2 className="text-5xl font-black italic tracking-tighter group-hover:text-indigo-400 transition-colors">Sreedharan K.</h2>
                          </div>
                          <div className="text-right">
                             <div className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">16/02/2026</div>
                             <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">3m 4s</div>
                          </div>
                       </div>

                       <div className="bg-black/40 rounded-[2rem] p-10 border border-white/5 mb-8">
                          <div className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Summary:</div>
                          <p className="text-lg font-medium text-slate-400 leading-relaxed italic">
                             "Property boundary dispute in Aluva. Neighbor is encroaching via new fence construction. Needs interim injunction against further work."
                          </p>
                       </div>

                       <div className="flex gap-4">
                          <button className="flex-1 py-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 hover:bg-white/10 transition-all">
                             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" /></svg>
                             Discuss Case
                          </button>
                          <button className="flex-1 py-5 bg-emerald-600 rounded-2xl flex items-center justify-center gap-4 text-[11px] font-black uppercase tracking-[0.2em] text-black shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 transition-all">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                             Draft Petition
                          </button>
                       </div>
                       
                       <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-32 bg-slate-800/30 rounded-l-full" />
                    </div>
                 </div>
              </div>
            )}

            {view === 'interaction-feed' && (
              <div className="w-full h-full flex flex-col bg-[#070b14]">
                 <div className="p-8 border-b border-white/5 bg-[#0a0f1d] flex items-center justify-between shadow-lg">
                    <h3 className="text-4xl font-black tracking-tighter italic">Interaction<span className="text-slate-500 not-italic">Feed</span></h3>
                 </div>
                 <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar bg-gradient-to-b from-transparent to-[#020617]/50 scroll-smooth">
                    {history.map((item) => (
                      <div key={item.id} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`p-8 rounded-[2rem] text-[15px] leading-relaxed border transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 shadow-2xl max-w-[80%] ${item.role === 'user' ? 'bg-white/5 border-white/10 italic text-slate-300 rounded-br-none' : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-100 rounded-bl-none shadow-indigo-500/5'}`}>
                          {item.text}
                        </div>
                      </div>
                    ))}
                    {(userTranscription || aiTranscription) && (
                      <div className="flex justify-start">
                         <div className="p-8 rounded-[2rem] bg-indigo-600/20 border border-indigo-500/30 text-[15px] text-indigo-200 animate-pulse">
                            {userTranscription || aiTranscription}
                         </div>
                      </div>
                    )}
                 </div>
              </div>
            )}

            {view === 'system-prompt' && (
              <div className="w-full h-full flex flex-col p-12 overflow-hidden bg-[#020617] relative">
                 <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
                 <div className="z-10 flex flex-col h-full max-w-5xl mx-auto w-full">
                    <div className="flex justify-between items-end mb-12">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-3 italic">AI Core Logic</div>
                        <h3 className="text-5xl font-black tracking-tighter">System<span className="text-slate-500">Prompt</span></h3>
                      </div>
                      <div className="flex gap-4">
                        {isPromptSaved && (
                          <div className="flex items-center gap-2 text-emerald-500 animate-in fade-in slide-in-from-right-4">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            <span className="text-[10px] font-black uppercase tracking-widest">Logic Updated</span>
                          </div>
                        )}
                        <button 
                          onClick={saveSystemPrompt}
                          className="px-10 py-4 bg-indigo-600 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-500 transition-all transform active:scale-95"
                        >
                          Save Logic Core
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 bg-[#0a0f1d] border border-white/5 rounded-[3rem] p-10 shadow-inner flex flex-col relative group">
                      <textarea 
                         value={tempPrompt}
                         onChange={(e) => setTempPrompt(e.target.value)}
                         className="flex-1 w-full bg-transparent border-none outline-none resize-none text-[15px] leading-relaxed text-slate-300 font-medium pt-10 px-2"
                         placeholder="Define the duties and personality of the AI agent..."
                      />
                      <div className="mt-8 pt-8 border-t border-white/5 flex justify-between items-center text-[9px] font-black text-slate-600 uppercase tracking-widest">
                         <div>Tokens: {tempPrompt.length}</div>
                         <button onClick={() => setTempPrompt(DEFAULT_SYSTEM_PROMPT)} className="hover:text-indigo-400 transition-colors">Reset to Default</button>
                      </div>
                    </div>
                 </div>
              </div>
            )}

            {view === 'toolbox' && (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 overflow-y-auto custom-scrollbar">
                 <div className="w-full max-w-5xl min-h-[85%] bg-[#0a0f1d] rounded-[3rem] border border-white/5 p-12 flex flex-col items-center justify-center shadow-2xl relative">
                    <div className="absolute top-10 left-10">
                      <div className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-2">Legal Utility v3.1</div>
                      <h2 className="text-3xl font-black uppercase tracking-tighter italic">Document<span className="text-slate-500 not-italic">Input & Conversion</span></h2>
                    </div>

                    {!toolboxImage && !isScanningToolbox && (
                      <div className="flex flex-col items-center gap-10 text-center mt-12 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center border border-indigo-500/20 shadow-inner">
                          <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <button onClick={() => { toggleHardware('camera'); setIsScanningToolbox(true); }} className="px-14 py-6 bg-indigo-600 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-indigo-500 transition-all shadow-2xl transform hover:scale-105">Open Legal Scanner</button>
                      </div>
                    )}

                    {isScanningToolbox && (
                      <div className="w-full max-w-2xl flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-8">
                         <div className="relative aspect-[3/4] bg-black rounded-[2.5rem] overflow-hidden border-4 border-indigo-500/50 shadow-2xl">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale-[0.1] contrast-125" />
                            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_30px_rgba(79,70,229,1)] animate-[scan_3s_linear_infinite]" />
                         </div>
                         <div className="flex gap-6 justify-center">
                           <button onClick={handleToolboxCaptureAndStop} className="px-12 py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-200 transition-all shadow-2xl">Capture Document</button>
                           <button onClick={() => { setIsScanningToolbox(false); stopHardware(); }} className="px-10 py-5 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl font-black uppercase tracking-widest text-xs">Close Scanner</button>
                         </div>
                      </div>
                    )}

                    {toolboxImage && (
                      <div className="flex flex-col items-center gap-12 w-full animate-in zoom-in-95 duration-700">
                        <div className="relative w-full max-w-sm aspect-[3/4] bg-black rounded-[3rem] overflow-hidden border-4 border-white/10 shadow-2xl">
                          <img src={toolboxImage} className="w-full h-full object-cover" alt="Captured document" />
                        </div>
                        <div className="grid grid-cols-2 gap-10 w-full max-w-2xl">
                          <button onClick={() => downloadPDF(true)} className="px-10 py-12 bg-rose-500/5 border border-rose-500/10 rounded-[3rem] text-[14px] font-black uppercase tracking-[0.2em] text-rose-400">PDF</button>
                          <button onClick={() => downloadWord(true)} className="px-10 py-12 bg-indigo-500/5 border border-indigo-500/10 rounded-[3rem] text-[14px] font-black uppercase tracking-[0.2em] text-indigo-400">Word</button>
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            )}

            {view === 'reading-room' && (
               <div className="w-full h-full flex flex-col items-center justify-center p-4">
                  <div className="w-full max-w-6xl h-full bg-[#0a0f1d] rounded-[3rem] border border-white/5 relative shadow-2xl overflow-hidden flex flex-col">
                    {cameraEnabled ? (
                       <div className="relative flex-1 bg-black">
                          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain grayscale-[0.2] contrast-125" />
                          <button onClick={() => stopHardware()} className="absolute top-8 right-8 px-6 py-3 bg-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest">Close Scanner</button>
                       </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                        <button onClick={() => toggleHardware('camera')} className="px-12 py-5 bg-indigo-600 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-indigo-500 transition-all shadow-2xl transform hover:scale-105">Initialize Scanner</button>
                      </div>
                    )}
                  </div>
               </div>
            )}

            {view === 'clients' && (
              <div className="w-full h-full p-12 flex flex-col gap-10">
                <div className="flex justify-between items-end shrink-0">
                  <h3 className="text-5xl font-black tracking-tighter italic">Client<span className="text-slate-500 not-italic">Database</span></h3>
                </div>
                <div className="flex-1 bg-[#0a0f1d] rounded-[3rem] border border-white/5 overflow-hidden flex flex-col shadow-2xl">
                  {/* Table Headers */}
                  <div className="grid grid-cols-12 gap-6 px-12 py-8 border-b border-white/5 bg-white/2 shrink-0">
                    <div className="col-span-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Client Identity</div>
                    <div className="col-span-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Legal Matter</div>
                    <div className="col-span-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Last Interaction</div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {clients.map((client) => (
                      <div key={client.id} className="grid grid-cols-12 gap-6 px-12 py-8 border-b border-white/5 hover:bg-white/[0.04] transition-all group cursor-pointer">
                        <div className="col-span-4 font-black text-[16px] group-hover:text-indigo-300 transition-colors uppercase italic tracking-tighter">{client.name}</div>
                        <div className="col-span-4 text-[12px] text-slate-400">{client.caseType}</div>
                        <div className="col-span-4 text-right text-[11px] text-slate-600 uppercase font-bold">{client.lastInteraction}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === 'consult' && (
              <div className="w-full h-full flex flex-col p-8 overflow-hidden bg-[#020617]">
                <div className="flex justify-between items-end mb-8 shrink-0">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-2">Legal Drafting Engine</div>
                    <h3 className="text-5xl font-black tracking-tighter italic">Nexus<span className="text-slate-500 not-italic">Consult</span></h3>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={generateDraft}
                      disabled={isGeneratingDraft}
                      className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-3 ${isGeneratingDraft ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-600/20'}`}
                    >
                      {isGeneratingDraft ? (
                        <>
                          <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          Draft Petition
                        </>
                      )}
                    </button>
                    {draftText && (
                      <button 
                        onClick={() => downloadWord(false, draftText)}
                        className="px-8 py-4 bg-emerald-600 text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-500 shadow-xl shadow-emerald-600/20 transition-all flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download Word
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 bg-[#0a0f1d] border border-white/5 rounded-[3rem] p-10 shadow-inner flex flex-col overflow-hidden relative group">
                  {!draftText && !isGeneratingDraft ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                        <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <h4 className="text-xl font-black uppercase tracking-widest mb-2">No Draft Generated</h4>
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.3em]">Interact with Nexus in the Feed or Reading Room to build a case history.</p>
                    </div>
                  ) : isGeneratingDraft ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6">
                      <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(79,70,229,0.3)]" />
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-400 animate-pulse">Analyzing Consultation...</span>
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Synthesizing Legal Arguments</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                      <div className="bg-black/40 rounded-[2rem] p-12 border border-white/5 shadow-2xl">
                        <div className="prose prose-invert max-w-none">
                          <pre className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-300 selection:bg-indigo-500/30">
                            {draftText}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {view === 'archive' && (
              <div className="w-full h-full flex items-center justify-center p-8">
                 <div className="w-full max-w-4xl h-full bg-[#0a0f1d] rounded-[3rem] border border-white/5 p-16 flex flex-col items-center justify-center opacity-40 shadow-2xl">
                    <h2 className="text-3xl font-black uppercase tracking-[0.3em] mb-6 italic">Nexus Archive</h2>
                    <p className="text-[12px] font-bold uppercase tracking-[0.5em] text-indigo-400">Advanced Legal Logic Engine v3.1</p>
                 </div>
              </div>
            )}
          </div>

          {/* GLOBAL HARDWARE DOCK - Only show in Advocate Portal */}
          {isAdvocatePortal && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-5 z-[500] w-full max-w-md px-6 pointer-events-none">
              <div className="bg-black/90 backdrop-blur-3xl p-4 rounded-[3rem] border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.9)] flex items-center gap-4 pointer-events-auto">
                <button onClick={() => toggleHardware('camera')} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 border-2 cursor-pointer ${cameraEnabled ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_30px_rgba(79,70,229,0.6)] transform scale-110' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
                <button onClick={() => toggleHardware('mic')} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 border-2 cursor-pointer ${micEnabled ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_30px_rgba(79,70,229,0.6)] transform scale-110' : 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:text-rose-400'}`}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </button>
                <div className="h-10 w-px bg-white/10 mx-3" />
                <div className="px-6 flex flex-col justify-center">
                   <span className="text-[11px] font-black uppercase tracking-[0.4em] text-indigo-400 leading-none">Nexus Link</span>
                   <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-2">{status === ConnectionStatus.CONNECTED ? 'UPLINK STABLE' : 'OFFLINE'}</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        @keyframes scan { 0% { transform: translateY(0); } 100% { transform: translateY(100vh); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #312e81; border-radius: 10px; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
};

export default App;
