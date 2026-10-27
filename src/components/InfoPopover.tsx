import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

interface InfoPopoverProps {
  content: React.ReactNode;
  title?: string;
  align?: 'left' | 'right' | 'center';
  tone?: 'default' | 'dark';
}

export const InfoPopover: React.FC<InfoPopoverProps> = ({
  content,
  title,
  align = 'left',
  tone = 'default',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'bottom' | 'top' }>({
    top: 0,
    left: 0,
    placement: 'bottom',
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(320, window.innerWidth - 24);
    const estimatedHeight = 140;

    let left = rect.left;
    if (align === 'right') {
      left = rect.right - popoverWidth;
    } else if (align === 'center') {
      left = rect.left + rect.width / 2 - popoverWidth / 2;
    }

    // Clamp horizontally within viewport with 12px margin
    left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));

    // Flip above button if too close to bottom of viewport
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: 'bottom' | 'top' =
      spaceBelow < estimatedHeight && rect.top > estimatedHeight ? 'top' : 'bottom';
    const top = placement === 'bottom' ? rect.bottom + 8 : Math.max(12, rect.top - 8);

    setCoords({ top, left, placement });
  }, [align]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  return (
    <div className="relative inline-flex items-center shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors cursor-pointer border ${
          tone === 'dark'
            ? 'bg-white/15 hover:bg-white/25 text-teal-300 border-white/25'
            : 'bg-slate-200/90 hover:bg-teal-100 dark:bg-slate-800 dark:hover:bg-teal-900/60 text-slate-600 hover:text-teal-700 dark:text-slate-300 dark:hover:text-teal-300 border-slate-300 dark:border-slate-700'
        }`}
        aria-label="Información"
        title="Ver ayuda"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              top: coords.top,
              left: coords.left,
              transform: coords.placement === 'top' ? 'translateY(-100%)' : undefined,
            }}
            className="fixed z-[9999] w-72 sm:w-80 p-3.5 rounded-xl shadow-2xl border bg-slate-900 text-slate-100 border-teal-500/40 text-xs font-normal normal-case tracking-normal leading-relaxed"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                {title && (
                  <strong className="block text-teal-300 font-bold text-[13px]">
                    {title}
                  </strong>
                )}
                <div className="text-slate-200 text-xs leading-relaxed">{content}</div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-0.5 rounded shrink-0 cursor-pointer"
                aria-label="Cerrar información"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
