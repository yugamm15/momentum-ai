import { Activity, CheckCircle2, AlertTriangle, Presentation } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

export default function DashboardOverview({ setTab }) {
  const [stats, setStats] = useState({ meetings: 0, avgScore: 0, pendingTasks: 0, risks: 0 });
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [activeTasks, setActiveTasks] = useState([]);

  useEffect(() => {
    async function fetchData() {
      // MVP: Fetch ALL data without user_id filter for the demo
      const [meetingsRes, tasksRes] = await Promise.all([
        supabase.from('meetings').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*, meetings(title)')
      ]);

      const meetings = meetingsRes.data || [];
      const tasks = tasksRes.data || [];

      // Calculate Stats
      const score = meetings.length > 0 ? meetings.reduce((acc, m) => acc + (m.actionability || 0), 0) / meetings.length : 0;
      const pending = tasks.filter(t => t.status !== 'done').length;
      const risks = tasks.filter(t => t.assignee === 'UNCLEAR' || t.deadline === 'Missing').length;

      setStats({ meetings: meetings.length, avgScore: Math.round(score), pendingTasks: pending, risks });
      setRecentMeetings(meetings.slice(0, 3));
      setActiveTasks(tasks.filter(t => t.status !== 'done').slice(0, 4));
    }
    fetchData();
    
    // Auto-refresh every 5 seconds for the "WOW" effect
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2">Workspace Intelligence</h1>
        <p className="text-slate-500 font-medium capitalize">Real-time meeting analytics for your team.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl border-2 border-slate-50 shadow-xl p-8 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex items-center gap-3 text-slate-400 mb-3">
            <Presentation className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Total Meetings</span>
          </div>
          <div className="text-4xl font-black text-slate-900">{stats.meetings}</div>
        </div>
        
        <div className="bg-white rounded-2xl border-2 border-slate-50 shadow-xl p-8 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex items-center gap-3 text-emerald-500 mb-3">
            <Activity className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Avg Focus Score</span>
          </div>
          <div className="text-4xl font-black text-emerald-600">{stats.avgScore}%</div>
        </div>
        
        <div className="bg-white rounded-2xl border-2 border-slate-50 shadow-xl p-8 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex items-center gap-3 text-blue-500 mb-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Pending Actions</span>
          </div>
          <div className="text-4xl font-black text-slate-900">{stats.pendingTasks}</div>
        </div>
        
        <div className="bg-white rounded-2xl border-2 border-rose-100 shadow-xl p-8 hover:scale-[1.02] transition-transform duration-300">
          <div className="flex items-center gap-3 text-rose-600 mb-3">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest text-rose-400 font-bold">Risk Flags</span>
          </div>
          <div className="text-4xl font-black text-rose-600">{stats.risks}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[32px] border-2 border-slate-50 shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30">
            <h2 className="text-xl font-black text-slate-900">Recent Extracts</h2>
            <p className="text-sm text-slate-500 font-medium">Automatic captures from your Google Meet calls.</p>
          </div>
          <div className="divide-y divide-slate-50">
            {recentMeetings.map(m => (
              <div 
                key={m.id}
                onClick={() => setTab('history')}
                className="p-8 hover:bg-slate-50 transition-all cursor-pointer flex justify-between items-center group"
              >
                <div>
                  <h4 className="font-black text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{m.title}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{new Date(m.created_at).toLocaleTimeString()}</p>
                </div>
                <div className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg ${m.actionability > 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {m.actionability || 0}% Score
                </div>
              </div>
            ))}
            {recentMeetings.length === 0 && <div className="p-12 text-center text-slate-400 font-bold text-sm tracking-widest uppercase">Waiting for first capture...</div>}
          </div>
        </div>

        <div className="bg-white rounded-[32px] border-2 border-slate-50 shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/30">
            <h2 className="text-xl font-black text-slate-900">Action Tracker</h2>
            <p className="text-sm text-slate-500 font-medium">Auto-assigned tasks from AI analysis.</p>
          </div>
          <div className="divide-y divide-slate-50">
            {activeTasks.map(t => (
              <div key={t.id} className="p-8 flex justify-between items-start hover:bg-slate-50 transition-all group">
                <div>
                  <h4 className="font-bold text-slate-900 mb-1 leading-tight">{t.title}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{t.meetings?.title || 'General'}</span>
                  </div>
                </div>
                <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-blue-100">
                  {t.status}
                </span>
              </div>
            ))}
            {activeTasks.length === 0 && <div className="p-12 text-center text-slate-400 font-bold text-sm tracking-widest uppercase">No pending actions!</div>}
          </div>
          <div className="p-6 border-t border-slate-50 bg-slate-50/30 text-center">
            <button 
              onClick={() => setTab('board')}
              className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
            >
              Enter Task Board →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
