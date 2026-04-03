import { Activity, CheckCircle2, AlertTriangle, Presentation } from 'lucide-react';

export default function DashboardOverview({ setTab }) {
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
          <div className="text-3xl font-bold text-slate-900">5</div>
        </div>
        
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium uppercase tracking-wider">Avg Score</span>
          </div>
          <div className="text-3xl font-bold text-emerald-600">84/100</div>
        </div>
        
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium uppercase tracking-wider">Pending Tasks</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">12</div>
        </div>
        
        <div className="bg-white rounded-xl border border-rose-200 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <AlertTriangle className="w-16 h-16 text-rose-600" />
          </div>
          <div className="flex items-center gap-2 text-rose-600 mb-2 relative z-10">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-bold uppercase tracking-wider">Risk Flags</span>
          </div>
          <div className="text-3xl font-bold text-rose-600 relative z-10">3</div>
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
              <div 
                onClick={() => setTab('history')}
                className="p-6 hover:bg-slate-50 transition-colors cursor-pointer flex justify-between items-center"
              >
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">Product Sync & Design</h4>
                  <p className="text-sm text-slate-500">Today, 04:20 PM</p>
                </div>
                <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                  88 Score
                </div>
              </div>
              <div 
                onClick={() => setTab('history')}
                className="p-6 hover:bg-slate-50 transition-colors cursor-pointer flex justify-between items-center"
              >
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">Q3 Marketing Strategy</h4>
                  <p className="text-sm text-slate-500">Apr 1, 2026</p>
                </div>
                <div className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                  72 Score
                </div>
              </div>
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
              <div className="p-6 flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-slate-900 mb-1">Finalize Q3 Budget</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">From:</span>
                    <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">Q3 Marketing</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md border">
                  Pending
                </span>
              </div>
              <div className="p-6 flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-slate-900 mb-1">Update Dashboard UI</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">From:</span>
                    <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">Product Sync</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold rounded-md">
                  In Progress
                </span>
              </div>
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
