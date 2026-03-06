
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

  const handleSendSupportMessage = async () => {
    if (!supportInput.trim()) return;
    const userMsg: SupportMessage = { id: Date.now(), role: 'user', text: supportInput };
    setSupportMessages(prev => [...prev, userMsg]);
    setSupportInput("");
    setIsSendingSupport(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: supportInput, systemInstruction: "You are the Nexus Support AI. Help the user with platform issues." })
      });
      const data = await res.json();
      setSupportMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: data.reply }]);
    } catch (err) {
      console.error(err);
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
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                          placeholder="ADV-XXXX"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Neural Passphrase</label>
                        <input 
                          type="password" 
                          value={loginForm.passphrase}
                          onChange={e => setLoginForm({...loginForm, passphrase: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                          placeholder="••••••••"
                        />
                      </div>
                      <button 
                        onClick={() => {
                          if (loginForm.id && loginForm.passphrase) {
                            setCurrentAdvocateId(loginForm.id);
                            localStorage.setItem('nexus_advocate_id', loginForm.id);
                            setView('command');
                          }
                        }}
                        className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 shadow-xl transition-all"
                      >
                        Establish Uplink
                      </button>
                      <div className="flex justify-between items-center">
                        <button onClick={() => setUplinkStep('register')} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">New Registration</button>
                        <button onClick={() => setUplinkStep('forgot-password')} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Forgot Passphrase</button>
                      </div>
                    </div>
                  )}

                  {uplinkStep === 'register' && (
                    <div className="space-y-4 max-w-2xl mx-auto overflow-y-auto max-h-[60vh] pr-4 custom-scrollbar">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Full Name</label>
                          <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Phone Number</label>
                          <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">State</label>
                          <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500">
                            <option value="">Select State</option>
                            {Object.keys(locationData).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">District</label>
                          <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Primary Court</label>
                        <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Referral Code (Optional)</label>
                        <input type="text" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500" />
                      </div>
                      <button 
                        onClick={() => setUplinkStep('login')}
                        className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 shadow-xl transition-all mt-4"
                      >
                        Submit Registration
                      </button>
                    </div>
                  )}

                  {uplinkStep === 'forgot-password' && (
                    <div className="space-y-6 max-w-xl mx-auto text-center">
                      <p className="text-slate-400 text-sm">Please contact your Agency HQ administrator or the Master AI support node to reset your neural passphrase.</p>
                      <button onClick={() => setUplinkStep('login')} className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors">Return to Uplink</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {view === 'command' && (
              <div className="w-full h-full flex flex-col relative bg-black overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-5" />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950" />
                
                <div className="relative z-10 flex flex-col h-full p-6">
                  <div className="flex-1 flex items-center justify-center relative">
                    {/* Neural Core Visualization */}
                    <div className="relative w-96 h-96 flex items-center justify-center">
                      <div className={`absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-[spin_10s_linear_infinite] ${status === ConnectionStatus.CONNECTED ? 'border-indigo-500/40' : ''}`} />
                      <div className={`absolute inset-4 rounded-full border border-indigo-500/10 animate-[spin_15s_linear_infinite_reverse] ${status === ConnectionStatus.CONNECTED ? 'border-indigo-500/30' : ''}`} />
                      
                      <div className="relative z-20 flex flex-col items-center gap-6">
                        <button 
                          onClick={() => toggleHardware('mic')}
                          disabled={isActivating}
                          className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 group relative ${micEnabled ? 'bg-indigo-600 shadow-[0_0_50px_rgba(79,70,229,0.4)]' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}
                        >
                          {isActivating ? (
                            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className={`w-12 h-12 ${micEnabled ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                          )}
                        </button>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Neural Uplink</span>
                          <span className={`text-xs font-black uppercase tracking-widest ${status === ConnectionStatus.CONNECTED ? 'text-indigo-400' : 'text-slate-600'}`}>
                            {status === ConnectionStatus.CONNECTED ? 'ACTIVE' : 'STANDBY'}
                          </span>
                        </div>
                      </div>

                      {/* Audio Visualizer Rings */}
                      {micEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          {[...Array(3)].map((_, i) => (
                            <div 
                              key={i}
                              className="absolute rounded-full border border-indigo-500/30"
                              style={{
                                width: `${100 + (micLevel * 100) + (i * 40)}%`,
                                height: `${100 + (micLevel * 100) + (i * 40)}%`,
                                opacity: 1 - (i * 0.3),
                                transition: 'width 0.1s ease-out, height 0.1s ease-out'
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Camera Feed Overlay */}
                    {cameraEnabled && (
                      <div className="absolute top-0 right-0 w-80 aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-black group">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-indigo-500/10 pointer-events-none" />
                        <div className="absolute top-4 left-4 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-white drop-shadow-md">Live Vision Node</span>
                        </div>
                        <button 
                          onClick={() => toggleHardware('camera')}
                          className="absolute bottom-4 right-4 p-2 bg-black/50 hover:bg-black/80 rounded-lg text-white/60 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bottom Controls */}
                  <div className="mt-auto flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => toggleHardware('camera')}
                        className={`p-4 rounded-2xl border transition-all ${cameraEnabled ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 max-w-2xl bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-6 flex items-center gap-6">
                      <div className="flex-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Live Transcription</div>
                        <div className="text-sm font-medium text-slate-300 line-clamp-2 min-h-[2.5rem]">
                          {userTranscription || aiTranscription || "Waiting for neural input..."}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setView('interaction-feed')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                        <button onClick={() => downloadPDF()} className="p-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white transition-all shadow-lg shadow-indigo-600/20">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'reading-room' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">READING <span className="text-indigo-500">ROOM</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Real-time neural OCR & document analysis</p>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => toggleHardware('camera')}
                        className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${cameraEnabled ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'}`}
                      >
                        {cameraEnabled ? 'Deactivate Vision' : 'Initialize Vision'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="aspect-[3/4] bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] overflow-hidden relative group">
                      {cameraEnabled ? (
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                          <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                            <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </div>
                          <h3 className="text-lg font-black italic tracking-tight text-slate-400 mb-2">VISION NODE OFFLINE</h3>
                          <p className="text-xs text-slate-600 font-bold uppercase tracking-widest leading-relaxed">Activate camera sensors to begin real-time document scanning.</p>
                        </div>
                      )}
                      <div className="absolute inset-0 border-[20px] border-black/20 pointer-events-none" />
                      <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none" />
                    </div>

                    <div className="flex flex-col gap-6">
                      <div className="flex-1 bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Neural Analysis Output</span>
                          <div className="flex gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                             <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Live Sync</span>
                          </div>
                        </div>
                        <div className="flex-1 text-sm text-slate-400 leading-relaxed font-medium overflow-y-auto custom-scrollbar pr-4">
                          {aiTranscription || "Position a document in front of the camera for real-time extraction and summary..."}
                        </div>
                        <div className="mt-8 pt-8 border-t border-white/5 flex gap-4">
                           <button onClick={() => downloadPDF()} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all">Export PDF</button>
                           <button onClick={() => downloadWord()} className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all">Export Word</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'toolbox' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">DOCUMENT <span className="text-indigo-500">TOOLBOX</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Static document capture and conversion engine</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-6">
                      <div className="aspect-video bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] overflow-hidden relative">
                        {isScanningToolbox ? (
                          <div className="w-full h-full relative">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-64 h-64 border-2 border-indigo-500/50 rounded-3xl relative">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 -translate-x-1 -translate-y-1" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 translate-x-1 -translate-y-1" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 -translate-x-1 translate-y-1" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 translate-x-1 translate-y-1" />
                              </div>
                            </div>
                            <button 
                              onClick={handleToolboxCaptureAndStop}
                              className="absolute bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-slate-200 transition-all"
                            >
                              Capture Frame
                            </button>
                          </div>
                        ) : toolboxImage ? (
                          <div className="w-full h-full relative group">
                            <img src={toolboxImage} className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <button onClick={() => setToolboxImage(null)} className="px-6 py-3 bg-rose-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px]">Discard Scan</button>
                            </div>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                            <button 
                              onClick={() => { setIsScanningToolbox(true); toggleHardware('camera'); }}
                              className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 hover:bg-white/10 transition-all"
                            >
                              <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </button>
                            <h3 className="text-lg font-black italic tracking-tight text-slate-400 mb-2">NO ACTIVE SCAN</h3>
                            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest leading-relaxed">Initialize the scanner to capture a static document frame.</p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          disabled={!toolboxImage}
                          onClick={() => downloadPDF(true)}
                          className="py-5 bg-[#0a0f1d] border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 hover:text-white transition-all disabled:opacity-50"
                        >
                          Convert to PDF
                        </button>
                        <button 
                          disabled={!toolboxImage}
                          onClick={() => downloadWord(true)}
                          className="py-5 bg-[#0a0f1d] border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 hover:text-white transition-all disabled:opacity-50"
                        >
                          Convert to Word
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-10">
                       <h3 className="text-xl font-black italic tracking-tight text-white mb-6">CONVERSION LOGIC</h3>
                       <div className="space-y-6">
                          <div className="flex gap-4">
                             <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                             </div>
                             <div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-200">Optical Character Recognition</h4>
                                <p className="text-[10px] text-slate-500 font-bold leading-relaxed mt-1">Advanced neural networks extract text from scanned images with 99.8% accuracy.</p>
                             </div>
                          </div>
                          <div className="flex gap-4">
                             <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                             </div>
                             <div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-200">Format Preservation</h4>
                                <p className="text-[10px] text-slate-500 font-bold leading-relaxed mt-1">Maintains headers, tables, and structural elements during document reconstruction.</p>
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'clients' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">CLIENT <span className="text-indigo-500">RECORDS</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Neural database of active and historical client nodes</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map(client => (
                      <div key={client.slNo} className="bg-[#0a0f1d] border border-white/5 rounded-3xl p-6 hover:border-indigo-500/30 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-black italic">
                            {client.name.charAt(0)}
                          </div>
                          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500">
                            Active
                          </span>
                        </div>
                        <h3 className="text-lg font-black italic tracking-tight text-white mb-1">{client.name}</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">{client.courtName}</p>
                        <div className="space-y-2 mb-6">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-slate-600 uppercase tracking-widest">Next Posting</span>
                            <span className="text-slate-400">{client.nextPostingDate}</span>
                          </div>
                        </div>
                        <button className="w-full py-3 bg-white/5 hover:bg-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-all">Open Neural File</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === 'consult' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">VIRTUAL <span className="text-indigo-500">CONSULT</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Secure encrypted video uplink for remote advocacy</p>
                    </div>
                  </div>
                  <div className="aspect-video bg-[#0a0f1d] border border-white/5 rounded-[3rem] flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
                    <div className="relative z-10">
                      <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 mx-auto">
                        <svg className="w-12 h-12 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" /></svg>
                      </div>
                      <h3 className="text-2xl font-black italic tracking-tight text-white mb-4">UPLINK READY</h3>
                      <p className="text-sm text-slate-500 font-bold uppercase tracking-widest max-w-md mx-auto leading-relaxed mb-10">Select a client node to initialize a secure peer-to-peer consultation channel.</p>
                      <button className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 shadow-2xl shadow-indigo-600/20 transition-all">Initialize Uplink</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'archive' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">NEURAL <span className="text-indigo-500">ARCHIVE</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Cold storage for resolved case nodes and historical data</p>
                    </div>
                  </div>
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Case ID</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Client Node</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Resolution</th>
                          <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Archived Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <tr key={i} className="hover:bg-white/5 transition-colors cursor-pointer group">
                            <td className="px-8 py-6 text-xs font-black italic text-indigo-400">#ARC-2024-{1000 + i}</td>
                            <td className="px-8 py-6 text-xs font-bold text-slate-300">Historical Client {i}</td>
                            <td className="px-8 py-6">
                              <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500">Resolved</span>
                            </td>
                            <td className="px-8 py-6 text-xs font-bold text-slate-500">Oct {10 + i}, 2023</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {view === 'affiliates' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">AFFILIATE <span className="text-emerald-500">NETWORK</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Manage referrals, rewards, and network growth nodes</p>
                    </div>
                    <button onClick={() => setView('home')} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                    <div className="lg:col-span-2 space-y-8">
                      <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-10">
                        <h3 className="text-xl font-black italic tracking-tight text-white mb-6">YOUR PERFORMANCE</h3>
                        <div className="grid grid-cols-3 gap-6">
                           <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                              <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Referrals</div>
                              <div className="text-2xl font-black italic text-white">12</div>
                           </div>
                           <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                              <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Active Subs</div>
                              <div className="text-2xl font-black italic text-emerald-500">8</div>
                           </div>
                           <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                              <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Earned</div>
                              <div className="text-2xl font-black italic text-white">$450.00</div>
                           </div>
                        </div>
                      </div>

                      <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-10">
                        <h3 className="text-xl font-black italic tracking-tight text-white mb-6">REFERRAL LINK</h3>
                        <div className="flex gap-4">
                           <div className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xs text-slate-400 font-mono flex items-center">
                              https://nexusjustice.ai/join?ref=ADV-1001
                           </div>
                           <button className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all">Copy Link</button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-10">
                       <h3 className="text-xl font-black italic tracking-tight text-white mb-6">REWARDS HUB</h3>
                       <div className="space-y-6">
                          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl">
                             <h4 className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-2">Next Payout</h4>
                             <div className="text-3xl font-black italic text-white mb-1">$120.00</div>
                             <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Scheduled for March 1st, 2026</p>
                          </div>
                          <button className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all">View Payout History</button>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'interaction-feed' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-4xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">INTERACTION <span className="text-indigo-500">FEED</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Real-time stream of neural interactions and AI processing</p>
                    </div>
                  </div>
                  <div className="space-y-6">
                    {history.map((msg, i) => (
                      <div key={i} className={`p-6 rounded-3xl border ${msg.role === 'user' ? 'bg-white/5 border-white/10 ml-12' : 'bg-indigo-600/10 border-indigo-500/20 mr-12'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-[8px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-slate-500' : 'text-indigo-400'}`}>
                            {msg.role === 'user' ? 'Advocate Node' : 'Neural Core'}
                          </span>
                          <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">12:45 PM</span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium">{msg.text}</p>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <div className="text-center py-20">
                        <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">No neural interactions recorded in current session.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {view === 'notifications' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-4xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">NEURAL <span className="text-indigo-500">ALERTS</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Priority system notifications and case updates</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {advocateNotifications.map(notif => (
                      <div key={notif.id} className={`p-6 rounded-3xl border border-white/5 bg-[#0a0f1d] flex items-start gap-6 hover:border-white/10 transition-all ${!notif.read ? 'border-l-4 border-l-indigo-500' : ''}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          notif.type === 'payment' ? 'bg-emerald-500/10 text-emerald-500' : 
                          'bg-indigo-500/10 text-indigo-500'
                        }`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-sm font-black italic tracking-tight text-white">{notif.type === 'payment' ? 'Payment Alert' : 'System Update'}</h4>
                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{notif.date}</span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">{notif.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === 'support-chat' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">AGENCY <span className="text-indigo-500">SUPPORT</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Direct neural link to Agency HQ support nodes</p>
                    </div>
                  </div>
                  <div className="flex-1 bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] flex flex-col overflow-hidden">
                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-6">
                       <div className="flex gap-4 mr-12">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                             <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          </div>
                          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                             <p className="text-sm text-slate-300 font-medium leading-relaxed">Greetings Advocate. How can Agency HQ assist your current mission?</p>
                          </div>
                       </div>
                    </div>
                    <div className="p-6 bg-black/40 border-t border-white/5 flex gap-4">
                       <input 
                        type="text" 
                        placeholder="Type your message to Agency HQ..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                       />
                       <button className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all">Send</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Agency HQ Views */}
            {view === 'agency-hq' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">AGENCY <span className="text-indigo-500">HQ</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Central command and control for the Nexus Justice network</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {[
                      { label: 'Active Advocates', value: '1,284', change: '+12%', icon: '👥' },
                      { label: 'Total Case Nodes', value: '42,902', change: '+8%', icon: '📁' },
                      { label: 'Neural Uplinks', value: '892', change: '+24%', icon: '⚡' },
                      { label: 'Network Health', value: '99.9%', change: 'Stable', icon: '🛡️' }
                    ].map((stat, i) => (
                      <div key={i} className="bg-[#0a0f1d] border border-white/5 rounded-3xl p-6">
                        <div className="text-2xl mb-4">{stat.icon}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{stat.label}</div>
                        <div className="text-2xl font-black italic text-white mb-2">{stat.value}</div>
                        <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">{stat.change}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === 'agency-database' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">AGENCY <span className="text-indigo-500">DATABASE</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Master repository of all network entities and interactions</p>
                    </div>
                  </div>
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest text-center py-20">Master database access restricted to Level 5 administrators.</p>
                  </div>
                </div>
              </div>
            )}

            {view === 'agency-messages' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">AGENCY <span className="text-indigo-500">MESSAGES</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Internal encrypted communication channels for HQ staff</p>
                    </div>
                  </div>
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest text-center py-20">No active staff communications detected.</p>
                  </div>
                </div>
              </div>
            )}

            {view === 'agency-broadcasts' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">AGENCY <span className="text-indigo-500">BROADCASTS</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Network-wide emergency alerts and system updates</p>
                    </div>
                  </div>
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8">
                    <button className="px-8 py-4 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-rose-500 transition-all">Initialize Emergency Broadcast</button>
                  </div>
                </div>
              </div>
            )}

            {view === 'agency-knowledge' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">AGENCY <span className="text-indigo-500">KNOWLEDGE</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Proprietary legal frameworks and AI training data</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-[#0a0f1d] border border-white/5 rounded-3xl p-8">
                       <h3 className="text-lg font-black italic tracking-tight text-white mb-4">Neural Training Sets</h3>
                       <div className="space-y-4">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                               <span className="text-xs font-bold text-slate-300">Legal Dataset v{i}.0</span>
                               <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Optimized</span>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'agency-prompts' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">AGENCY <span className="text-indigo-500">PROMPTS</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Master system instructions for all network AI nodes</p>
                    </div>
                  </div>
                  <div className="space-y-8">
                    {[
                      { id: 'admin', label: 'MASTER AI', value: adminSystemPrompt, setter: setAdminSystemPrompt },
                      { id: 'advocate', label: 'ADVOCATE AI', value: advocateSystemPrompt, setter: setAdvocateSystemPrompt },
                      { id: 'affiliate', label: 'AFFILIATE AI', value: affiliateSystemPrompt, setter: setAffiliateSystemPrompt }
                    ].map((p) => (
                      <div key={p.id} className="bg-[#0a0f1d] border border-white/5 rounded-3xl p-8">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-black italic tracking-tight text-white uppercase">{p.label} CORE</h3>
                          <button className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300">Update Core Logic</button>
                        </div>
                        <textarea 
                          value={p.value}
                          onChange={(e) => p.setter(e.target.value)}
                          className="w-full h-48 bg-black/40 border border-white/10 rounded-2xl p-6 text-xs text-slate-400 font-mono focus:outline-none focus:border-indigo-500 transition-all custom-scrollbar"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === 'agency-connectivity' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">AGENCY <span className="text-indigo-500">CONNECTIVITY</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Real-time monitoring of all active neural uplinks</p>
                    </div>
                  </div>
                  <div className="bg-[#0a0f1d] border border-white/5 rounded-[2.5rem] p-8">
                    <div className="flex items-center gap-4 mb-8">
                       <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                       <span className="text-xs font-black uppercase tracking-widest text-white">Global Network Online</span>
                    </div>
                    <div className="h-64 bg-black/40 rounded-3xl border border-white/10 flex items-center justify-center">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 italic">Neural Map Rendering...</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'agency-api-usage' && (
              <div className="w-full h-full flex flex-col p-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
                <div className="max-w-6xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">AGENCY <span className="text-indigo-500">API USAGE</span></h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Resource consumption metrics for external neural APIs</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-[#0a0f1d] border border-white/5 rounded-3xl p-8">
                       <h3 className="text-lg font-black italic tracking-tight text-white mb-6">Token Consumption</h3>
                       <div className="h-48 flex items-end gap-4">
                          {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
                            <div key={i} className="flex-1 bg-indigo-500/20 rounded-t-lg relative group">
                               <div className="absolute bottom-0 left-0 right-0 bg-indigo-500 rounded-t-lg transition-all duration-1000" style={{ height: `${h}%` }} />
                            </div>
                          ))}
                       </div>
                       <div className="flex justify-between mt-4 text-[8px] font-black uppercase tracking-widest text-slate-600">
                          <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;

