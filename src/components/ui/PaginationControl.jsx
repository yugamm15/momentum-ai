import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const digitVariants = {
  initial: (dir) => ({
    y: dir > 0 ? 20 : -20,
    opacity: 0,
    scale: 0.7,
    filter: 'blur(2px)',
  }),
  animate: {
    y: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
  },
  exit: (dir) => ({
    y: dir > 0 ? -20 : 20,
    opacity: 0,
    scale: 0.7,
    filter: 'blur(2px)',
  }),
};

export default function PaginationControl({
  totalPages = 1,
  value,
  defaultValue = 1,
  onChange,
}) {
  const isControlled = value !== undefined;
  const [internalPage, setInternalPage] = useState(defaultValue);
  const [direction, setDirection] = useState(0);

  const currentPage = Math.min(totalPages, Math.max(1, isControlled ? value : internalPage));

  useEffect(() => {
    if (!isControlled && internalPage > totalPages) {
      setInternalPage(totalPages);
    }
  }, [internalPage, isControlled, totalPages]);

  function paginate(dir) {
    const next = Math.min(totalPages, Math.max(1, currentPage + dir));
    if (next === currentPage) return;

    setDirection(dir);
    if (!isControlled) {
      setInternalPage(next);
    }
    onChange?.(next);
  }

  return (
    <div className="flex w-full justify-center">
      <div className="flex items-center gap-2 rounded-full border border-border bg-secondary px-1 py-1 sm:gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          onClick={() => paginate(-1)}
          disabled={currentPage === 1}
          className={`flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground shadow transition-colors duration-200 hover:bg-foreground hover:text-background sm:h-12 sm:w-12 ${
            currentPage === 1 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
        >
          <ChevronLeft className="h-5 w-5" />
        </motion.button>

        <div className="mr-1 flex items-center pr-1 text-base font-bold text-muted-foreground select-none sm:text-lg">
          <div className="relative flex h-7 min-w-[2ch] items-center justify-center sm:h-8">
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
              <motion.span
                key={currentPage}
                custom={direction}
                variants={digitVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: 'spring', stiffness: 220, damping: 18, mass: 1.1 }}
                className="absolute inset-0 flex items-center justify-center tabular-nums text-foreground"
              >
                {currentPage}
              </motion.span>
            </AnimatePresence>
          </div>

          <span className="ml-1 flex h-7 items-center sm:h-8">of {totalPages}</span>
        </div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          onClick={() => paginate(1)}
          disabled={currentPage === totalPages}
          className={`flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground shadow transition-colors duration-200 hover:bg-foreground hover:text-background sm:h-12 sm:w-12 ${
            currentPage === totalPages ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
        >
          <ChevronRight className="h-5 w-5" />
        </motion.button>
      </div>
    </div>
  );
}
