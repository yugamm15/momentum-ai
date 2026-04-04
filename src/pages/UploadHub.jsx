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
              Manual intake
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
              Bring in an existing recording
            </h1>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Use this route when the meeting was recorded outside the extension or when you need to process a file that already exists.
            </p>
          </div>
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Same pipeline
            </div>
            <div className="mt-1 text-emerald-800/90">
              This still lands in the live processing path and workspace snapshot.
            </div>
          </div>
        </div>
      </section>

      <MeetingProcessor />
    </div>
  );
}
