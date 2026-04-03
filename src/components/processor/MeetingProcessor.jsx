import { useState, useRef } from 'react';
import { UploadCloud, FileAudio, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export default function MeetingProcessor({ onComplete }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, transcribing, analyzing, saving, done
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processMeeting = async () => {
    if (!file) return;
    setStatus('transcribing');
    setError('');

    try {
      // 1. Transcribe with Groq Whisper
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", "whisper-large-v3");
      formData.append("response_format", "json");

      const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: formData
      });

      if (!groqRes.ok) throw new Error("Failed to transcribe audio. Ensure file is under 25MB.");
      const groqData = await groqRes.json();
      const transcript = groqData.text;

      // 2. Analyze with Gemini
      setStatus('analyzing');
      const prompt = `
        You are an expert AI meeting assistant. Read this meeting transcript and extract structured data.
        Return ONLY a JSON object with this exact structure, no markdown formatting or backticks:
        {
          "title": "A short clear title for the meeting",
          "summary": "A concise 2-3 sentence summary of what was discussed",
          "actionability_score": 85,
          "clarity_score": 90,
          "tasks": [
            { "title": "Task description", "assignee": "Name or UNCLEAR", "deadline": "Date or Missing" }
          ]
        }
        Transcript:
        ${transcript}
      `;

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!geminiRes.ok) throw new Error("Failed to analyze transcript with Gemini.");
      const geminiData = await geminiRes.json();
      let analysisText = geminiData.candidates[0].content.parts[0].text;
      
      // Clean potential markdown blocks
      analysisText = analysisText.replace(/```json/g, '').replace(/```/g, '').trim();
      const analysis = JSON.parse(analysisText);

      // Save to Supabase
      setStatus('saving');
      
      const { data: { user } } = await supabase.auth.getUser();

      // Save meeting
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          user_id: user?.id,
          title: analysis.title,
          summary: analysis.summary,
          transcript: transcript,
          clarity: analysis.clarity_score,
          actionability: analysis.actionability_score
        })
        .select()
        .single();

      if (meetingError) {
        console.error("Supabase error:", meetingError);
      } else if (analysis.tasks && meetingData) {
        // Save tasks
        const tasksToInsert = analysis.tasks.map(t => ({
          user_id: user?.id,
          meeting_id: meetingData.id,
          title: t.title,
          assignee: t.assignee,
          deadline: t.deadline || 'Missing',
          status: 'todo'
        }));
        await supabase.from('tasks').insert(tasksToInsert);
      }

      setStatus('done');
      if (onComplete) onComplete();

    } catch (err) {
      console.error(err);
      setError(err.message || 'An unknown error occurred during processing.');
      setStatus('idle');
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl border shadow-sm max-w-xl mx-auto my-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Upload Meeting Audio</h2>
        <p className="text-slate-500 mt-2">Drop the .webm file recorded by the Momentum Chrome Extension.</p>
      </div>

      <div 
        className="border-2 border-dashed border-slate-300 bg-slate-50 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors mb-6"
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="audio/webm, audio/mp3, audio/wav, audio/m4a" 
          onChange={handleFileChange}
        />
        
        {file ? (
          <>
            <FileAudio className="w-12 h-12 text-blue-600 mb-3" />
            <p className="font-medium text-slate-900">{file.name}</p>
            <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </>
        ) : (
          <>
            <UploadCloud className="w-12 h-12 text-slate-400 mb-3" />
            <p className="font-medium text-slate-900">Click to browse or drag file here</p>
            <p className="text-xs text-slate-500 mt-1">Supports .webm from Momentum Extension</p>
          </>
        )}
      </div>

      {error && <div className="p-3 mb-6 bg-rose-50 text-rose-700 text-sm rounded-md border border-rose-200">{error}</div>}

      <button 
        onClick={processMeeting}
        disabled={!file || status !== 'idle'}
        className="w-full py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {status === 'idle' && 'Process Meeting AI 🚀'}
        {status === 'transcribing' && <><Loader2 className="w-5 h-5 animate-spin" /> Transcribing with Groq Whisper...</>}
        {status === 'analyzing' && <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing with Gemini Flash...</>}
        {status === 'saving' && <><Loader2 className="w-5 h-5 animate-spin" /> Saving to Supabase...</>}
        {status === 'done' && <><CheckCircle2 className="w-5 h-5" /> Processing Complete!</>}
      </button>
    </div>
  );
}
