import { useRef, useState } from 'react';
import { UploadCloud, FileAudio, Loader2, CheckCircle2 } from 'lucide-react';
import { apiUrl } from '../../lib/api';

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

      const response = await fetch(apiUrl('/api/process-meeting-upload'), {
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
    <div className="bg-white p-8 rounded-xl border shadow-sm max-w-xl mx-auto my-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Manual Meeting Upload</h2>
        <p className="text-slate-500 mt-2">Upload a recording and let the server handle transcription, analysis, and storage.</p>
      </div>

      <div
        className="border-2 border-dashed border-slate-300 bg-slate-50 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors mb-6"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="audio/webm, audio/mp3, audio/wav, audio/m4a"
          onChange={handleFileChange}
        />

        {file ? (
          <>
            <FileAudio className="w-12 h-12 text-blue-600 mb-3" />
            <p className="font-medium text-slate-900">{file.name}</p>
            <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </>
        ) : (
          <>
            <UploadCloud className="w-12 h-12 text-slate-400 mb-3" />
            <p className="font-medium text-slate-900">Click to browse or drag file here</p>
            <p className="text-xs text-slate-500 mt-1">Supports `.webm` recordings from the Momentum extension</p>
          </>
        )}
      </div>

      {error && <div className="p-3 mb-6 bg-rose-50 text-rose-700 text-sm rounded-md border border-rose-200">{error}</div>}
      {detail && !error && <div className="p-3 mb-6 bg-emerald-50 text-emerald-700 text-sm rounded-md border border-emerald-200">{detail}</div>}

      <button
        onClick={processMeeting}
        disabled={!file || status !== 'idle'}
        className="w-full py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {status === 'idle' && 'Process Meeting AI'}
        {status === 'uploading' && (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> Uploading and analyzing...
          </>
        )}
        {status === 'done' && (
          <>
            <CheckCircle2 className="w-5 h-5" /> Processing Complete!
          </>
        )}
      </button>
    </div>
  );
}
