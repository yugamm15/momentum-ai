import { CloudUpload, ShieldCheck } from 'lucide-react';
import MeetingProcessor from '../components/processor/MeetingProcessor';

export default function UploadHub() {
  return (
    <div className="space-y-6">
      <section className="momentum-card momentum-spotlight p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="momentum-pill-accent">
              <CloudUpload className="h-4 w-4" />
              Upload fallback
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
              Manual meeting intake
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-600">
              The extension should be the main story, but keeping a manual upload route gives you a reliable hackathon fallback and a safe admin path after demo day.
            </p>
          </div>
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Compatibility-safe
            </div>
            <div className="mt-1 text-emerald-800/90">
              This still uses the existing upload and processing API path.
            </div>
          </div>
        </div>
      </section>

      <MeetingProcessor />
    </div>
  );
}
