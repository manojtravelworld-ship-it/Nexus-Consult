
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

type AppView = 'home' | 'advocate-signup' | 'reading-room' | 'toolbox' | 'command' | 'clients' | 'consult' | 'archive' | 'interaction-feed' | 'agency-hq' | 'agency-database' | 'affiliates' | 'support-chat' | 'agency-messages' | 'agency-broadcasts' | 'agency-knowledge' | 'agency-prompts' | 'agency-connectivity' | 'agency-api-usage' | 'notifications';

interface Notification {
  id: number;
  message: string;
  date: string;
  read: boolean;
  type: 'general' | 'payment' | 'default';
}

interface SupportMessage {
  id: number;
  role: 'user' | 'ai' | 'admin';
  text: string;
}

interface ClientRecord {
  slNo: number;
  name: string;
  phone: string;
  courtName: string;
  caseNumber: string;
  oppAdvocateName: string;
  oppAdvocatePhone: string;
  nextPostingDate: string;
  purposeOfPosting: string;
}

interface Subscriber {
  id: string;
  name: string;
  plan: 'Trial' | 'Pro';
  joinDate: string;
}

interface Affiliate {
  id: string;
  name: string;
  phone: string;
  code: string;
  subscribers: Subscriber[];
}

interface Advocate {
  id: string;
  name: string;
  phone: string;
  email: string;
  state: string;
  district: string;
  subscription: 'Starter' | 'Pro';
  couponCode: string;
  referredBy: string;
  joinDate: string;
}

const locationData = {
  "Kerala": ["Thiruvananthapuram", "Kollam", "Ernakulam", "Kozhikode", "Thrissur", "Palakkad", "Malappuram", "Kannur"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem", "Tiruchirappalli", "Tirunelveli"],
  "Karnataka": ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi", "Belagavi", "Kalaburagi"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Aurangabad", "Thane"],
  "Delhi": ["New Delhi", "North Delhi", "South Delhi", "East Delhi", "West Delhi"]
};

const mockAffiliates: Affiliate[] = [
  {
    id: 'AFF-001',
    name: 'Sarah Jenkins',
    phone: '+1 555-0101',
    code: 'SJ-NEXUS-24',
    subscribers: [
      { id: 'SUB-101', name: 'John Doe', plan: 'Pro', joinDate: '2026-01-15' },
      { id: 'SUB-102', name: 'Alice Smith', plan: 'Trial', joinDate: '2026-02-10' },
    ]
  },
  {
    id: 'AFF-002',
    name: 'Marcus Thorne',
    phone: '+1 555-0102',
    code: 'MT-LEGAL-99',
    subscribers: [
      { id: 'SUB-201', name: 'Tech Corp LLC', plan: 'Pro', joinDate: '2025-11-20' },
    ]
  },
  {
    id: 'AFF-003',
    name: 'Elena Rodriguez',
    phone: '+1 555-0103',
    code: 'ER-LAW-55',
    subscribers: [
      { id: 'SUB-301', name: 'Bob Johnson', plan: 'Trial', joinDate: '2026-02-18' },
      { id: 'SUB-302', name: 'Emma Davis', plan: 'Trial', joinDate: '2026-02-19' },
      { id: 'SUB-303', name: 'Michael Brown', plan: 'Pro', joinDate: '2025-12-05' },
    ]
  }
];

const DEFAULT_SYSTEM_PROMPT = `You are Nexus Justice, a high-level legal AI assistant. 
When the camera is active, you perform real-time OCR and summarize documents. 
Focus on legal clauses, headers, and specific names or dates. 
Be precise, professional, and act as a senior legal counsel advisor.`;

interface ReferredSubscriber {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: 'Starter' | 'Pro' | 'Elite';
  price: number;
  signupDate: string;
  status: 'Paid' | 'Pending';
  commissionPaid: boolean;
}

interface AffiliatePayment {
  id: string;
  date: string;
  amount: number;
  status: 'Completed' | 'Processing';
  method: string;
}

const mockReferredSubscribers: ReferredSubscriber[] = [
  { id: 'sub-1', name: 'John Doe', email: 'john@example.com', phone: '+1 234 567 8900', tier: 'Pro', price: 99, signupDate: '2026-02-15', status: 'Paid', commissionPaid: false },
  { id: 'sub-2', name: 'Jane Smith', email: 'jane@example.com', phone: '+1 987 654 3210', tier: 'Elite', price: 199, signupDate: '2026-02-20', status: 'Pending', commissionPaid: false },
  { id: 'sub-3', name: 'Alice Johnson', email: 'alice@example.com', phone: '+1 555 123 4567', tier: 'Starter', price: 49, signupDate: '2026-01-10', status: 'Paid', commissionPaid: true },
  { id: 'sub-4', name: 'Bob Williams', email: 'bob@example.com', phone: '+1 444 987 6543', tier: 'Elite', price: 199, signupDate: '2026-02-25', status: 'Paid', commissionPaid: false },
];

