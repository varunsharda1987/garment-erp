/**
 * Thread Selector Component (shadcn/ui)
 *
 * Simplified thread selector with:
 * - Search/select thread from dropdown
 * - Display thread details
 * - Optional filters
 */

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { ThreadPly, ThreadMaterial, ThreadPackagingType } from '../../types/thread.types';
import { getAllThreads } from '../../services/thread.service';

// Label constants
const PLY_LABELS: Record<ThreadPly, string> = { TWO_PLY: '2-Ply', THREE_PLY: '3-Ply' };
const MATERIAL_LABELS: Record<ThreadMaterial, string> = { POLYESTER: 'Polyester', COTTON: 'Cotton' };
const PACKAGING_LABELS: Record<ThreadPackagingType, string> = {
  CONE: 'Cone',
  TUBE: 'Tube',
  SPOOL: 'Spool',
  CONE_5K: 'Cone (5,000 mtr)',
  CONE_10K: 'Cone (10,000 mtr)',
};

interface ThreadOption {
  id: string;
  threadCode: string;
  threadName: string;
  ply: ThreadPly;
  materialComposition: ThreadMaterial;
  packagingType: ThreadPackagingType;
  colorName: string;
  colorCode?: string;
}

interface ThreadSelectorProps {
  value: string | null; // Thread ID
  onChange: (threadId: string | null, thread: ThreadOption | null) => void;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  label?: string;
  placeholder?: string;
  onQuickAdd?: () => void;
}

const ThreadSelector: React.FC<ThreadSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  error,
  helperText,
  label = 'Select Thread',
  placeholder = 'Choose a thread...',
  onQuickAdd,
}) => {
  const [threads, setThreads] = useState<ThreadOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    setLoading(true);

    try {
      const response = await getAllThreads({ limit: 100 }); // Reduced from 1000 for performance

      // Map Thread objects to ThreadOption interface
      // Filter for threads with new Thread Material module fields (ply, materialComposition)
      const threadOptions: ThreadOption[] = response.data
        .filter((thread) => thread.isActive && thread.ply && thread.materialComposition && thread.packagingType)
        .map((thread) => ({
          id: thread.id,
          threadCode: thread.threadCode,
          threadName: thread.threadName,
          ply: thread.ply!,
          materialComposition: thread.materialComposition!,
          packagingType: thread.packagingType!,
          colorName: thread.color || 'N/A',
          colorCode: thread.colorCode || undefined,
        }));

      setThreads(threadOptions);
    } catch (err: unknown) {
      console.error('Failed to fetch threads:', err);
      setThreads([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedThread = threads.find((t) => t.id === value) || null;

  const handleValueChange = (newValue: string) => {
    const thread = threads.find((t) => t.id === newValue) || null;
    onChange(thread?.id || null, thread);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="thread-select">{label}</Label>
        {onQuickAdd && (
          <Button type="button" variant="outline" size="sm" onClick={onQuickAdd} disabled={disabled}>
            <Plus className="h-4 w-4 mr-1" />
            Quick Add
          </Button>
        )}
      </div>

      <Select value={value || undefined} onValueChange={handleValueChange} disabled={disabled || loading}>
        <SelectTrigger id="thread-select" className={error ? 'border-destructive' : ''}>
          <SelectValue placeholder={loading ? 'Loading threads...' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Available Threads</SelectLabel>
            {threads.map((thread) => (
              <SelectItem key={thread.id} value={thread.id}>
                <div className="flex items-center gap-2">
                  {thread.colorCode && (
                    <div
                      className="w-3 h-3 rounded-full border border-border"
                      style={{ backgroundColor: thread.colorCode }}
                    />
                  )}
                  <span>
                    {thread.threadCode} - {thread.threadName} ({thread.colorName})
                  </span>
                </div>
              </SelectItem>
            ))}
            {threads.length === 0 && !loading && (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">No threads found</div>
            )}
          </SelectGroup>
        </SelectContent>
      </Select>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {helperText && !error && <p className="text-sm text-muted-foreground">{helperText}</p>}

      {/* Selected thread display */}
      {selectedThread && (
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline">{PLY_LABELS[selectedThread.ply]}</Badge>
          <Badge variant="outline">{MATERIAL_LABELS[selectedThread.materialComposition]}</Badge>
          <Badge variant="outline">{selectedThread.colorName}</Badge>
          <Badge variant="outline">{PACKAGING_LABELS[selectedThread.packagingType]}</Badge>
        </div>
      )}
    </div>
  );
};

export default ThreadSelector;
