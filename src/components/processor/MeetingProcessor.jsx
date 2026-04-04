import { useRef, useState } from 'react';
import { CheckCircle2, FileAudio, Loader2, UploadCloud } from 'lucide-react';
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
        throw new Error(payload?.error || 'Momentum could not process this recording.');
      }

      setStatus('done');
      setDetail(
        payload?.detail ||
          (payload?.analysisComplete
            ? 'Transcript, summary, and tasks are ready.'
            : 'Raw audio was stored. Finish AI analysis later from Meeting Vault.')
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
    <div className="momentum-card mx-auto max-w-3xl p-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="momentum-pill-accent mx-auto">Manual meeting upload</div>
        <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
          Process a real recording without the extension
        </h2>
        <p className="mt-4 text-base leading-8 text-slate-600">
          Upload a meeting file and let the server handle transcription, extraction, scoring, and storage in the same live pipeline used by Momentum.
        </p>
      </div>

      <div
        className="momentum-card-soft mt-8 cursor-pointer border-2 border-dashed border-slate-300 bg-slate-50/85 p-10 transition hover:border-sky-300 hover:bg-white"
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
              <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-sky-50 text-sky-700">
                <FileAudio className="h-8 w-8" />
              </div>
              <p className="mt-4 font-semibold text-slate-900">{file.name}</p>
              <p className="mt-1 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </>
          ) : (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-slate-900 text-white">
                <UploadCloud className="h-8 w-8" />
              </div>
              <p className="mt-4 font-semibold text-slate-900">Click to browse or drag a recording here</p>
              <p className="mt-1 text-xs text-slate-500">
                Best for `.webm` recordings captured from the Momentum extension
              </p>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="momentum-card-soft mt-6 border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {detail && !error ? (
        <div className="momentum-card-soft mt-6 border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
          {detail}
        </div>
      ) : null}

      <button
        onClick={processMeeting}
        disabled={!file || status !== 'idle'}
        className="momentum-button-primary mt-6 w-full"
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
