import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from 'framer-motion';
import {
  TbPlayerPauseFilled,
  TbPlayerPlayFilled,
  TbRotateClockwise2,
} from 'react-icons/tb';

const DEFAULT_WAVEFORM = [
  4, 7, 9, 6, 11, 14, 12, 8, 5, 10, 15, 13, 11, 9, 6, 10, 12, 9, 7, 5, 8, 12,
  10, 7, 6, 9, 13, 11, 8, 6, 5, 11, 8, 6, 5, 11, 8, 6, 5, 8, 5, 10, 15, 13, 11,
  9,
];

export default function WaveformScrub({
  audioUrl,
  duration = 30,
  fileName = 'Mom.mp3',
  waveformHeights = DEFAULT_WAVEFORM,
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [resolvedDuration, setResolvedDuration] = useState(duration);

  const waveformRef = useRef(null);
  const audioRef = useRef(null);
  const x = useMotionValue(0);

  const isFinished = currentTime >= resolvedDuration - 0.05;

  useEffect(() => {
    const updateWidth = () => {
      if (waveformRef.current) {
        const newWidth = waveformRef.current.offsetWidth;
        setContainerWidth(newWidth);
        x.set((currentTime / Math.max(resolvedDuration, 0.0001)) * newWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [currentTime, resolvedDuration, x]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      const nextDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
      setResolvedDuration(nextDuration);
      x.set((audio.currentTime / Math.max(nextDuration, 0.0001)) * containerWidth);
    };

    const handleTimeUpdate = () => {
      if (isDragging) return;
      const t = audio.currentTime || 0;
      setCurrentTime(t);
      x.set((t / Math.max(resolvedDuration, 0.0001)) * containerWidth);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    audio.load();

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl, containerWidth, duration, isDragging, resolvedDuration, x]);

  useMotionValueEvent(x, 'change', (latest) => {
    if (!isDragging || containerWidth <= 0) return;

    const progress = Math.max(0, Math.min(1, latest / containerWidth));
    const nextTime = progress * resolvedDuration;
    setCurrentTime(nextTime);

    if (audioRef.current) {
      audioRef.current.currentTime = nextTime;
    }
  });

  const activeProgress = useTransform(x, [0, containerWidth || 1], ['0%', '100%']);
  const displayTime = Math.round(Math.max(0, resolvedDuration - currentTime));

  const handleTogglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isFinished) {
      setCurrentTime(0);
      x.set(0);
      audio.currentTime = 0;
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
    }
  };

  return (
    <div className="w-full">
      <audio ref={audioRef} preload="metadata" className="hidden">
        <source src={audioUrl} />
      </audio>

      <div className="flex min-h-full flex-col items-center justify-center bg-transparent py-4 font-sans antialiased">
        <div className="w-full max-w-[760px] rounded-[24px] border border-border bg-card/80 px-2 pb-3 pt-4 shadow-sm transition-colors duration-300">
          <div className="mb-4 flex items-center justify-between px-2 pr-4">
            <div className="flex items-center gap-2 overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.button
                  key={isFinished ? 'reset' : isPlaying ? 'pause' : 'play'}
                  initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
                  transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                  onClick={handleTogglePlay}
                  className="z-20 shrink-0 cursor-pointer text-foreground/75"
                >
                  {isFinished ? (
                    <TbRotateClockwise2 size={22} />
                  ) : isPlaying ? (
                    <TbPlayerPauseFilled size={22} />
                  ) : (
                    <TbPlayerPlayFilled size={22} />
                  )}
                </motion.button>
              </AnimatePresence>
              <span className="truncate text-[17px] font-normal tracking-tight text-foreground/80 transition-colors sm:text-[19px]">
                {fileName}
              </span>
            </div>

            <span className="shrink-0 tabular-nums text-[18px] font-semibold text-foreground/75 transition-colors sm:text-[20px]">
              {displayTime}s
            </span>
          </div>

          <div className="relative flex h-[68px] items-center justify-center overflow-hidden rounded-3xl border border-border bg-secondary/70 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]">
            <motion.div
              style={{
                width: activeProgress,
                backgroundImage:
                  'linear-gradient(-45deg, currentColor 25%, transparent 25%, transparent 50%, currentColor 50%, currentColor 75%, transparent 75%, transparent)',
                backgroundSize: '5px 5px',
              }}
              animate={{ backgroundPositionX: ['0px', '4px'] }}
              transition={{ repeat: Infinity, duration: 0.5, ease: 'linear' }}
              className="pointer-events-none absolute inset-y-0 left-0 rounded-l-3xl text-primary opacity-[0.08] transition-opacity"
            />

            <div ref={waveformRef} className="relative mx-2 h-7 w-full">
              <div className="absolute inset-0 flex w-full items-center justify-between">
                {waveformHeights.map((h, i) => (
                  <div
                    key={i}
                    className="w-[3px] shrink-0 rounded-full bg-muted-foreground/30 transition-colors sm:w-[2.5px]"
                    style={{ height: h * 1.6 }}
                  />
                ))}
              </div>

              <motion.div style={{ width: activeProgress }} className="pointer-events-none absolute inset-y-0 left-0 z-10 overflow-hidden">
                <div className="flex h-full items-center justify-between" style={{ width: containerWidth }}>
                  {waveformHeights.map((h, i) => (
                    <div
                      key={i}
                      className="w-[3px] shrink-0 rounded-full bg-foreground/80 transition-colors sm:w-[2.5px]"
                      style={{ height: h * 1.6 }}
                    />
                  ))}
                </div>
              </motion.div>

              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: containerWidth }}
                dragElastic={0}
                dragMomentum={false}
                onDragStart={() => {
                  setIsDragging(true);
                  if (audioRef.current && !audioRef.current.paused) {
                    audioRef.current.pause();
                  }
                }}
                onDragEnd={() => setIsDragging(false)}
                style={{ x, left: -10 }}
                className="absolute top-1/2 z-20 flex h-[42px] -translate-y-1/2 cursor-grab flex-col items-center active:cursor-grabbing"
              >
                <div
                  className="h-[13px] w-[16px] bg-primary shadow-[0_4px_16px_rgba(0,102,255,0.35)] transition-colors"
                  style={{
                    clipPath: 'polygon(15% 0%, 85% 0%, 100% 20%, 100% 60%, 60% 100%, 40% 100%, 0% 60%, 0% 20%)',
                  }}
                />
                <div className="w-[3px] flex-1 rounded-b-full bg-primary/90 shadow-sm transition-colors" />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
