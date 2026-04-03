import { ArrowRight, Video, FileText, CheckCircle, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b px-6 py-4 flex justify-between items-center bg-white">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-slate-900">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white">M</div>
          Momentum AI
        </div>
        <div className="flex gap-4">
          <Link to="/login" className="px-4 py-2 font-medium text-slate-600 hover:text-slate-900">Log In</Link>
          <Link to="/login" className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors">Start Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-tight mb-8">
          Turn your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Google Meets</span><br />
          into instant action.
        </h1>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          Record meetings securely. Transcribe flawlessly. Extract action items, decisions, and summaries automatically using powerful AI models.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/login" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 text-lg">
            Try Momentum AI <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-24 text-left">
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
              <Video className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Flawless Recording</h3>
            <p className="text-slate-600">Our Chrome extension grabs meeting audio natively without disruptive bots joining your call.</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Groq Whisper Transcription</h3>
            <p className="text-slate-600">Get perfect, lightning-fast transcripts of multi-speaker conversations in seconds.</p>
          </div>
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-2">Gemini Flash Analysis</h3>
            <p className="text-slate-600">Automatically identify action items, assignees, clarity scores, and summaries.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
