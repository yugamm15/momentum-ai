import { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronRight, CheckCircle2, MessageSquare, Loader2 } from 'lucide-react';
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('meetings')
        .select('*, tasks(id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (data) setMeetings(data);
      setLoading(false);
    }
    fetchMeetings();
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
        
        MEETING TRANSCRIPT:
        ${activeChatMeeting.transcript}
        
        USER QUESTION: ${userQ}
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

  if (loading) return <div className="p-8 text-slate-500">Loading meetings...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Meetings</h1>
          <p className="text-slate-500">All your extracted meeting data and AI summaries.</p>
        </div>
        <button className="px-4 py-2 bg-white border shadow-sm rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Connect Calendar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {meetings.map(m => {
          let badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
          if (m.actionability < 80) badgeClass = "bg-amber-100 text-amber-700 border-amber-200";
          if (m.actionability < 60) badgeClass = "bg-rose-100 text-rose-700 border-rose-200";

          return (
            <div key={m.id} className="bg-white rounded-xl border shadow-sm flex flex-col hover:border-slate-300 transition-colors group">
              <div className="p-6 border-b flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {m.title}
                  </h3>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> {new Date(m.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded-md border text-xs font-bold ${badgeClass}`}>
                  Score {m.actionability || 0}
                </div>
              </div>
              
              <div className="p-6 flex-1">
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  {m.summary}
                </p>
                <button 
                  onClick={() => { setActiveChatMeeting(m); setChatHistory([]); }}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded outline-none hover:bg-blue-100 transition-colors flex items-center gap-1"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Chat with Meeting
                </button>
              </div>
              
              <div className="p-4 bg-slate-50 border-t rounded-b-xl flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <strong>{m.tasks ? m.tasks.length : 0}</strong> extracted tasks
                </div>
              </div>
            </div>
          );
        })}
        {meetings.length === 0 && (
          <div className="col-span-2 p-12 text-center text-slate-500 border-2 border-dashed rounded-xl">
            No meetings found. Upload a recording to get started!
          </div>
        )}
      </div>

      {/* Q&A Modal */}
      {activeChatMeeting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
              <div>
                <h3 className="font-bold text-slate-900">Q&A: {activeChatMeeting.title}</h3>
                <p className="text-xs text-slate-500">Ask Gemini anything about this meeting</p>
              </div>
              <button 
                onClick={() => setActiveChatMeeting(null)}
                className="w-8 h-8 flex items-center justify-center rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
              {chatHistory.length === 0 && (
                <div className="text-center text-slate-400 text-sm mt-10">
                  Type a question below to search the transcript.
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
                    msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border text-slate-700 rounded-bl-none shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isAnswering && (
                <div className="flex justify-start">
                  <div className="bg-white border text-slate-700 p-3 rounded-lg rounded-bl-none shadow-sm flex items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Thinking...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleAskQuestion} className="p-3 border-t bg-white rounded-b-xl flex gap-2">
              <input 
                type="text" 
                value={chatQuestion}
                onChange={e => setChatQuestion(e.target.value)}
                placeholder="Ask e.g. What did Alice say about the budget?" 
                className="flex-1 px-3 py-2 border rounded outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <button 
                type="submit" 
                disabled={isAnswering || !chatQuestion.trim()}
                className="px-4 py-2 bg-slate-900 text-white rounded font-medium disabled:opacity-50 text-sm"
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
