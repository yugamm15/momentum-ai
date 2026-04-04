import { CloudUpload, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import MeetingProcessor from '../components/processor/MeetingProcessor';

export default function UploadHub() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-6 md:p-8 xl:p-12 max-w-[1600px] mx-auto space-y-8 min-h-screen"
    >
      <section className="glass-panel p-8 md:p-10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] dark:opacity-5 pointer-events-none text-foreground">
          <CloudUpload className="w-64 h-64 scale-150 rotate-12" />
        </div>
        <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/10 border border-primary/20 text-[10px] uppercase font-bold text-primary tracking-widest shadow-sm">
              <CloudUpload className="h-3 w-3" />
              Manual Upload
            </div>
            <h1 className="mt-2 text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
              Upload Actionable Meetings
            </h1>
            <p className="max-w-2xl text-lg font-medium text-muted-foreground leading-relaxed">
              Upload recordings missing from the automated pipeline directly here.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-emerald-700 dark:text-emerald-400 max-w-sm shadow-sm backdrop-blur-md">
            <div className="flex items-center gap-2 font-extrabold text-sm mb-1 uppercase tracking-widest">
              <ShieldCheck className="h-4 w-4" />
              Safe Processing
            </div>
            <div className="text-xs font-semibold leading-relaxed">
              Uploading manually will securely process this file matching it to your workspace.
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10">
        <MeetingProcessor />
      </section>
    </motion.div>
  );
}
