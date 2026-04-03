import { Plus, Filter, AlertCircle, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

export default function TaskBoard() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    async function fetchTasks() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('tasks')
        .select(`*, meetings(title)`)
        .eq('user_id', user.id);
      
      if (!error && data) setTasks(data);
    }
    fetchTasks();
  }, []);

  const columns = [
    { id: 'todo', label: 'To Do', color: 'bg-slate-200' },
    { id: 'in-progress', label: 'In Progress', color: 'bg-blue-200' },
    { id: 'done', label: 'Done', color: 'bg-emerald-200' },
    { id: 'needs-review', label: 'Needs Review', color: 'bg-rose-200', isFlag: true }
  ];

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Execution Board</h1>
          <p className="text-slate-500">Track all AI-extracted tasks and resolve ambiguities.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border shadow-sm rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button className="px-4 py-2 bg-slate-900 text-white shadow-sm rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Task
          </button>
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-6">
        {columns.map(col => {
          let colTasks = tasks.filter(t => t.status === col.id);
          if (col.isFlag) {
            colTasks = tasks.filter(t => t.assignee === 'UNCLEAR' || t.deadline === 'Missing');
          }

          return (
            <div key={col.id} className="flex-none w-80 flex flex-col bg-slate-100 rounded-xl border p-3">
              <div className="flex justify-between items-center mb-4 px-2 pt-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${col.color}`}></div>
                  <h3 className="font-semibold text-sm text-slate-700 uppercase tracking-wide">
                    {col.label}
                  </h3>
                </div>
                <span className="w-6 h-6 flex items-center justify-center bg-slate-200 text-slate-600 text-xs font-bold rounded-full">
                  {colTasks.length}
                </span>
              </div>
              
              <div className="flex flex-col gap-3">
                {colTasks.map(t => (
                  <div 
                    key={t.id} 
                    className={`bg-white p-4 rounded-lg border shadow-sm cursor-grab hover:border-slate-300 transition-colors ${
                      col.isFlag ? 'border-rose-300 shadow-rose-100' : ''
                    }`}
                  >
                    {col.isFlag && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 uppercase tracking-widest mb-2">
                        <AlertCircle className="w-3.5 h-3.5" /> Action Required
                      </div>
                    )}
                    
                    <h4 className="text-sm font-medium text-slate-900 mb-3 leading-snug">
                      {t.title}
                    </h4>

                    <div className="px-2.5 py-1.5 bg-slate-50 border rounded text-[11px] font-medium text-slate-500 mb-4 inline-flex items-center gap-1.5 w-full truncate">
                      <ArrowRight className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{t.meetings?.title || 'Unknown Meeting'}</span>
                    </div>

                    <div className="flex justify-between items-center border-t pt-3 mt-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          t.assignee === 'UNCLEAR' 
                            ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                            : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                        }`}>
                          {t.assignee === 'UNCLEAR' ? '?' : t.assignee.charAt(0)}
                        </div>
                        <span className={`text-xs font-medium ${t.assignee === 'UNCLEAR' ? 'text-amber-600' : 'text-slate-600'}`}>
                          {t.assignee}
                        </span>
                      </div>
                      
                      <div className={`flex items-center gap-1 text-[11px] font-semibold ${
                        t.deadline === 'Missing' ? 'text-rose-500' : 'text-slate-500'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {t.deadline}
                      </div>
                    </div>
                  </div>
                ))}
                
                {colTasks.length === 0 && (
                  <div className="flex items-center justify-center h-24 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-400 font-medium my-1">
                    No tasks
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
