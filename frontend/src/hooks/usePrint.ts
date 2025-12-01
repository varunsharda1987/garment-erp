/**
 * usePrint Hook
 *
 * Provides print functionality for React components.
 * Handles print-specific styling and window.print() calls.
 *
 * @example
 * const { print, isPrinting, printRef } = usePrint();
 *
 * <div ref={printRef}>
 *   <h1>Invoice #1234</h1>
 *   {content}
 * </div>
 *
 * <PrintButton onClick={print} />
 */
import { useRef, useState, useCallback } from 'react';

export interface UsePrintOptions {
  /** Document title when printing */
  title?: string;
  /** Callback before print */
  onBeforePrint?: () => void;
  /** Callback after print */
  onAfterPrint?: () => void;
  /** Delay before triggering print (ms) - allows styles to apply */
  delay?: number;
}

export interface UsePrintReturn {
  /** Trigger print dialog */
  print: () => void;
  /** Whether print is in progress */
  isPrinting: boolean;
  /** Ref to attach to printable content */
  printRef: React.RefObject<HTMLDivElement>;
  /** Set custom print title */
  setTitle: (title: string) => void;
}

export function usePrint(options: UsePrintOptions = {}): UsePrintReturn {
  const {
    title: initialTitle,
    onBeforePrint,
    onAfterPrint,
    delay = 100,
  } = options;

  const [isPrinting, setIsPrinting] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const printRef = useRef<HTMLDivElement>(null);
  const originalTitle = useRef<string>('');

  const print = useCallback(() => {
    if (isPrinting) return;

    setIsPrinting(true);
    onBeforePrint?.();

    // Store and set document title
    originalTitle.current = document.title;
    if (title) {
      document.title = title;
    }

    // Add print class to body for print-specific styles
    document.body.classList.add('printing');

    // Small delay to ensure styles are applied
    setTimeout(() => {
      window.print();

      // Restore after print
      document.body.classList.remove('printing');
      document.title = originalTitle.current;
      setIsPrinting(false);
      onAfterPrint?.();
    }, delay);
  }, [isPrinting, title, onBeforePrint, onAfterPrint, delay]);

  return {
    print,
    isPrinting,
    printRef,
    setTitle,
  };
}

export default usePrint;
