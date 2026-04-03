import { useState } from 'react';
import './index.css';
import { LayoutDashboard, Video, Columns3, CalendarPlus, Upload } from 'lucide-react';

import DashboardOverview from './components/dashboard/DashboardOverview';
import MeetingHistory from './components/meetings/MeetingHistory';
import TaskBoard from './components/tasks/TaskBoard';
import MeetingProcessor from './components/processor/MeetingProcessor';

function App() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      <aside className="w-64 border-r bg-white flex flex-col">
        <div className="h-16 flex items-center px-6 border-b">
          <div className="flex items-center gap-2 font-semibold text-lg tracking-tight text-slate-900">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold">
              M
            </div>
            Momentum AI
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1">
          <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Workspace
          </div>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'overview' 
                ? 'bg-slate-100 text-slate-900' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('processor')}
            className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'processor' 
                ? 'bg-blue-50 text-blue-700' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload Recording
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'history' 
                ? 'bg-slate-100 text-slate-900' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Video className="w-4 h-4" />
            Meetings
          </button>
          <button
            onClick={() => setActiveTab('board')}
            className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'board' 
                ? 'bg-slate-100 text-slate-900' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Columns3 className="w-4 h-4" />
            Task Board
          </button>
        </nav>
        
        <div className="p-4 m-4 rounded-xl border bg-slate-50 border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900 mb-1">Google Meet Extension</h4>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Record meetings securely and upload the file seamlessly.
          </p>
        </div>
      </aside>
      
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-8">
          {activeTab === 'overview' && <DashboardOverview setTab={setActiveTab} />}
          {activeTab === 'processor' && <MeetingProcessor onComplete={() => setTimeout(() => setActiveTab('history'), 2000)} />}
          {activeTab === 'history' && <MeetingHistory />}
          {activeTab === 'board' && <TaskBoard />}
        </div>
      </main>
    </div>
  );
}

export default App;
