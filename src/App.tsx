import React, { useState } from 'react';
import { Send, Loader2, Volume2 } from 'lucide-react';

export default function App() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string; audioUrl?: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      let audioUrl;
      if (data.audioBase64) {
        audioUrl = `data:audio/wav;base64,${data.audioBase64}`;
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.text, audioUrl },
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Sorry, an error occurred while processing your request.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden flex flex-col h-[80vh]">
        <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
          <h1 className="text-xl font-semibold text-zinc-800">Nexus Justice Voice Agent</h1>
          <p className="text-sm text-zinc-500">Powered by Gemini & Sarvam AI</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-400">
              Send a message to start the conversation
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
                {msg.audioUrl && (
                  <div className="mt-2 flex items-center gap-2 bg-zinc-50 rounded-full pr-4 p-1 border border-zinc-200">
                    <button 
                      onClick={() => new Audio(msg.audioUrl).play()}
                      className="p-2 bg-zinc-200 rounded-full hover:bg-zinc-300 transition-colors"
                      title="Play Audio"
                    >
                      <Volume2 className="w-4 h-4 text-zinc-700" />
                    </button>
                    <span className="text-xs text-zinc-500 font-medium">Listen</span>
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex items-start">
              <div className="bg-zinc-100 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                <span className="text-sm text-zinc-500">Thinking...</span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-100 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a legal question..."
              className="flex-1 rounded-xl border border-zinc-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-zinc-900 text-white p-2 px-4 rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
