import { useState, useEffect, useEffectEvent, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'className' | 'placeholder'
> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  /** Styles the wrapper. Any other input attribute (maxLength, aria-label, autoFocus…) goes to the input. */
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 300,
  className,
  ...inputProps
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  // The text last reported to the parent. When it comes back as `value` it is our own echo, and must
  // not overwrite what the user has typed since (a URL-backed page can answer a render late).
  const [reported, setReported] = useState<string | null>(null);
  const [seenValue, setSeenValue] = useState(value);

  // An outside change — a page's Clear filters, back/forward, a tab that resets the search — goes into
  // the box. Adjusted during render rather than in an effect, so the stale text never paints.
  if (value !== seenValue) {
    setSeenValue(value);
    setReported(null);
    if (value !== reported) setLocalValue(value);
  }

  // Tell the parent — unless it already has this text, or is about to (our last report).
  const report = (next: string) => {
    if (next === (reported ?? value)) return;
    setReported(next);
    onChange(next);
  };

  // Debounce the search. Until 2026-09-27 this effect listed `onChange` as a dependency and reported
  // unconditionally, so every parent render (a new inline onChange) re-sent the unchanged text 300 ms
  // later: pages that reset page→1 in onChange could not leave page 1, and the PO list re-rendered
  // from its own URL write ~3×/s, undoing tab clicks. Now only a typed change is reported.
  const settle = useEffectEvent((next: string) => report(next));
  useEffect(() => {
    const timer = setTimeout(() => settle(localValue), debounceMs);
    return () => clearTimeout(timer);
  }, [localValue, debounceMs]);

  const handleClear = () => {
    setLocalValue('');
    report('');
  };

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        {...inputProps}
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-9 pr-9"
      />
      {localValue && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
