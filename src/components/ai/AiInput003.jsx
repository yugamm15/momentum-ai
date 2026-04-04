import { ArrowUp, AtSign, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

export default function AiInput003({
  onSendMessage,
  loading = false,
  placeholder = 'Ask about this meeting...',
  submitLabel = 'Ask Moméntum',
  loadingLabel = 'Processing...',
}) {
  const [text, setText] = useState('');

  const mention = useMemo(() => {
    const match = text.match(/@([a-zA-Z0-9._-]+)/);
    return match ? `@${match[1]}` : null;
  }, [text]);

  const canSend = text.trim().length > 0 && !loading;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSend) return;

    const payload = text.trim();
    await onSendMessage?.(payload, mention);
    setText('');
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-3">
      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-foreground focus:outline-none font-medium resize-none"
        />

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <AtSign className="h-3.5 w-3.5" />
            {mention ? `Target ${mention}` : 'General Query'}
          </div>

          <button type="submit" disabled={!canSend} className="button-primary inline-flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (
              <>
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                {loadingLabel}
              </>
            ) : (
              <>
                <span>{submitLabel}</span>
                <ArrowUp className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
