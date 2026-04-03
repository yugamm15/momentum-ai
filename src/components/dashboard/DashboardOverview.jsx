import { Activity, CheckCircle2, AlertTriangle, Presentation } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

export default function DashboardOverview({ setTab }) {
  const [stats, setStats] = useState({ meetings: 0, avgScore: 0, pendingTasks: 0, risks: 0 });
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [activeTasks, setActiveTasks] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [meetingsRes, tasksRes] = await Promise.all([
        supabase.from('meetings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('*, meetings(title)').eq('user_id', user.id)
      ]);

      const meetings = meetingsRes.data || [];
      const tasks = tasksRes.data || [];

      // Calculate Stats
      const score = meetings.length > 0 ? meetings.reduce((acc, m) => acc + (m.actionability || 0), 0) / meetings.length : 0;
      const pending = tasks.filter(t => t.status !== 'done').length;
      const risks = tasks.filter(t => t.assignee === 'UNCLEAR' || t.deadline === 'Missing').length;

      setStats({ meetings: meetings.length, avgScore: Math.round(score), pendingTasks: pending, risks });
      setRecentMeetings(meetings.slice(0, 3));
      
      // Get incomplete tasks
      setActiveTasks(tasks.filter(t => t.status !== 'done').slice(0, 4));
    }
    fetchData();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Workspace Overview</h1>
        <p className="text-slate-500">Welcome to Momentum AI. Here is what your team is executing.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Presentation className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wider">Total Meetings</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.meetings}</div>
        </div>
        
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium uppercase tracking-wider">Avg Score</span>
          </div>
          <div className="text-3xl font-bold text-emerald-600">{stats.avgScore}/100</div>
        </div>
        
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium uppercase tracking-wider">Pending Tasks</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.pendingTasks}</div>
        </div>
        
        <div className="bg-white rounded-xl border border-rose-200 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <AlertTriangle className="w-16 h-16 text-rose-600" />
          </div>
          <div className="flex items-center gap-2 text-rose-600 mb-2 relative z-10">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-wider">Risk Flags</span>
          </div>
          <div className="text-3xl font-bold text-rose-600 relative z-10">{stats.risks}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl border shadow-sm flex flex-col">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-slate-900">Recent Extracts</h2>
            <p className="text-sm text-slate-500 mt-1">Meetings successfully processed by AI.</p>
          </div>
          <div className="flex-1 p-0">
            <div className="divide-y">
              {recentMeetings.map(m => (
                <div 
                  key={m.id}
                  onClick={() => setTab('history')}
                  className="p-6 hover:bg-slate-50 transition-colors cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{m.title}</h4>
                    <p className="text-sm text-slate-500">{new Date(m.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className={`px-3 py-1 text-xs font-bold rounded-full ${m.actionability > 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {m.actionability || 0} Score
                  </div>
                </div>
              ))}
              {recentMeetings.length === 0 && <div className="p-6 text-slate-500 text-sm">No meetings recorded yet.</div>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm flex flex-col">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-slate-900">My Active Tasks</h2>
            <p className="text-sm text-slate-500 mt-1">Actions assigned directly to you.</p>
          </div>
          <div className="flex-1 p-0">
            <div className="divide-y">
              {activeTasks.map(t => (
                <div key={t.id} className="p-6 flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-slate-900 mb-1">{t.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">From:</span>
                      <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[150px]">{t.meetings?.title}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold rounded-md uppercase tracking-wider">
                    {t.status}
                  </span>
                </div>
              ))}
              {activeTasks.length === 0 && <div className="p-6 text-slate-500 text-sm">No pending tasks!</div>}
            </div>
          </div>
          <div className="p-4 border-t bg-slate-50 rounded-b-xl">
            <button 
              onClick={() => setTab('board')}
              className="w-full py-2 bg-white border border-slate-300 shadow-sm rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              View Full Board
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
