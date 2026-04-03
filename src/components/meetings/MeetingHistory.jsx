import { useState, useEffect } from 'react';
import { Calendar, MessageSquare, Loader2, CheckCircle2, TrendingUp, Sparkles, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export default function MeetingHistory() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Q&A State
  const [activeChatMeeting, setActiveChatMeeting] = useState(null);
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    async function fetchMeetings() {
      // Fetch everything for the demo
      const { data } = await supabase
        .from('meetings')
        .select('*, tasks(id)')
        .order('created_at', { ascending: false });
        
      if (data) setMeetings(data);
      setLoading(false);
    }
    fetchMeetings();
    const interval = setInterval(fetchMeetings, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!chatQuestion.trim() || !activeChatMeeting) return;
    
    const userQ = chatQuestion;
    setChatQuestion("");
    setChatHistory(prev => [...prev, { role: 'user', text: userQ }]);
    setIsAnswering(true);

    try {
      const prompt = `
        You are a helpful AI assistant. Answer the user's question based strictly on this meeting transcript.
        Transcript: ${activeChatMeeting.transcript}
        Question: ${userQ}
      `;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      const answer = data.candidates[0].content.parts[0].text;
      setChatHistory(prev => [...prev, { role: 'ai', text: answer }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Sorry, I couldn't process that question right now." }]);
    } finally {
      setIsAnswering(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 text-slate-400">
      <Loader2 className="w-10 h-10 animate-spin mb-4" />
      <span className="font-black uppercase tracking-widest text-xs">Syncing Archive...</span>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center bg-white p-8 rounded-[32px] border-2 border-slate-50 shadow-xl">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2">Meeting Vault</h1>
          <p className="text-slate-500 font-medium capitalize">Intelligent records of every decision made.</p>
        </div>
        <div className="flex gap-4">
            <div className="bg-emerald-50 text-emerald-700 px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-xs uppercase tracking-widest border border-emerald-100 shadow-sm shadow-emerald-50">
                <TrendingUp className="w-4 h-4" /> Live Sync Active
            </div>
            <button className="bg-white border-2 border-slate-100 px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all text-slate-600 active:scale-95">
                <Filter className="w-4 h-4" /> Filter Records
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20">
        {meetings.map((m, i) => {
          let badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
          if (m.actionability < 80) badgeClass = "bg-amber-100 text-amber-800 border-amber-200";
          if (m.actionability < 60) badgeClass = "bg-rose-100 text-rose-800 border-rose-200";

          return (
            <div key={m.id} className="bg-white rounded-[40px] border-2 border-slate-50 shadow-2xl flex flex-col hover:border-blue-200 transition-all group relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Sparkles className="w-32 h-32 text-blue-600" />
               </div>

              <div className="p-10 border-b border-dashed border-slate-100 flex justify-between items-start relative z-10">
                <div className="max-w-[70%]">
                  <h3 className="text-2xl font-black text-slate-900 mb-3 group-hover:text-blue-600 transition-colors leading-tight">
                    {m.title}
                  </h3>
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 bg-slate-50 px-4 py-1.5 rounded-full w-fit">
                    <Calendar className="w-3.5 h-3.5"/> {new Date(m.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest shadow-lg ${badgeClass}`}>
                  Focus: {m.actionability || 0}%
                </div>
              </div>
              
              <div className="p-10 flex-1 relative z-10">
                <p className="text-sm text-slate-600 leading-[1.8] font-medium mb-8">
                  {m.summary}
                </p>
                <div className="flex gap-4">
                    <button 
                         onClick={() => { setActiveChatMeeting(m); setChatHistory([]); }}
                         className="px-6 py-3 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-blue-100 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                         <MessageSquare className="w-4 h-4" /> Ask Meeting AI
                    </button>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-4 py-2 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        {m.tasks ? m.tasks.length : 0} Actions Extracted
                    </div>
                </div>
              </div>
            </div>
          );
        })}
        {meetings.length === 0 && (
          <div className="col-span-2 p-24 text-center border-4 border-dashed border-slate-100 rounded-[48px] bg-white shadow-inner">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Vault Empty</h3>
            <p className="text-slate-300 mt-2 font-medium">Record a meeting to see momentum in action.</p>
          </div>
        )}
      </div>

      {/* Q&A Modal */}
      {activeChatMeeting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-[0_32px_128px_rgba(0,0,0,0.25)] w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden border-8 border-white">
            <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1 block">Context Search Intelligence</span>
                <h3 className="text-2xl font-black text-slate-900">{activeChatMeeting.title}</h3>
              </div>
              <button 
                onClick={() => setActiveChatMeeting(null)}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-950 transition-all hover:rotate-90"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 p-8 overflow-y-auto space-y-6 bg-slate-50/20">
              {chatHistory.length === 0 && (
                <div className="text-center py-20 px-8">
                  <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200/50">
                      <MessageSquare className="w-8 h-8 text-blue-500" />
                  </div>
                  <h4 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">AI Context Chat active</h4>
                  <p className="text-sm text-slate-400 font-medium">Ask something about the key points discussed during this call.</p>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-${msg.role === 'user' ? 'right' : 'left'}-4 duration-300`}>
                  <div className={`max-w-[90%] p-6 rounded-[24px] text-sm font-medium leading-relaxed shadow-xl ${
                    msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none shadow-blue-200' : 'bg-white border-2 border-slate-50 text-slate-700 rounded-bl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isAnswering && (
                <div className="flex justify-start">
                  <div className="bg-white border-2 border-slate-50 text-slate-900 px-6 py-4 rounded-[24px] rounded-bl-none shadow-xl flex items-center gap-3 text-xs font-black uppercase tracking-widest">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" /> Gemini is thinking...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleAskQuestion} className="p-8 border-t-2 border-slate-50 bg-white flex gap-4">
              <input 
                type="text" 
                value={chatQuestion}
                onChange={e => setChatQuestion(e.target.value)}
                placeholder="Query transcript..." 
                className="flex-1 px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-950 placeholder:text-slate-400 shadow-inner"
              />
              <button 
                type="submit" 
                disabled={isAnswering || !chatQuestion.trim()}
                className="px-8 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] disabled:opacity-50 hover:bg-slate-800 shadow-xl active:scale-95 transition-all"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
