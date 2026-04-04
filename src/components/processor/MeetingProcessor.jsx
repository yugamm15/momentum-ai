import { useRef, useState } from 'react';
import { CheckCircle2, FileAudio, Loader2, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';

export default function MeetingProcessor({ onComplete }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError('');
      setDetail('');
      setStatus('idle');
    }
  };

  const processMeeting = async () => {
    if (!file) {
      return;
    }

    setStatus('uploading');
    setError('');
    setDetail('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('contentType', file.type || 'audio/webm');

      const response = await apiFetch('/api/process-meeting-upload', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Moméntum could not process this recording.');
      }

      setStatus('done');
      setDetail(
        payload?.detail ||
          (payload?.analysisComplete
            ? 'Transcript, summary, and tasks are ready.'
            : 'Raw audio was stored. Finish analysis later from the Meeting Library.')
      );

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError(err.message || 'An unknown error occurred during processing.');
      setStatus('idle');
    }
  };

  return (
    <div className="glass-panel mx-auto max-w-3xl p-8 md:p-12 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-5 pointer-events-none text-foreground">
        <UploadCloud className="w-64 h-64 rotate-12 scale-150" />
      </div>
      
      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-primary/10 border border-primary/20 text-[10px] uppercase font-bold text-primary tracking-widest shadow-sm">Manual Upload</div>
        <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mb-4">
          Process a meeting file directly
        </h2>
        <p className="mt-2 max-w-xl mx-auto text-lg font-medium text-muted-foreground leading-relaxed">
          Upload a meeting recording and let Moméntum handle transcription, task extraction, and storage in your workspace.
        </p>
      </div>

      <div
        className="relative z-10 mt-10 cursor-pointer rounded-2xl border-2 border-dashed border-border bg-card/50 p-12 transition-all hover:bg-secondary/50 shadow-sm"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="audio/webm, audio/mp3, audio/wav, audio/m4a"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center justify-center text-center">
          {file ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-sm">
                <FileAudio className="h-8 w-8" />
              </div>
              <p className="font-bold text-foreground text-lg">{file.name}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary border border-border text-foreground mb-4 shadow-sm group-hover:scale-110 transition-transform duration-300">
                <UploadCloud className="h-8 w-8" />
              </div>
              <p className="font-bold text-foreground text-lg">Click to browse or drag recording</p>
              <p className="mt-2 text-sm font-medium text-muted-foreground max-w-sm mx-auto">
                Works best with `.webm`, `.mp3`, or `.m4a` audio files
              </p>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="relative z-10 mt-6 rounded-xl border border-destructive/20 bg-destructive/10 px-5 py-4 text-sm font-semibold text-destructive shadow-sm">
          {error}
        </div>
      ) : null}
      {detail && !error ? (
        <div className="relative z-10 mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400 shadow-sm">
          {detail}
        </div>
      ) : null}

      {status === 'done' && !error ? (
        <div className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link to="/dashboard/meetings" className="button-secondary">
            Open Meeting Vault
          </Link>
          <Link to="/dashboard/settings?panel=ai-integration" className="button-secondary">
            View Processing Status
          </Link>
        </div>
      ) : null}

      <button
        onClick={processMeeting}
        disabled={!file || status !== 'idle'}
        className="relative z-10 button-primary mt-8 w-full py-4 text-base shadow-lg shadow-primary/20"
      >
        {status === 'idle' && 'Process meeting'}
        {status === 'uploading' && (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Uploading and analyzing...
          </>
        )}
        {status === 'done' && (
          <>
            <CheckCircle2 className="h-5 w-5" />
            Processing complete
          </>
        )}
      </button>
    </div>
  );
}
