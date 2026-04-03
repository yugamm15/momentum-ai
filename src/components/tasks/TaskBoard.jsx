import { Plus, Filter, AlertCircle, Clock, ArrowRight, Layers, Layout, Kanban } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

export default function TaskBoard() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    async function fetchTasks() {
      // MVP: Fetch ALL tasks for the demo
      const { data, error } = await supabase
        .from('tasks')
        .select(`*, meetings(title)`);
      
      if (!error && data) setTasks(data);
    }
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const columns = [
    { id: 'todo', label: 'Queued', color: 'bg-slate-400', icon: Layers },
    { id: 'in-progress', label: 'Executing', color: 'bg-blue-600', icon: Layout },
    { id: 'done', label: 'Resolved', color: 'bg-emerald-500', icon: Kanban },
    { id: 'needs-review', label: 'Unclear Assignments', color: 'bg-rose-600', isFlag: true, icon: AlertCircle }
  ];

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-700">
      <div className="flex justify-between items-center mb-12 bg-white p-10 rounded-[40px] border-2 border-slate-50 shadow-2xl">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2 font-black">Execution Hub</h1>
          <p className="text-slate-500 font-medium">Automatic task extraction and team workflow management.</p>
        </div>
        <div className="flex gap-4">
          <button className="px-8 py-4 bg-white border-2 border-slate-100 shadow-xl rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all active:scale-95">
            <Filter className="w-4 h-4 inline mr-2" /> Filter Stream
          </button>
          <button className="px-8 py-4 bg-slate-900 text-white shadow-2xl shadow-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95">
            <Plus className="w-4 h-4 inline mr-2" /> Inject Task
          </button>
        </div>
      </div>

      <div className="flex gap-8 overflow-x-auto pb-12 snap-x px-4">
        {columns.map(col => {
          let colTasks = tasks.filter(t => t.status === col.id);
          if (col.isFlag) {
            colTasks = tasks.filter(t => t.assignee === 'UNCLEAR' || t.deadline === 'Missing');
          }

          const Icon = col.icon;

          return (
            <div key={col.id} className="flex-none w-96 flex flex-col bg-slate-50/50 rounded-[48px] border-4 border-white p-6 shadow-inner snap-center">
              <div className="flex justify-between items-center mb-8 px-4 pt-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg ${col.color} text-white`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-xs text-slate-900 uppercase tracking-[0.2em]">
                    {col.label}
                  </h3>
                </div>
                <span className="w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-100 text-slate-900 text-xs font-black rounded-2xl shadow-sm">
                  {colTasks.length}
                </span>
              </div>
              
              <div className="flex flex-col gap-6">
                {colTasks.map(t => (
                  <div 
                    key={t.id} 
                    className={`bg-white p-8 rounded-[32px] border-2 border-slate-50 shadow-xl cursor-grab hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 relative group ${
                      col.isFlag ? 'border-rose-100' : ''
                    }`}
                  >
                    {col.isFlag && (
                      <div className="flex items-center gap-2 text-[10px] font-black text-rose-600 uppercase tracking-widest mb-4">
                        <AlertCircle className="w-4 h-4 animate-pulse" /> Critical Ambiguity
                      </div>
                    )}
                    
                    <h4 className="text-lg font-black text-slate-900 mb-6 leading-tight group-hover:text-blue-600 transition-colors">
                      {t.title}
                    </h4>

                    <div className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8 inline-flex items-center gap-2 w-full">
                      <ArrowRight className="w-4 h-4 flex-shrink-0 text-blue-500" />
                      <span className="truncate">{t.meetings?.title || 'System Task'}</span>
                    </div>

                    <div className="flex justify-between items-center border-t-2 border-slate-50 pt-6 mt-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-lg ${
                          t.assignee === 'UNCLEAR' 
                            ? 'bg-rose-100 text-rose-700 border-2 border-rose-200' 
                            : 'bg-indigo-600 text-white'
                        }`}>
                          {t.assignee === 'UNCLEAR' ? '?' : t.assignee.charAt(0)}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${t.assignee === 'UNCLEAR' ? 'text-rose-600' : 'text-slate-400'}`}>
                          {t.assignee}
                        </span>
                      </div>
                      
                      <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                        t.deadline === 'Missing' ? 'text-rose-500' : 'text-slate-400 text-xs px-3 py-1 bg-slate-100 rounded-lg'
                      }`}>
                        <Clock className="w-4 h-4" />
                        {t.deadline}
                      </div>
                    </div>
                  </div>
                ))}
                
                {colTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 border-4 border-dashed border-slate-200 rounded-[32px] text-xs text-slate-300 font-black uppercase tracking-widest my-2 bg-white/50">
                    <Layers className="w-8 h-8 mb-4 opacity-10" />
                    No Data Detected
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
