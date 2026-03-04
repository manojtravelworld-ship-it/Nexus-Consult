import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { ConnectionStatus } from '../types';

interface VoiceInterfaceProps {
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;
}

export function VoiceInterface({ status, setStatus }: VoiceInterfaceProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setStatus(ConnectionStatus.CONNECTED);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setStatus(ConnectionStatus.ERROR);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        
        // Send to backend
        const res = await fetch('/api/voice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ audio: base64Audio }),
        });

        if (!res.ok) {
          throw new Error('Failed to process audio');
        }

        const data = await res.json();
        setTranscript(data.transcript);
        setResponse(data.response);
        
        // Play audio response if available
        if (data.audioResponse) {
          const audio = new Audio(data.audioResponse);
          audio.play();
        }
      };
    } catch (error) {
      console.error('Error processing audio:', error);
      setStatus(ConnectionStatus.ERROR);
    } finally {
      setIsProcessing(false);
      setStatus(ConnectionStatus.DISCONNECTED);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto space-y-8">
      <div className="relative">
        <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 ${isRecording ? 'bg-red-500/30 scale-150' : 'bg-blue-500/20 scale-100'}`} />
        <button
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={isProcessing}
          className={`relative z-10 flex items-center justify-center w-32 h-32 rounded-full shadow-2xl transition-all duration-300 ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : 'bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isProcessing ? (
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          ) : isRecording ? (
            <Square className="w-12 h-12 text-white fill-current" />
          ) : (
            <Mic className="w-12 h-12 text-blue-400" />
          )}
        </button>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-light tracking-tight text-white">
          {isProcessing ? 'Processing...' : isRecording ? 'Listening...' : 'Tap to speak'}
        </h2>
        <p className="text-slate-400 text-sm">
          {status === ConnectionStatus.ERROR ? (
            <span className="flex items-center justify-center text-red-400">
              <AlertCircle className="w-4 h-4 mr-1" />
              Connection error
            </span>
          ) : (
            'Powered by Gemini & Sarvam AI'
          )}
        </p>
      </div>

      {(transcript || response) && (
        <div className="w-full mt-8 space-y-4">
          {transcript && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
              <p className="text-sm font-medium text-blue-400 mb-2 uppercase tracking-wider">You said</p>
              <p className="text-slate-200 text-lg leading-relaxed">{transcript}</p>
            </div>
          )}
          
          {response && (
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-2xl p-6 backdrop-blur-sm">
              <p className="text-sm font-medium text-blue-400 mb-2 uppercase tracking-wider">AI Response</p>
              <p className="text-slate-200 text-lg leading-relaxed">{response}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
