import { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';

const MOCK_MEETINGS = [
  { id: 1, date: 'Today, 04:20 PM', title: 'Product Sync & Design', duration: '45 min', summary: 'Discussed next quarter roadmap and assigned initial tasks for the Web platform. Design system updates will be pushed by EOD.', clarity: 88, actionability: 82, tasks: 4 },
  { id: 2, date: 'Apr 1, 2026', title: 'Q3 Marketing Strategy', duration: '30 min', summary: 'Reviewed the new dashboard mockups. Need changes on task board and conversion analytics. Pending feedback from Alice.', clarity: 72, actionability: 60, tasks: 2 },
];

export default function MeetingHistory() {
  const [meetings, setMeetings] = useState(MOCK_MEETINGS);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && (event.data.type === 'MEETING_DATA_RESPONSE' || event.data.type === 'MEETING_DATA_UPDATE')) {
        const result = event.data.data;
        if (result) {
          const newMeeting = {
            id: Date.now(),
            date: new Date(event.data.timestamp || Date.now()).toLocaleString(),
            title: result.title || 'Auto-Analyzed Meeting',
            duration: 'Recorded',
            summary: result.summary,
            clarity: result.clarity_score || 0,
            actionability: result.actionability_score || 0,
            tasks: result.tasks ? result.tasks.length : 0,
            fullData: result
          };
          
          setMeetings(prev => {
            if (prev.some(m => m.summary === newMeeting.summary)) return prev;
            return [newMeeting, ...prev];
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    window.postMessage({ type: 'REQUEST_MEETING_DATA' }, '*');
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Meetings</h1>
          <p className="text-slate-500">All your extracted meeting data and AI summaries.</p>
        </div>
        <button className="px-4 py-2 bg-white border shadow-sm rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Connect Calendar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {meetings.map(m => {
          let badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
          if (m.clarity < 80) badgeClass = "bg-amber-100 text-amber-700 border-amber-200";
          if (m.clarity < 60) badgeClass = "bg-rose-100 text-rose-700 border-rose-200";

          return (
            <div key={m.id} className="bg-white rounded-xl border shadow-sm flex flex-col hover:border-slate-300 transition-colors group">
              <div className="p-6 border-b flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {m.title}
                  </h3>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> {m.date}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> {m.duration}</span>
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded-md border text-xs font-bold ${badgeClass}`}>
                  Score {m.clarity}
                </div>
              </div>
              
              <div className="p-6 flex-1">
                <p className="text-sm text-slate-600 leading-relaxed">
                  {m.summary}
                </p>
              </div>
              
              <div className="p-4 bg-slate-50 border-t rounded-b-xl flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <strong>{m.tasks}</strong> extracted tasks
                </div>
                <button className="text-sm font-semibold text-blue-600 flex items-center gap-1 hover:text-blue-700">
                  View Detail <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