const mockAffiliatePayments: AffiliatePayment[] = [
  { id: 'pay-1', date: '2026-02-04', amount: 145.80, status: 'Completed', method: 'Bank Transfer (...4920)' },
  { id: 'pay-2', date: '2026-01-04', amount: 89.50, status: 'Completed', method: 'Bank Transfer (...4920)' },
  { id: 'pay-3', date: '2025-12-04', amount: 210.00, status: 'Completed', method: 'Bank Transfer (...4920)' },
];

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

  // Affiliate States
  const [affiliateSearch, setAffiliateSearch] = useState("");
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(mockAffiliates[0].id);

  // Advocate Database States
  const [advocates, setAdvocates] = useState<Advocate[]>([
    { id: 'ADV-1001', name: 'John Doe', phone: '+1 555-0123', email: 'john@example.com', state: 'Kerala', district: 'Ernakulam', subscription: 'Pro', couponCode: 'JOH-123', referredBy: 'Adm-2026', joinDate: '2026-01-10' },
    { id: 'ADV-1002', name: 'Alice Smith', phone: '+1 555-0456', email: 'alice@example.com', state: 'Karnataka', district: 'Bengaluru', subscription: 'Starter', couponCode: 'ALI-456', referredBy: 'JOH-123', joinDate: '2026-02-15' }
  ]);
  const [currentAdvocateId, setCurrentAdvocateId] = useState<string | null>(() => {
    return localStorage.getItem('nexus_advocate_id') || null;
  });
  const [signupForm, setSignupForm] = useState({ name: '', phone: '', email: '', district: '', taluk: '', court: '', address: '', referralCode: '', passphrase: '' });
  const [loginForm, setLoginForm] = useState({ id: '', passphrase: '' });
  const [uplinkStep, setUplinkStep] = useState<'hardware' | 'login' | 'register' | 'forgot-password'>('hardware');
  const [dbFilterState, setDbFilterState] = useState('');
  const [dbFilterDistrict, setDbFilterDistrict] = useState('');
  const [dbFilterPlan, setDbFilterPlan] = useState('');
  const [dbSearchQuery, setDbSearchQuery] = useState('');

  // Mock Database Data
  const [clients, setClients] = useState<ClientRecord[]>([
    { slNo: 1, name: 'Sreedharan K.', phone: '+91 9876543210', courtName: 'District Court, Aluva', caseNumber: 'OS 145/2025', oppAdvocateName: 'Ramesh Menon', oppAdvocatePhone: '+91 9876543211', nextPostingDate: '2026-03-15', purposeOfPosting: 'Filing Written Statement' },
    { slNo: 2, name: 'Elena Rodriguez', phone: '+1 555-0199', courtName: 'High Court', caseNumber: 'WP(C) 204/2026', oppAdvocateName: 'Sarah Jenkins', oppAdvocatePhone: '+1 555-0200', nextPostingDate: '2026-03-20', purposeOfPosting: 'Hearing' },
    { slNo: 3, name: 'Marcus Thorne', phone: '+1 555-0188', courtName: 'Magistrate Court', caseNumber: 'CC 55/2026', oppAdvocateName: 'David Clark', oppAdvocatePhone: '+1 555-0201', nextPostingDate: '2026-04-05', purposeOfPosting: 'Evidence' },
    { slNo: 4, name: 'Sarah Jenkins', phone: '+1 555-0177', courtName: 'Family Court', caseNumber: 'OP 89/2025', oppAdvocateName: 'Priya Sharma', oppAdvocatePhone: '+91 9876543212', nextPostingDate: '2026-03-10', purposeOfPosting: 'Counseling' },
    { slNo: 5, name: 'Orbital Tech Corp', phone: '+1 555-0166', courtName: 'Commercial Court', caseNumber: 'CS 12/2026', oppAdvocateName: 'Michael Chang', oppAdvocatePhone: '+1 555-0202', nextPostingDate: '2026-04-12', purposeOfPosting: 'Framing of Issues' },
  ]);

  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClient, setNewClient] = useState<Partial<ClientRecord>>({});

  // Support Chat States
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([
    { id: 1, role: 'ai', text: 'Hello. I am the Nexus Support AI. Please describe any issues you are facing with the platform or administrative portal, and I will suggest solutions or escalate to human admins.' }
  ]);
  const [supportInput, setSupportInput] = useState("");
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  // Agency HQ States
  const [agencyMessages, setAgencyMessages] = useState<SupportMessage[]>([
    { id: 1, role: 'user', text: 'I am having trouble accessing the latest case files from the archive.' },
    { id: 2, role: 'admin', text: 'We are looking into the archive sync issue. It should be resolved shortly.' }
  ]);
  const [agencyMessageInput, setAgencyMessageInput] = useState("");

  const [advocateNotifications, setAdvocateNotifications] = useState<Notification[]>([
    { id: 1, message: "Welcome to Nexus Justice v3.1. Your affiliate link is ready.", date: "2026-02-27", read: false, type: 'general' },
    { id: 2, message: "John Doe (555-0192) joined under you, congratulations!", date: "2026-02-27", read: false, type: 'payment' }
  ]);
  const [broadcastInput, setBroadcastInput] = useState("");
  const [broadcastCategory, setBroadcastCategory] = useState<'all' | 'payment' | 'default' | 'specific'>('all');
  const [broadcastSpecificId, setBroadcastSpecificId] = useState("");

  const [knowledgeBaseDocs, setKnowledgeBaseDocs] = useState<{id: number, title: string, date: string}[]>([
    { id: 1, title: 'Advocate Portal Usage Guidelines 2026', date: '2026-01-15' },
    { id: 2, title: 'Standard Fee Structures & Affiliate Payments', date: '2026-02-01' }
  ]);

  const [adminSystemPrompt, setAdminSystemPrompt] = useState(() => localStorage.getItem('nexus_admin_prompt') || 'You are the Master AI. You oversee all operations and ensure compliance with admin directives.');
  const [advocateSystemPrompt, setAdvocateSystemPrompt] = useState(() => localStorage.getItem('nexus_advocate_prompt') || 'You are an Advocate AI Assistant. You must obey the Master AI and assist advocates with their cases.');
  const [affiliateSystemPrompt, setAffiliateSystemPrompt] = useState(() => localStorage.getItem('nexus_affiliate_prompt') || 'You are an Affiliate AI Assistant. You manage payments, rewards, and onboarding.');

  const handleAddClient = () => {
    if (!newClient.name || !newClient.phone) {
      setError("Name and Phone are required.");
      return;
    }
    const nextSlNo = clients.length > 0 ? Math.max(...clients.map(c => c.slNo)) + 1 : 1;
    const clientToAdd: ClientRecord = {
      slNo: nextSlNo,
      name: newClient.name || '',
      phone: newClient.phone || '',
      courtName: newClient.courtName || '',
      caseNumber: newClient.caseNumber || '',
      oppAdvocateName: newClient.oppAdvocateName || '',
      oppAdvocatePhone: newClient.oppAdvocatePhone || '',
      nextPostingDate: newClient.nextPostingDate || '',
      purposeOfPosting: newClient.purposeOfPosting || ''
    };
    setClients([...clients, clientToAdd]);
    setIsAddingClient(false);
    setNewClient({});
  };

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
    try {
      setStatus(ConnectionStatus.CONNECTED);
      
      const audioCtx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      const source = audioCtx.createMediaStreamSource(mediaStream);
      const analyser = audioCtx.createAnalyser();
      source.connect(analyser);
      
      const updateMicLevel = () => {
        if (!micEnabledRef.current) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        setMicLevel(data.reduce((a, b) => a + b, 0) / data.length / 128);
        requestAnimationFrame(updateMicLevel);
      };
      updateMicLevel();
      audioContextRef.current = audioCtx;

      // Custom recording logic
      const mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
      let audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (audioChunks.length === 0) return;
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        audioChunks = [];
        
        try {
          // 1. STT
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          const sttRes = await fetch('/api/stt', { method: 'POST', body: formData });
          const sttData = await sttRes.json();
          const userText = sttData.transcript;
          
          if (!userText) {
            mediaRecorder.start();
            return;
          }
          
          setUserTranscription(userText);
          
          // 2. Chat
          const chatRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userText, useWebSearch: false })
          });
          const chatData = await chatRes.json();
          const aiText = chatData.reply;
          
          setAiTranscription(aiText);
          setHistory(prev => [...prev, {role: 'user', text: userText, id: Date.now()}, {role: 'ai', text: aiText, id: Date.now() + 1}].slice(-100));
          
          // 3. TTS
          const ttsRes = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: aiText })
          });
          const ttsData = await ttsRes.json();
          
          if (ttsData.audio) {
            if (!outputAudioContextRef.current) outputAudioContextRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
            const ctx = outputAudioContextRef.current;
            const buffer = await decodeAudioData(decode(ttsData.audio), ctx);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(0);
            source.onended = () => {
              if (micEnabledRef.current) mediaRecorder.start();
            };
          } else {
            if (micEnabledRef.current) mediaRecorder.start();
          }
          
        } catch (err) {
          console.error("Pipeline error:", err);
          if (micEnabledRef.current) mediaRecorder.start();
        }
      };

      // Start recording chunks
      mediaRecorder.start();
      
      // Stop recording every 5 seconds to process
      const recordInterval = setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 5000);

      sessionRef.current = {
        close: () => {
          clearInterval(recordInterval);
          if (mediaRecorder.state === 'recording') mediaRecorder.stop();
        }
      };

      frameIntervalRef.current = window.setInterval(() => {
        if (!cameraEnabledRef.current || !videoRef.current || !canvasRef.current || videoRef.current.videoWidth === 0) return;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = 1024;
          canvasRef.current.height = 768;
          ctx.drawImage(videoRef.current, 0, 0, 1024, 768);
          // We can send frames to backend if needed, but currently skipping for STT/TTS flow
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
    try {
      const prompt = `You are a senior legal counsel. Based on the following consultation history between an advocate (NEXUS) and a client (YOU), generate a formal legal draft/petition for court submission. 
      Use professional legal formatting, formal language, and include placeholders for specific case details.
      
      CONSULTATION HISTORY:
      ${history.map(h => `${h.role === 'user' ? 'Client' : 'Advocate'}: ${h.text}`).join('\n')}
      
      Generate only the legal document content.`;
      
      const response = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: prompt })
      });
      const data = await response.json();
      
      setDraftText(data.draft || "Failed to generate draft.");
    } catch (err) {
      console.error(err);
      setError("Failed to generate legal draft. Please check your connection.");
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleSendSupportMessage = async () => {
    if (!supportInput.trim()) return;
    
    const newUserMsg: SupportMessage = { id: Date.now(), role: 'user', text: supportInput };
    setSupportMessages(prev => [...prev, newUserMsg]);
    setSupportInput("");
    setIsSendingSupport(true);

    try {
      const prompt = `You are an AI IT Support Assistant for the "Nexus Justice" legal platform. 
      An advocate has reported the following issue to the administrative portal: "${newUserMsg.text}".
      Please provide a helpful, technical, or administrative solution to their problem. Keep it concise, professional, and actionable.`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, useWebSearch: false })
      });
      const data = await response.json();

      const newAiMsg: SupportMessage = { id: Date.now() + 1, role: 'ai', text: data.reply || "I'm sorry, I couldn't process that request." };
      setSupportMessages(prev => [...prev, newAiMsg]);
    } catch (err) {
      console.error("Support chat error:", err);
      setSupportMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: "Error connecting to AI support. Please try again later." }]);
    } finally {
      setIsSendingSupport(false);
    }
  };

  const isAdvocatePortal = ['reading-room', 'toolbox', 'command', 'clients', 'consult', 'archive', 'interaction-feed', 'support-chat', 'notifications'].includes(view);
  const isAgencyPortal = ['agency-hq', 'agency-database', 'agency-messages', 'agency-broadcasts', 'agency-knowledge', 'agency-prompts', 'agency-connectivity', 'agency-api-usage'].includes(view);

  const navigationItems: { id: AppView, label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'reading-room', label: 'Reading Room' },
    { id: 'toolbox', label: 'Toolbox' },
    { id: 'command', label: 'Command' },
    { id: 'clients', label: 'Clients' },
    { id: 'consult', label: 'Consult' },
    { id: 'archive', label: 'Archive' },
    { id: 'interaction-feed', label: 'Feed' },
    { id: 'support-chat', label: 'Support' },
    { id: 'notifications', label: 'HQ Notifications' }
  ];

  const agencyNavigationItems: { id: AppView, label: string }[] = [
    { id: 'agency-hq', label: 'Dashboard' },
    { id: 'agency-database', label: 'Database' },
    { id: 'agency-messages', label: 'Messages' },
    { id: 'agency-broadcasts', label: 'Broadcasts' },
    { id: 'agency-knowledge', label: 'Knowledge Base' },
    { id: 'agency-prompts', label: 'System Prompts' },
    { id: 'agency-connectivity', label: 'Connectivity' },
    { id: 'agency-api-usage', label: 'API Usage' }
  ];

  const handleDownloadPaymentsCSV = () => {
    const headers = ['Payment ID', 'Date', 'Amount (USD)', 'Status', 'Method'];
    const csvContent = [
      headers.join(','),
      ...mockAffiliatePayments.map(p => `${p.id},${p.date},${p.amount},${p.status},"${p.method}"`)
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'affiliate_payments.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
               <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/5 overflow-x-auto custom-scrollbar max-w-[70vw] pb-1.5">
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

             {/* Agency HQ Navigation Menu */}
             {isAgencyPortal && (
               <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/5 overflow-x-auto custom-scrollbar max-w-[70vw] pb-1.5">
                  {agencyNavigationItems.map((item) => (
                    <button 
                      key={item.id}
                      onClick={() => setView(item.id)}
                      className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 whitespace-nowrap cursor-pointer select-none ${view === item.id ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
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
             {isAgencyPortal && (
                <div className="flex items-center gap-4 ml-4">
                  <button onClick={() => setView('home')} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Back to Hub">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  </button>
                  <h1 className="text-sm font-black text-white uppercase tracking-tighter">
                    Agency HQ <span className="text-amber-500">Command</span>
                  </h1>
                </div>
             )}
          </div>
          <Header status={status} />
        </header>

        {/* Notification Slide Bar Removed */}

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
                        <button 
                          onClick={() => setView('agency-hq')}
                          className="w-full text-left group bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-10 flex flex-col gap-2 transition-all hover:bg-white/[0.05] hover:border-amber-500/30 hover:shadow-[0_20px_60px_rgba(245,158,11,0.15)] transform active:scale-[0.99]"
                        >
                           <div className="text-amber-500 text-[10px] font-black uppercase tracking-[0.3em]">Master Command</div>
                           <h2 className="text-4xl font-black italic tracking-tighter group-hover:text-amber-500 transition-colors">Agency HQ</h2>
                        </button>

                        <div 
                          onClick={() => setView('affiliates')}
                          className="group bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-10 flex flex-col gap-2 transition-all hover:bg-white/[0.05] hover:border-emerald-500/30 hover:shadow-[0_20px_60px_rgba(16,185,129,0.15)] transform active:scale-[0.99] cursor-pointer"
                        >
                           <div className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.3em]">Growth & Rewards</div>
                           <h2 className="text-4xl font-black italic tracking-tighter group-hover:text-emerald-500 transition-colors">Affiliates</h2>
                        </div>

                        <div 
                          onClick={() => setView(currentAdvocateId ? 'command' : 'advocate-signup')}
                          className="group bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-10 flex flex-col gap-2 transition-all hover:bg-white/[0.05] hover:border-indigo-500/30 hover:shadow-[0_20px_60px_rgba(99,102,241,0.15)] transform active:scale-[0.99] cursor-pointer"
                        >
                           <div className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em]">Legal Workflow</div>
                           <h2 className="text-4xl font-black italic tracking-tighter group-hover:text-indigo-400 transition-colors">Advocate Portal</h2>
                        </div>
                     </div>
                 </div>
              </div>
            )}

            {view === 'advocate-signup' && (
              <div className="w-full h-full flex flex-col items-center justify-center p-12 overflow-y-auto custom-scrollbar animate-in fade-in duration-1000 bg-[#02040a]">
                <div className="w-full max-w-3xl bg-[#0f1423] border border-white/5 rounded-[3rem] p-12 shadow-2xl relative">
                  <button onClick={() => setView('home')} className="absolute top-8 left-8 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Back to Hub">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  </button>
                  <button onClick={() => setView('command')} className="absolute top-8 right-8 p-2 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors flex items-center gap-2" title="Skip (Dev Only)">
                    <span className="text-[10px] font-black uppercase tracking-widest">Skip (Dev)</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </button>
                  
                  <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                      <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                    </div>
                    <h2 className="text-4xl font-black italic tracking-tighter text-white">
                      {uplinkStep === 'register' ? 'REGISTER' : 'ADVOCATE'} <span className="text-white/20">UPLINK</span>
                    </h2>
                    <div className="text-amber-500 text-[10px] font-black uppercase tracking-[0.2em] mt-2 italic">
                      Neural Legal Infrastructure
                    </div>
                  </div>

                  {uplinkStep === 'hardware' && (
                    <div className="space-y-4 max-w-xl mx-auto">
                      <div className="flex items-center justify-between bg-[#0a0f1d] border border-white/5 rounded-2xl p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">Microphone Node</span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Standby</span>
                      </div>
                      <div className="flex items-center justify-between bg-[#0a0f1d] border border-white/5 rounded-2xl p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">Camera Sensors</span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Standby</span>
                      </div>
                      <button 
                        onClick={() => setUplinkStep('login')}
                        className="w-full py-5 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-400 shadow-xl shadow-amber-500/20 transition-all mt-8"
                      >
                        Authorize Hardware
                      </button>
                    </div>
                  )}

                  {uplinkStep === 'login' && (
                    <div className="space-y-6 max-w-xl mx-auto">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Advocate Identifier</label>
                        <input 
                          type="text" 
                          value={loginForm.id}
                          onChange={e => setLoginForm({...loginForm, id: e.target.value})}
                          className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                          placeholder="Advocate ID / Phone Number"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Passphrase</label>
                        <input 
                          type="password" 
                          value={loginForm.passphrase}
                          onChange={e => setLoginForm({...loginForm, passphrase: e.target.value})}
                          className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <button onClick={() => setUplinkStep('forgot-password')} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 italic transition-colors">Forgot Password?</button>
                        <button onClick={() => setUplinkStep('register')} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 italic transition-colors">Create Advocate Node</button>
                      </div>
                      <button 
                        onClick={() => {
                          if (loginForm.id) {
                            setCurrentAdvocateId(loginForm.id);
                            localStorage.setItem('nexus_advocate_id', loginForm.id);
                            setView('command');
                          } else {
                            setError("Please enter your Advocate Identifier.");
                          }
                        }}
                        className="w-full py-5 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-400 shadow-xl shadow-amber-500/20 transition-all mt-4"
                      >
                        Establish Link
                      </button>
                    </div>
                  )}

                  {uplinkStep === 'forgot-password' && (
                    <div className="space-y-6 max-w-xl mx-auto">
                      <div className="text-center mb-6">
                        <p className="text-sm text-slate-400">Enter your Advocate ID or Phone Number to reset your passphrase.</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Advocate Identifier</label>
                        <input 
                          type="text" 
                          className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                          placeholder="Advocate ID / Phone Number"
                        />
                      </div>
                      <button 
                        onClick={() => {
                          setError("Password reset link has been sent to your registered email/phone.");
                          setTimeout(() => setUplinkStep('login'), 2000);
                        }}
                        className="w-full py-5 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-400 shadow-xl shadow-amber-500/20 transition-all mt-4"
                      >
                        Send Reset Link
                      </button>
                      <div className="text-center pt-4">
                        <button onClick={() => setUplinkStep('login')} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors">Back to Login</button>
                      </div>
                    </div>
                  )}

                  {uplinkStep === 'register' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Full Professional Name</label>
                          <input 
                            type="text" 
                            value={signupForm.name}
                            onChange={e => setSignupForm({...signupForm, name: e.target.value})}
                            className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                            placeholder="Adv. John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Primary Email Hub</label>
                          <input 
                            type="email" 
                            value={signupForm.email}
                            onChange={e => setSignupForm({...signupForm, email: e.target.value})}
                            className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                            placeholder="john@advocate.in"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Direct Contact (Phone)</label>
                          <input 
                            type="tel" 
                            value={signupForm.phone}
                            onChange={e => setSignupForm({...signupForm, phone: e.target.value})}
                            className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                            placeholder="+91 0000000000"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">District</label>
                          <input 
                            type="text" 
                            value={signupForm.district}
                            onChange={e => setSignupForm({...signupForm, district: e.target.value})}
                            className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                            placeholder="e.g. Ernakulam"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Place/Taluk</label>
                          <input 
                            type="text" 
                            value={signupForm.taluk}
                            onChange={e => setSignupForm({...signupForm, taluk: e.target.value})}
                            className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                            placeholder="e.g. Aluva"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Court Complex</label>
                          <input 
                            type="text" 
                            value={signupForm.court}
                            onChange={e => setSignupForm({...signupForm, court: e.target.value})}
                            className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                            placeholder="High Court / District Court"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Office Domicile Address</label>
                        <input 
                          type="text" 
                          value={signupForm.address}
                          onChange={e => setSignupForm({...signupForm, address: e.target.value})}
                          className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                          placeholder="Full address for registry"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Referral Node Code</label>
                          <input 
                            type="text" 
                            value={signupForm.referralCode}
                            onChange={e => setSignupForm({...signupForm, referralCode: e.target.value})}
                            className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Create Passphrase</label>
                          <input 
                            type="password" 
                            value={signupForm.passphrase}
                            onChange={e => setSignupForm({...signupForm, passphrase: e.target.value})}
                            className="w-full bg-[#0a0f1d] border border-white/5 rounded-xl px-4 py-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => {
                          if (!signupForm.name || !signupForm.phone || !signupForm.email || !signupForm.district) {
                            setError("Please fill in all required fields.");
                            return;
                          }
                          const uniqueId = 'ADV-' + Math.floor(1000 + Math.random() * 9000);
                          const namePrefix = signupForm.name.substring(0, 3).toUpperCase();
                          const phoneSuffix = signupForm.phone.slice(-3);
                          const couponCode = `${namePrefix}-${phoneSuffix}`;
                          
                          const newAdvocate: Advocate = {
                            id: uniqueId,
                            name: signupForm.name,
                            phone: signupForm.phone,
                            email: signupForm.email,
                            state: 'Kerala',
                            district: signupForm.district,
                            subscription: 'Starter',
                            couponCode: couponCode,
                            referredBy: signupForm.referralCode || 'None',
                            joinDate: new Date().toISOString().split('T')[0]
                          };
                          
                          setAdvocates([...advocates, newAdvocate]);
                          localStorage.setItem('nexus_advocate_id', uniqueId);
                          setCurrentAdvocateId(uniqueId);
                          setView('command');
                        }}
                        className="w-full py-5 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-400 shadow-xl shadow-amber-500/20 transition-all mt-4"
                      >
                        Create Advocate Node
                      </button>
                      <div className="text-center pt-4">
                        <button onClick={() => setUplinkStep('login')} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors">Already have a node? Log in</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {view === 'agency-database' && (
              <div className="w-full h-full p-12 flex flex-col gap-10 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-end shrink-0">
                  <div>
                    <div className="text-amber-500 text-[11px] font-black uppercase tracking-[0.4em] mb-3 italic">Master Command</div>
                    <h3 className="text-6xl font-black tracking-tighter italic">Advocate<span className="text-slate-500 not-italic">Database</span></h3>
                    <p className="text-slate-400 text-sm mt-4 max-w-2xl">Manage registered advocates, subscriptions, and referral tracking.</p>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Search advocates..." 
                        value={dbSearchQuery}
                        onChange={(e) => setDbSearchQuery(e.target.value)}
                        className="w-64 py-3 pl-10 pr-4 bg-[#0a0f1d] border border-white/10 rounded-xl text-[12px] font-medium text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-all"
                      />
                      <svg className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <select 
                      value={dbFilterState}
                      onChange={e => { setDbFilterState(e.target.value); setDbFilterDistrict(''); }}
                      className="bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors appearance-none min-w-[160px]"
                    >
                      <option value="">All States</option>
                      {Object.keys(locationData).map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    <select 
                      value={dbFilterDistrict}
                      onChange={e => setDbFilterDistrict(e.target.value)}
                      disabled={!dbFilterState}
                      className="bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors appearance-none min-w-[160px] disabled:opacity-50"
                    >
                      <option value="">All Districts</option>
                      {dbFilterState && locationData[dbFilterState as keyof typeof locationData].map(district => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                    <select 
                      value={dbFilterPlan}
                      onChange={e => setDbFilterPlan(e.target.value)}
                      className="bg-[#0a0f1d] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors appearance-none min-w-[160px]"
                    >
                      <option value="">All Plans</option>
                      <option value="Starter">Starter</option>
                      <option value="Pro">Pro</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden flex-1 flex flex-col">
                  <div className="overflow-auto custom-scrollbar flex-1">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                      <thead className="sticky top-0 bg-[#0a0f1d] z-10">
                        <tr className="border-b border-white/5">
                          <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">ID</th>
                          <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Advocate Name</th>
                          <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Contact</th>
                          <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Location</th>
                          <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Plan</th>
                          <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Coupon Code</th>
                          <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Referred By</th>
                          <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Join Date</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {advocates
                          .filter(adv => !dbFilterState || adv.state === dbFilterState)
                          .filter(adv => !dbFilterDistrict || adv.district === dbFilterDistrict)
                          .filter(adv => !dbFilterPlan || adv.subscription === dbFilterPlan)
                          .filter(adv => {
                            if (!dbSearchQuery) return true;
                            const query = dbSearchQuery.toLowerCase();
                            return (
                              adv.name.toLowerCase().includes(query) ||
                              adv.phone.includes(query) ||
                              adv.email.toLowerCase().includes(query) ||
                              adv.id.toLowerCase().includes(query) ||
                              adv.couponCode.toLowerCase().includes(query) ||
                              adv.referredBy.toLowerCase().includes(query)
                            );
                          })
                          .map((adv) => (
                          <tr key={adv.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="py-4 px-4 font-mono text-xs text-amber-500">{adv.id}</td>
                            <td className="py-4 px-4 font-bold text-slate-200">{adv.name}</td>
                            <td className="py-4 px-4 text-slate-400">
                              <div>{adv.phone}</div>
                              <div className="text-xs opacity-60">{adv.email}</div>
                            </td>
                            <td className="py-4 px-4 text-slate-400">
                              <div>{adv.district}</div>
                              <div className="text-xs opacity-60">{adv.state}</div>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${adv.subscription === 'Pro' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'}`}>
                                {adv.subscription}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-mono text-xs text-emerald-400">{adv.couponCode}</td>
                            <td className="py-4 px-4 font-mono text-xs text-slate-400">{adv.referredBy}</td>
                            <td className="py-4 px-4 text-slate-400">{adv.joinDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {view === 'agency-hq' && (
              <div className="w-full h-full p-8 flex gap-8 overflow-hidden">
                {/* Left Panel: Affiliate List */}
                <div className="w-[400px] flex flex-col gap-6 shrink-0">
                  <div className="bg-[#0a0f1d] rounded-[2rem] p-8 border border-white/5 shadow-2xl flex flex-col gap-4">
                    <div className="text-amber-500 text-[9px] font-black uppercase tracking-[0.4em]">Master Command</div>
                    <h3 className="text-4xl font-black italic tracking-tighter">Agency<span className="text-slate-500">HQ</span></h3>
                    
                    <div className="mt-4 relative">
                      <input 
                        type="text" 
                        placeholder="Search affiliate..." 
                        value={affiliateSearch}
                        onChange={(e) => setAffiliateSearch(e.target.value)}
                        className="w-full py-4 pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-[12px] font-medium text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 transition-all"
                      />
                      <svg className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                  </div>

                  <div className="flex-1 bg-[#0a0f1d] rounded-[2rem] border border-white/5 p-4 flex flex-col shadow-2xl overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                      {mockAffiliates
                        .filter(a => a.name.toLowerCase().includes(affiliateSearch.toLowerCase()) || a.phone.includes(affiliateSearch))
                        .map(affiliate => (
                        <div 
                          key={affiliate.id}
                          onClick={() => setSelectedAffiliateId(affiliate.id)}
                          className={`p-5 rounded-2xl border cursor-pointer transition-all ${selectedAffiliateId === affiliate.id ? 'bg-amber-600/10 border-amber-500/30' : 'bg-white/2 border-white/5 hover:bg-white/5'}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className={`text-lg font-black italic tracking-tighter ${selectedAffiliateId === affiliate.id ? 'text-amber-400' : 'text-slate-200'}`}>{affiliate.name}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase">{affiliate.subscribers.length} Subs</div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-[11px] text-slate-400 font-mono">{affiliate.phone}</div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-slate-600">{affiliate.code}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Panel: Subscriber Details */}
                <div className="flex-1 bg-[#0a0f1d] rounded-[3rem] border border-white/5 p-12 flex flex-col shadow-2xl relative overflow-hidden">
                  {selectedAffiliateId ? (() => {
                    const affiliate = mockAffiliates.find(a => a.id === selectedAffiliateId)!;
                    const trialSubs = affiliate.subscribers.filter(s => s.plan === 'Trial');
                    const proSubs = affiliate.subscribers.filter(s => s.plan === 'Pro');
                    
                    return (
                      <>
                        <div className="flex justify-between items-start mb-12">
                          <div>
                            <div className="text-amber-500 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Affiliate Profile</div>
                            <h3 className="text-6xl font-black italic tracking-tighter">{affiliate.name}</h3>
                            <div className="flex gap-4 mt-4">
                              <span className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-mono text-slate-400 border border-white/10">{affiliate.phone}</span>
                              <span className="px-4 py-2 bg-amber-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-amber-400 border border-amber-500/20">Code: {affiliate.code}</span>
                            </div>
                          </div>
                          <div className="text-right flex gap-6">
                            <div>
                              <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Total Subs</div>
                              <div className="text-4xl font-black text-white leading-none">{affiliate.subscribers.length}</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 flex gap-8 overflow-hidden">
                          {/* Trial Subscribers */}
                          <div className="flex-1 flex flex-col bg-white/[0.02] border border-white/5 rounded-[2rem] p-8">
                            <div className="flex justify-between items-center mb-6">
                              <h4 className="text-xl font-black italic tracking-tighter text-slate-300">Trial Subscribers</h4>
                              <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold">{trialSubs.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                              {trialSubs.map(sub => (
                                <div key={sub.id} className="p-4 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                                  <div>
                                    <div className="font-bold text-sm text-slate-300">{sub.name}</div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Joined: {sub.joinDate}</div>
                                  </div>
                                  <div className="px-3 py-1 bg-slate-800 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-lg">Trial</div>
                                </div>
                              ))}
                              {trialSubs.length === 0 && (
                                <div className="text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest py-8">No trial subscribers</div>
                              )}
                            </div>
                          </div>

                          {/* Pro Subscribers */}
                          <div className="flex-1 flex flex-col bg-amber-900/10 border border-amber-500/10 rounded-[2rem] p-8">
                            <div className="flex justify-between items-center mb-6">
                              <h4 className="text-xl font-black italic tracking-tighter text-amber-400">Pro Subscribers</h4>
                              <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">{proSubs.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                              {proSubs.map(sub => (
                                <div key={sub.id} className="p-4 bg-black/40 rounded-xl border border-amber-500/20 flex justify-between items-center">
                                  <div>
                                    <div className="font-bold text-sm text-amber-100">{sub.name}</div>
                                    <div className="text-[10px] text-amber-500/60 uppercase tracking-widest mt-1">Joined: {sub.joinDate}</div>
                                  </div>
                                  <div className="px-3 py-1 bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest rounded-lg shadow-[0_0_10px_rgba(245,158,11,0.3)]">Pro</div>
                                </div>
                              ))}
                              {proSubs.length === 0 && (
                                <div className="text-center text-amber-500/40 text-[10px] font-bold uppercase tracking-widest py-8">No pro subscribers</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })() : (
                    <div className="flex-1 flex items-center justify-center text-slate-600 text-[12px] font-bold uppercase tracking-widest">
                      Select an affiliate to view details
                    </div>
                  )}
                </div>
              </div>
            )}

            {view === 'agency-messages' && (
               <div className="w-full h-full flex flex-col bg-[#070b14]">
                  <div className="p-8 border-b border-white/5 bg-[#0a0f1d] flex items-center justify-between shadow-lg shrink-0">
                     <div>
                       <div className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500 mb-2">Advocate Communication</div>
                       <h3 className="text-4xl font-black tracking-tighter italic">Agency<span className="text-slate-500 not-italic">Messages</span></h3>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-[#020617]/50">
                     {agencyMessages.map((msg) => (
                       <div key={msg.id} className={`flex ${msg.role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                         <div className={`p-6 rounded-[2rem] text-[14px] leading-relaxed border max-w-[70%] shadow-2xl ${
                           msg.role === 'admin' 
                             ? 'bg-amber-600/20 border-amber-500/30 text-amber-100 rounded-br-none' 
                             : 'bg-white/5 border-white/10 text-slate-300 rounded-bl-none'
                         }`}>
                           <div className="text-[9px] font-black uppercase tracking-widest mb-2 opacity-50">
                             {msg.role === 'admin' ? 'Admin (You)' : 'Advocate'}
                           </div>
                           {msg.text}
                         </div>
                       </div>
                     ))}
                  </div>
                  <div className="p-8 bg-[#0a0f1d] border-t border-white/5 shrink-0">
                    <div className="max-w-4xl mx-auto flex gap-4">
                      <input 
                        type="text" 
                        value={agencyMessageInput}
                        onChange={(e) => setAgencyMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && agencyMessageInput.trim()) {
                            setAgencyMessages(prev => [...prev, { id: Date.now(), role: 'admin', text: agencyMessageInput }]);
                            setAgencyMessageInput("");
                          }
                        }}
                        placeholder="Reply to advocates..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                      />
                      <button 
                        onClick={() => {
                          if (agencyMessageInput.trim()) {
                            setAgencyMessages(prev => [...prev, { id: Date.now(), role: 'admin', text: agencyMessageInput }]);
                            setAgencyMessageInput("");
                          }
                        }}
                        disabled={!agencyMessageInput.trim()}
                        className="px-8 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-amber-600/20"
                      >
                        Send
                      </button>
                    </div>
                  </div>
               </div>
            )}

            {view === 'agency-broadcasts' && (
               <div className="w-full h-full flex flex-col bg-[#070b14]">
                  <div className="p-8 border-b border-white/5 bg-[#0a0f1d] flex items-center justify-between shadow-lg shrink-0">
                     <div>
                       <div className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500 mb-2">Network Wide Communication</div>
                       <h3 className="text-4xl font-black tracking-tighter italic">Agency<span className="text-slate-500 not-italic">Broadcasts</span></h3>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-gradient-to-b from-transparent to-[#020617]/50">
                     
                     <div className="bg-[#0a0f1d] border border-white/5 rounded-3xl p-8 max-w-4xl mx-auto shadow-2xl">
                        <h4 className="text-xl font-black italic tracking-tighter mb-6">New Broadcast</h4>
                        
                        <div className="space-y-6">
                           <div>
                             <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Target Audience</label>
                             <div className="flex gap-4">
                               {['all', 'payment', 'default', 'specific'].map((cat) => (
                                 <button 
                                   key={cat}
                                   onClick={() => setBroadcastCategory(cat as any)}
                                   className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${broadcastCategory === cat ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                 >
                                   {cat === 'all' ? 'All Advocates' : cat === 'payment' ? 'Paid Users' : cat === 'default' ? 'Defaulted Users' : 'Specific ID'}
                                 </button>
                               ))}
                             </div>
                           </div>

                           {broadcastCategory === 'specific' && (
                             <div>
                               <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Advocate ID</label>
                               <input 
                                 type="text" 
                                 value={broadcastSpecificId}
                                 onChange={(e) => setBroadcastSpecificId(e.target.value)}
                                 placeholder="Enter Advocate ID..."
                                 className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-amber-500/50"
                               />
                             </div>
                           )}

                           <div>
                             <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Message Content</label>
                             <textarea 
                               value={broadcastInput}
                               onChange={(e) => setBroadcastInput(e.target.value)}
                               placeholder="Enter broadcast message..."
                               className="w-full min-h-[150px] bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-slate-300 focus:outline-none focus:border-amber-500/50 resize-none custom-scrollbar"
                             />
                           </div>

                           <div className="flex justify-end">
                             <button 
                               onClick={() => {
                                 if (!broadcastInput.trim()) return;
                                 setAdvocateNotifications(prev => [{
                                   id: Date.now(),
                                   message: broadcastInput,
                                   date: new Date().toISOString().split('T')[0],
                                   read: false,
                                   type: broadcastCategory === 'payment' ? 'payment' : broadcastCategory === 'default' ? 'default' : 'general'
                                 }, ...prev]);
                                 setBroadcastInput("");
                               }}
                               disabled={!broadcastInput.trim() || (broadcastCategory === 'specific' && !broadcastSpecificId.trim())}
                               className="px-8 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-amber-600/20"
                             >
                               Send Broadcast
                             </button>
                           </div>
                        </div>
                     </div>

                     <div className="max-w-4xl mx-auto">
                        <h4 className="text-xl font-black italic tracking-tighter mb-6">Recent Broadcasts</h4>
                        <div className="space-y-4">
                           {advocateNotifications.map((notif) => (
                             <div key={notif.id} className="bg-[#0a0f1d] border border-white/5 rounded-2xl p-6 flex gap-6 items-start">
                               <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                                 <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                               </div>
                               <div className="flex-1">
                                 <div className="flex items-center justify-between mb-2">
                                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{notif.type} • {notif.date}</div>
                                 </div>
                                 <p className="text-sm text-slate-300 leading-relaxed">{notif.message}</p>
                               </div>
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {view === 'agency-knowledge' && (
              <div className="w-full h-full p-12 flex flex-col gap-10 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-end shrink-0">
                  <div>
                    <div className="text-amber-500 text-[11px] font-black uppercase tracking-[0.4em] mb-3 italic">Resource Management</div>
                    <h3 className="text-6xl font-black tracking-tighter italic">Knowledge<span className="text-slate-500 not-italic">Base</span></h3>
                  </div>
                  <button className="px-8 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-500 shadow-xl shadow-amber-600/20 transition-all flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Upload Document
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {knowledgeBaseDocs.map(doc => (
                    <div key={doc.id} className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl hover:bg-white/[0.02] transition-colors group">
                      <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 text-amber-500 group-hover:scale-110 transition-transform">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-slate-200 mb-2">{doc.title}</h4>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Uploaded: {doc.date}</div>
                      </div>
                      <div className="mt-auto pt-6 border-t border-white/5 flex gap-4">
                        <button className="flex-1 py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-colors">View</button>
                        <button className="flex-1 py-3 bg-rose-500/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/20 transition-colors">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === 'agency-prompts' && (
              <div className="w-full h-full p-12 flex flex-col gap-10 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-end shrink-0">
                  <div>
                    <div className="text-amber-500 text-[11px] font-black uppercase tracking-[0.4em] mb-3 italic">AI Core Logic</div>
                    <h3 className="text-6xl font-black tracking-tighter italic">System<span className="text-slate-500 not-italic">Prompts</span></h3>
                    <p className="text-slate-400 text-sm mt-4 max-w-2xl">Configure the foundational AI behavior for all portals. The Master Admin prompt overrides all other portal prompts.</p>
                  </div>
                  <button 
                    onClick={() => {
                      localStorage.setItem('nexus_admin_prompt', adminSystemPrompt);
                      localStorage.setItem('nexus_advocate_prompt', advocateSystemPrompt);
                      localStorage.setItem('nexus_affiliate_prompt', affiliateSystemPrompt);
                      setIsPromptSaved(true);
                      setTimeout(() => setIsPromptSaved(false), 3000);
                    }}
                    className="px-8 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-500 shadow-xl shadow-amber-600/20 transition-all flex items-center gap-2"
                  >
                    {isPromptSaved ? 'Saved Successfully' : 'Save All Prompts'}
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Admin Prompt */}
                  <div className="bg-[#0a0f1d] border border-amber-500/30 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[50px] rounded-full" />
                    <div>
                      <h4 className="text-2xl font-black italic tracking-tighter text-amber-400">Master Admin Prompt</h4>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">Highest Priority - Overrides all others</p>
                    </div>
                    <textarea 
                      value={adminSystemPrompt}
                      onChange={(e) => setAdminSystemPrompt(e.target.value)}
                      className="flex-1 w-full min-h-[300px] bg-black/40 border border-white/10 rounded-2xl p-6 text-sm leading-relaxed text-slate-300 focus:outline-none focus:border-amber-500/50 resize-none custom-scrollbar"
                    />
                  </div>

                  {/* Advocate Prompt */}
                  <div className="bg-[#0a0f1d] border border-indigo-500/30 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full" />
                    <div>
                      <h4 className="text-2xl font-black italic tracking-tighter text-indigo-400">Advocate Portal Prompt</h4>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">Must obey Master Admin Prompt</p>
                    </div>
                    <textarea 
                      value={advocateSystemPrompt}
                      onChange={(e) => setAdvocateSystemPrompt(e.target.value)}
                      className="flex-1 w-full min-h-[300px] bg-black/40 border border-white/10 rounded-2xl p-6 text-sm leading-relaxed text-slate-300 focus:outline-none focus:border-indigo-500/50 resize-none custom-scrollbar"
                    />
                  </div>

                  {/* Affiliate Prompt */}
                  <div className="bg-[#0a0f1d] border border-emerald-500/30 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full" />
                    <div>
                      <h4 className="text-2xl font-black italic tracking-tighter text-emerald-400">Affiliate Portal Prompt</h4>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">Manages payments and onboarding</p>
                    </div>
                    <textarea 
                      value={affiliateSystemPrompt}
                      onChange={(e) => setAffiliateSystemPrompt(e.target.value)}
                      className="flex-1 w-full min-h-[300px] bg-black/40 border border-white/10 rounded-2xl p-6 text-sm leading-relaxed text-slate-300 focus:outline-none focus:border-emerald-500/50 resize-none custom-scrollbar"
                    />
                  </div>
                </div>
              </div>
            )}

            {view === 'agency-connectivity' && (
              <div className="w-full h-full p-12 flex flex-col gap-10 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-end shrink-0">
                  <div>
                    <div className="text-amber-500 text-[11px] font-black uppercase tracking-[0.4em] mb-3 italic">External Integrations</div>
                    <h3 className="text-6xl font-black tracking-tighter italic">Connectivity<span className="text-slate-500 not-italic">Settings</span></h3>
                    <p className="text-slate-400 text-sm mt-4 max-w-2xl">Manage API keys, webhooks, and third-party provider credentials.</p>
                  </div>
                  <button className="px-8 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-500 shadow-xl shadow-amber-600/20 transition-all">
                    Save Configuration
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Telephone Provider */}
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 text-blue-500">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      </div>
                      <div>
                        <h4 className="text-2xl font-black italic tracking-tighter text-slate-200">Telephone Provider</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Twilio / Plivo Integration</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">API Key / Account SID</label>
                        <input type="password" value="************************" readOnly className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 font-mono focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">API Secret / Auth Token</label>
                        <input type="password" value="************************" readOnly className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 font-mono focus:outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp API */}
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 text-emerald-500">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      </div>
                      <div>
                        <h4 className="text-2xl font-black italic tracking-tighter text-slate-200">WhatsApp API</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Meta Business Integration</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Access Token</label>
                        <input type="password" value="************************" readOnly className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 font-mono focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Phone Number ID</label>
                        <input type="text" value="104857392018475" readOnly className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 font-mono focus:outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* Webhooks */}
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl lg:col-span-2">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20 text-purple-500">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      </div>
                      <div>
                        <h4 className="text-2xl font-black italic tracking-tighter text-slate-200">App Webhooks</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Event Callbacks</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Primary Webhook URL</label>
                        <div className="flex gap-4">
                          <input type="text" value="https://api.nexus.justice/v1/webhook/events" readOnly className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 font-mono focus:outline-none" />
                          <button className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-colors">Copy</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Razorpay Integration */}
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl lg:col-span-2">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20 text-blue-500">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                      </div>
                      <div>
                        <h4 className="text-2xl font-black italic tracking-tighter text-slate-200">Razorpay</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payment Gateway Integration</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Key ID</label>
                        <input type="password" value="************************" readOnly className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 font-mono focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Key Secret</label>
                        <input type="password" value="************************" readOnly className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 font-mono focus:outline-none" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'agency-api-usage' && (
              <div className="w-full h-full p-12 flex flex-col gap-10 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-end shrink-0">
                  <div>
                    <div className="text-amber-500 text-[11px] font-black uppercase tracking-[0.4em] mb-3 italic">System Orchestration</div>
                    <h3 className="text-6xl font-black tracking-tighter italic">API<span className="text-slate-500 not-italic">Usage & Health</span></h3>
                    <p className="text-slate-400 text-sm mt-4 max-w-2xl">Monitor provider health and usage. Gemini acts as the Orchestrator and Legacy Fallback.</p>
                  </div>
                  <div className="flex items-center gap-3 px-6 py-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">1 Provider Offline</span>
                  </div>
                </div>

                {/* System Status Alert */}
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-[2rem] p-6 flex items-start gap-6 shadow-2xl">
                   <div className="w-12 h-12 bg-rose-500/20 rounded-xl flex items-center justify-center border border-rose-500/30 text-rose-500 shrink-0">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                   </div>
                   <div className="flex-1">
                     <h4 className="text-xl font-black italic tracking-tighter text-rose-400">Degraded Performance</h4>
                     <p className="text-sm text-rose-300/80 mt-1">1 service provider (<span className="font-bold text-rose-200">Legacy SMS</span>) is currently offline. Gemini Orchestrator has successfully taken over routing for the affected services.</p>
                     
                     <div className="mt-4 flex flex-col gap-2">
                       <div className="bg-black/40 border border-rose-500/20 rounded-xl p-4 flex justify-between items-center">
                         <div>
                           <div className="font-bold text-rose-200">Legacy SMS (Notification Service)</div>
                           <div className="text-xs text-rose-400/80 mt-1">Stopped at: 2026-02-24 03:45:12 PST</div>
                         </div>
                         <div className="text-right">
                           <div className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Status</div>
                           <div className="text-rose-400 font-bold text-sm flex items-center gap-2 justify-end">
                             <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" /> Offline
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Gemini Orchestrator */}
                  <div className="bg-[#0a0f1d] border border-indigo-500/30 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden lg:col-span-3">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        </div>
                        <div>
                          <div className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.4em] mb-1">Orchestrator & Legacy Fallback</div>
                          <h4 className="text-3xl font-black italic tracking-tighter text-slate-200">Gemini AI</h4>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Status</div>
                        <div className="text-emerald-400 font-bold text-sm flex items-center gap-2 justify-end">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full" /> Active
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                      <div className="bg-black/40 rounded-2xl p-6 border border-white/5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Environment Variable</div>
                        <code className="text-indigo-400 font-mono text-xs">VITE_GEMINI_API_KEY</code>
                      </div>
                      <div className="bg-black/40 rounded-2xl p-6 border border-white/5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Tokens Processed (24h)</div>
                        <div className="text-2xl font-black text-slate-200">1.2M</div>
                      </div>
                      <div className="bg-black/40 rounded-2xl p-6 border border-white/5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Fallback Interventions</div>
                        <div className="text-2xl font-black text-slate-200">0</div>
                        <div className="text-[9px] text-slate-500 mt-1">No provider crashes detected</div>
                      </div>
                    </div>
                  </div>

                  {/* LiveKit */}
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-2xl font-black italic tracking-tighter text-slate-200">LiveKit</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Real-time Voice/Video</p>
                      </div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full" title="Active" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">URL</span>
                        <code className="text-slate-400 font-mono text-[10px]">VITE_LIVEKIT_URL</code>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">API Key</span>
                        <code className="text-slate-400 font-mono text-[10px]">VITE_LIVEKIT_API_KEY</code>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">API Secret</span>
                        <code className="text-slate-400 font-mono text-[10px]">VITE_LIVEKIT_API_SECRET</code>
                      </div>
                    </div>
                    <div className="mt-auto pt-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Usage (24h)</div>
                      <div className="text-xl font-black text-slate-200">4,250 mins</div>
                    </div>
                  </div>

                  {/* MongoDB */}
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-2xl font-black italic tracking-tighter text-slate-200">MongoDB</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Database Storage</p>
                      </div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full" title="Active" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">URL</span>
                        <code className="text-slate-400 font-mono text-[10px]">MONGODB_URL</code>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Auth</span>
                        <code className="text-slate-400 font-mono text-[10px]">User/Password</code>
                      </div>
                    </div>
                    <div className="mt-auto pt-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Usage (24h)</div>
                      <div className="text-xl font-black text-slate-200">1.2 GB Read/Write</div>
                    </div>
                  </div>

                  {/* Sarvam */}
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-2xl font-black italic tracking-tighter text-slate-200">Sarvam</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Indian Languages Voice/Text</p>
                      </div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full" title="Active" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">API Key</span>
                        <code className="text-slate-400 font-mono text-[10px]">VITE_SARVAM_API_KEY</code>
                      </div>
                    </div>
                    <div className="mt-auto pt-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Usage (24h)</div>
                      <div className="text-xl font-black text-slate-200">450K Chars / 120 mins</div>
                    </div>
                  </div>

                  {/* Serper.dev */}
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-2xl font-black italic tracking-tighter text-slate-200">Serper.dev</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Web Search</p>
                      </div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full" title="Active" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">API Key</span>
                        <code className="text-slate-400 font-mono text-[10px]">VITE_SERPER_API_KEY</code>
                      </div>
                    </div>
                    <div className="mt-auto pt-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Usage (24h)</div>
                      <div className="text-xl font-black text-slate-200">12,500 Queries</div>
                    </div>
                  </div>

                  {/* Legacy SMS (Simulated Crash) */}
                  <div className="bg-[#0a0f1d] border border-rose-500/30 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[40px] rounded-full" />
                    <div className="flex justify-between items-start relative z-10">
                      <div>
                        <h4 className="text-2xl font-black italic tracking-tighter text-slate-200">Legacy SMS</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Notification Service</p>
                      </div>
                      <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" title="Offline" />
                    </div>
                    <div className="space-y-3 relative z-10">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">API Key</span>
                        <code className="text-slate-400 font-mono text-[10px]">VITE_SMS_API_KEY</code>
                      </div>
                    </div>
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 relative z-10 mt-2">
                      <div className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1">Crash Detected</div>
                      <div className="text-sm text-rose-200 font-medium">Time: 2026-02-24 03:45:12</div>
                      <div className="text-xs text-rose-300/80 mt-1">Duration: 1h 39m (Ongoing)</div>
                      <div className="text-xs text-rose-300/80 mt-1">Reason: Connection timeout to provider gateway.</div>
                    </div>
                    <div className="mt-auto pt-4 relative z-10">
                      <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Gemini Orchestrator took over routing.
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {view === 'affiliates' && (
              <div className="w-full h-full p-12 flex flex-col gap-10 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-end shrink-0">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setView('home')} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Back to Hub">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div>
                      <div className="text-emerald-500 text-[11px] font-black uppercase tracking-[0.4em] mb-3 italic">Growth & Rewards Portal</div>
                      <h3 className="text-6xl font-black tracking-tighter italic">Affiliates<span className="text-slate-500 not-italic">Network</span></h3>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                  <div className="bg-gradient-to-br from-emerald-600/20 to-transparent border border-emerald-500/20 rounded-[3rem] p-10 flex flex-col gap-6 shadow-2xl items-center justify-center text-center">
                    <div className="text-emerald-500 text-[11px] font-black uppercase tracking-[0.4em] mb-3 italic">Next Payout: March 4, 2026</div>
                    <h4 className="text-2xl font-black italic tracking-tighter">Pending Commission</h4>
                    <div className="flex items-baseline gap-2 justify-center">
                      <span className="text-8xl font-black text-emerald-400">
                        ${mockReferredSubscribers.filter(sub => sub.status === 'Paid' && !sub.commissionPaid).reduce((total, sub) => total + (sub.price * 0.2), 0).toFixed(2)}
                      </span>
                      <span className="text-emerald-500 font-black uppercase tracking-widest text-xl">USD</span>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mt-4">
                      Commission is 20% of the first month's payment for each new subscriber under your referral. Payments are processed on the 4th of every month.
                    </p>
                  </div>

                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[3rem] p-10 flex flex-col gap-6 shadow-2xl overflow-hidden">
                    <div className="flex justify-between items-center">
                      <h4 className="text-2xl font-black italic tracking-tighter">Payment History</h4>
                      <button 
                        onClick={handleDownloadPaymentsCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download CSV
                      </button>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Date</th>
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Amount</th>
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Method</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mockAffiliatePayments.map(payment => (
                            <tr key={payment.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                              <td className="py-4 px-4">
                                <div className="font-bold text-sm text-slate-200">{payment.date}</div>
                                <div className="text-xs text-slate-500">{payment.id}</div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="text-sm font-bold text-emerald-400">${payment.amount.toFixed(2)}</div>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  payment.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                  {payment.status}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <div className="text-sm text-slate-300">{payment.method}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[3rem] p-10 flex flex-col gap-6 shadow-2xl overflow-hidden">
                    <h4 className="text-2xl font-black italic tracking-tighter">Referred Subscribers</h4>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Subscriber</th>
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Contact</th>
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Tier</th>
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                            <th className="py-4 px-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Commission (20%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mockReferredSubscribers.map(sub => (
                            <tr key={sub.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                              <td className="py-4 px-4">
                                <div className="font-bold text-sm text-slate-200">{sub.name}</div>
                                <div className="text-xs text-slate-500">Joined: {sub.signupDate}</div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="text-sm text-slate-300">{sub.phone}</div>
                                <div className="text-xs text-slate-500">{sub.email}</div>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  sub.tier === 'Elite' ? 'bg-amber-500/20 text-amber-400' :
                                  sub.tier === 'Pro' ? 'bg-indigo-500/20 text-indigo-400' :
                                  'bg-slate-500/20 text-slate-400'
                                }`}>
                                  {sub.tier}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  sub.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                                }`}>
                                  {sub.status === 'Pending' ? 'Pending (31 Days)' : 'Paid'}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <div className="text-sm font-bold text-emerald-400">${(sub.price * 0.2).toFixed(2)}</div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                  {sub.commissionPaid ? 'Paid Out' : (sub.status === 'Paid' ? 'Pending Payout' : 'Awaiting Payment')}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                    <div className="flex justify-between items-start mb-8">
                       <div>
                          <h3 className="text-6xl font-black italic tracking-tighter">Voice<span className="text-slate-800">Ledger</span></h3>
                          <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-2">Call History & Transcripts</p>
                       </div>
                       <div className="text-right">
                          <div className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Total Calls</div>
                          <div className="text-4xl font-black text-amber-500 leading-none">3</div>
                       </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-4">
                       {[
                         { id: 'H01', client: 'Sreedharan K.', date: '16/02/2026', duration: '3m 4s', summary: 'Property boundary dispute in Aluva. Neighbor is encroaching via new fence construction. Needs interim injunction against further work.' },
                         { id: 'H02', client: 'Elena Rodriguez', date: '15/02/2026', duration: '12m 15s', summary: 'Initial consultation regarding intellectual property theft. Competitor launched identical product features. Requested cease and desist draft.' },
                         { id: 'H03', client: 'Marcus Thorne', date: '10/02/2026', duration: '8m 42s', summary: 'Follow-up on real estate fraud case. Provided new evidence documents. Scheduled next court appearance strategy session.' }
                       ].map((record) => (
                         <div key={record.id} className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-8 flex flex-col group shadow-inner hover:bg-white/[0.05] transition-all cursor-pointer">
                            <div className="flex justify-between items-start mb-4">
                               <div>
                                  <div className="text-amber-500 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Session ID: {record.id}</div>
                                  <h2 className="text-3xl font-black italic tracking-tighter group-hover:text-indigo-400 transition-colors">{record.client}</h2>
                               </div>
                               <div className="text-right flex flex-col items-end gap-1">
                                  <div className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-slate-400 uppercase tracking-widest">{record.date}</div>
                                  <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{record.duration}</div>
                               </div>
                            </div>

                            <div className="bg-black/40 rounded-xl p-6 border border-white/5">
                               <div className="text-indigo-400 text-[9px] font-black uppercase tracking-[0.4em] mb-2">Transcript Summary:</div>
                               <p className="text-sm font-medium text-slate-400 leading-relaxed italic">
                                  "{record.summary}"
                               </p>
                            </div>
                         </div>
                       ))}
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

            {view === 'notifications' && (
               <div className="w-full h-full flex flex-col bg-[#070b14]">
                  <div className="p-8 border-b border-white/5 bg-[#0a0f1d] flex items-center justify-between shadow-lg shrink-0">
                     <div>
                       <div className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500 mb-2">Network Wide Communication</div>
                       <h3 className="text-4xl font-black tracking-tighter italic">HQ<span className="text-slate-500 not-italic">Notifications</span></h3>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-[#020617]/50">
                     <div className="max-w-4xl mx-auto space-y-6">
                        
                        {/* Static Links Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                           <div 
                             onClick={() => setView('affiliates')}
                             className="bg-gradient-to-br from-emerald-900/40 to-[#0a0f1d] border border-emerald-500/30 rounded-2xl p-6 cursor-pointer hover:border-emerald-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all group"
                           >
                              <div className="flex items-center gap-4 mb-4">
                                 <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/30 transition-colors">
                                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                 </div>
                                 <div>
                                    <h4 className="text-lg font-black italic tracking-tighter text-emerald-500">Affiliate Portal</h4>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">View Network & Earnings</div>
                                 </div>
                              </div>
                              <p className="text-sm text-slate-300 leading-relaxed">
                                 Access your complete list of referred advocates. View their phone numbers, emails, and subscription status (paid/pending). Download your detailed payment history as a CSV file.
                              </p>
                           </div>

                           <div className="bg-gradient-to-br from-indigo-900/40 to-[#0a0f1d] border border-indigo-500/30 rounded-2xl p-6">
                              <div className="flex items-center gap-4 mb-4">
                                 <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                 </div>
                                 <div>
                                    <h4 className="text-lg font-black italic tracking-tighter text-indigo-400">Your Referral Link</h4>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Share & Earn Commission</div>
                                 </div>
                              </div>
                              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                                 Distribute this link through your social media channels. When someone signs up using it, your coupon code is automatically embedded, and you earn a commission!
                              </p>
                              <div className="bg-black/40 p-3 rounded-xl border border-white/10 flex items-center justify-between group cursor-pointer hover:border-indigo-500/50 transition-all" onClick={() => {
                                 navigator.clipboard.writeText(`nexus.justice/ref/${currentAdvocateId || 'adv-992'}`);
                                 // Could add a toast notification here
                              }}>
                                 <code className="text-indigo-400 font-mono text-xs truncate">nexus.justice/ref/{currentAdvocateId || 'adv-992'}</code>
                                 <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-indigo-400 transition-colors">Copy</span>
                                    <svg className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8"></div>

                        {advocateNotifications.length === 0 ? (
                          <div className="text-center py-20 text-slate-500 font-medium">
                            No notifications from HQ at this time.
                          </div>
                        ) : (
                          advocateNotifications.map((notif) => (
                            <div key={notif.id} className={`bg-[#0a0f1d] border ${notif.read ? 'border-white/5 opacity-70' : 'border-indigo-500/30 shadow-lg shadow-indigo-500/10'} rounded-2xl p-6 flex gap-6 items-start transition-all`}>
                              <div className={`w-10 h-10 rounded-full ${notif.read ? 'bg-white/5' : 'bg-indigo-500/20'} flex items-center justify-center shrink-0`}>
                                <svg className={`w-5 h-5 ${notif.read ? 'text-slate-500' : 'text-indigo-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    {notif.type} • {notif.date}
                                  </div>
                                  {!notif.read && (
                                    <button 
                                      onClick={() => setAdvocateNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))}
                                      className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-colors"
                                    >
                                      Mark as read
                                    </button>
                                  )}
                                </div>
                                <p className={`text-sm leading-relaxed ${notif.read ? 'text-slate-400' : 'text-slate-200'}`}>{notif.message}</p>
                              </div>
                            </div>
                          ))
                        )}
                     </div>
                  </div>
               </div>
            )}

            {view === 'support-chat' && (
               <div className="w-full h-full flex flex-col bg-[#070b14]">
                  <div className="p-8 border-b border-white/5 bg-[#0a0f1d] flex items-center justify-between shadow-lg shrink-0">
                     <div>
                       <div className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-2">Admin Communication</div>
                       <h3 className="text-4xl font-black tracking-tighter italic">Support<span className="text-slate-500 not-italic">Chat</span></h3>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-[#020617]/50">
                     {supportMessages.map((msg) => (
                       <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         <div className={`p-6 rounded-[2rem] text-[14px] leading-relaxed border max-w-[70%] shadow-2xl ${
                           msg.role === 'user' 
                             ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-100 rounded-br-none' 
                             : 'bg-white/5 border-white/10 text-slate-300 rounded-bl-none'
                         }`}>
                           <div className="text-[9px] font-black uppercase tracking-widest mb-2 opacity-50">
                             {msg.role === 'user' ? 'You' : 'Nexus AI Support'}
                           </div>
                           {msg.text}
                         </div>
                       </div>
                     ))}
                     {isSendingSupport && (
                       <div className="flex justify-start">
                         <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 text-slate-400 rounded-bl-none animate-pulse text-sm">
                           Analyzing issue and generating solution...
                         </div>
                       </div>
                     )}
                  </div>
                  <div className="p-8 pb-32 bg-[#0a0f1d] border-t border-white/5 shrink-0">
                    <div className="max-w-4xl mx-auto flex gap-4">
                      <input 
                        type="text" 
                        value={supportInput}
                        onChange={(e) => setSupportInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendSupportMessage()}
                        placeholder="Describe your issue to the Admin Portal..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <button 
                        onClick={handleSendSupportMessage}
                        disabled={isSendingSupport || !supportInput.trim()}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-indigo-600/20"
                      >
                        Send
                      </button>
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
              <div className="w-full h-full p-12 flex flex-col gap-10 relative">
                <div className="flex justify-between items-end shrink-0">
                  <h3 className="text-5xl font-black tracking-tighter italic">Client<span className="text-slate-500 not-italic">Database</span></h3>
                  <button 
                    onClick={() => setIsAddingClient(true)}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                    Add New Client
                  </button>
                </div>
                
                {isAddingClient && (
                  <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in">
                    <div className="bg-[#0a0f1d] border border-white/10 rounded-[3rem] p-10 w-full max-w-3xl shadow-2xl flex flex-col gap-8">
                      <div className="flex justify-between items-center">
                        <h4 className="text-3xl font-black italic tracking-tighter">New<span className="text-slate-500 not-italic">Client</span></h4>
                        <button onClick={() => setIsAddingClient(false)} className="text-slate-500 hover:text-white transition-colors">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Name of Client *</label>
                          <input type="text" value={newClient.name || ''} onChange={e => setNewClient({...newClient, name: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="John Doe" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Phone Number *</label>
                          <input type="text" value={newClient.phone || ''} onChange={e => setNewClient({...newClient, phone: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="+1 555-0000" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Name of Court</label>
                          <input type="text" value={newClient.courtName || ''} onChange={e => setNewClient({...newClient, courtName: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="District Court" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Case Number</label>
                          <input type="text" value={newClient.caseNumber || ''} onChange={e => setNewClient({...newClient, caseNumber: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="OS 123/2026" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Opp. Advocate's Name</label>
                          <input type="text" value={newClient.oppAdvocateName || ''} onChange={e => setNewClient({...newClient, oppAdvocateName: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Jane Smith" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Opp. Advocate's Phone</label>
                          <input type="text" value={newClient.oppAdvocatePhone || ''} onChange={e => setNewClient({...newClient, oppAdvocatePhone: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="+1 555-1111" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Next Posting Date</label>
                          <input type="date" value={newClient.nextPostingDate || ''} onChange={e => setNewClient({...newClient, nextPostingDate: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Purpose of Posting</label>
                          <input type="text" value={newClient.purposeOfPosting || ''} onChange={e => setNewClient({...newClient, purposeOfPosting: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Hearing" />
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-4 mt-4">
                        <button onClick={() => setIsAddingClient(false)} className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleAddClient} className="px-8 py-3 bg-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all">Save Client</button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex-1 bg-[#0a0f1d] rounded-[3rem] border border-white/5 overflow-hidden flex flex-col shadow-2xl">
                  {/* Table Headers */}
                  <div className="grid grid-cols-12 gap-4 px-8 py-6 border-b border-white/5 bg-white/2 shrink-0">
                    <div className="col-span-1 text-[9px] font-black text-slate-500 uppercase tracking-widest">Sl No</div>
                    <div className="col-span-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Client Details</div>
                    <div className="col-span-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Court & Case</div>
                    <div className="col-span-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">Opp. Advocate</div>
                    <div className="col-span-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">Next Posting</div>
                    <div className="col-span-2 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Purpose</div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {clients.map((client) => (
                      <div key={client.slNo} className="grid grid-cols-12 gap-4 px-8 py-6 border-b border-white/5 hover:bg-white/[0.04] transition-all group cursor-pointer items-center">
                        <div className="col-span-1 font-black text-[14px] text-slate-600">{client.slNo}</div>
                        <div className="col-span-2 flex flex-col">
                          <span className="font-black text-[14px] group-hover:text-indigo-300 transition-colors uppercase italic tracking-tighter">{client.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono mt-1">{client.phone}</span>
                        </div>
                        <div className="col-span-2 flex flex-col">
                          <span className="text-[12px] text-slate-300 font-bold">{client.courtName}</span>
                          <span className="text-[10px] text-indigo-400 font-mono mt-1">{client.caseNumber}</span>
                        </div>
                        <div className="col-span-3 flex flex-col">
                          <span className="text-[12px] text-slate-300">{client.oppAdvocateName}</span>
                          <span className="text-[10px] text-slate-500 font-mono mt-1">{client.oppAdvocatePhone}</span>
                        </div>
                        <div className="col-span-2 flex flex-col">
                          <span className="text-[12px] text-emerald-400 font-bold">{client.nextPostingDate}</span>
                        </div>
                        <div className="col-span-2 text-right text-[11px] text-slate-400 font-medium">{client.purposeOfPosting}</div>
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
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #312e81; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4338ca; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
};

export default App;
