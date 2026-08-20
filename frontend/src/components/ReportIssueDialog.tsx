/**
 * ReportIssueDialog
 *
 * Global dialog (opened from the Header bug icon) where team members report app
 * problems with an optional screenshot — via file picker or Ctrl+V paste — and
 * track the status of their own reports.
 */

import { useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ImagePlus, X, Loader2, Send, Clock, CheckCircle2 } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { createIssueReport, getMyIssueReports } from '@/services/issue-report.service';
import type { IssueStatus } from '@/types/issueReport.types';

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_STYLES: Record<IssueStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-800 border-amber-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
  FIXED: 'bg-green-100 text-green-800 border-green-200',
  CLOSED: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_LABELS: Record<IssueStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  FIXED: 'Fixed',
  CLOSED: 'Closed',
};

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status] || ''}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

export function ReportIssueDialog({ open, onOpenChange }: ReportIssueDialogProps) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('new');

  const { data: myReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['my-issue-reports'],
    queryFn: getMyIssueReports,
    enabled: open && activeTab === 'mine',
  });

  const attachScreenshot = useCallback((file: File) => {
    setScreenshot(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const removeScreenshot = useCallback(() => {
    setScreenshot(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) attachScreenshot(file);
    e.target.value = ''; // allow re-selecting the same file
  };

  // Ctrl+V paste anywhere inside the dialog attaches a clipboard image
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          attachScreenshot(file);
          e.preventDefault();
          return;
        }
      }
    }
  };

  const submitMutation = useMutation({
    mutationFn: () =>
      createIssueReport({
        title: title.trim(),
        description: description.trim() || undefined,
        pageUrl: location.pathname,
        screenshot,
      }),
    onSuccess: () => {
      handleApiSuccess('Issue submitted', 'The admin will review your report.');
      queryClient.invalidateQueries({ queryKey: ['my-issue-reports'] });
      queryClient.invalidateQueries({ queryKey: ['issue-reports'] });
      setTitle('');
      setDescription('');
      removeScreenshot();
      setActiveTab('mine');
    },
    onError: (error) => handleApiError(error, 'Failed to submit issue'),
  });

  const canSubmit = title.trim().length >= 3 && !submitMutation.isPending;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString([], { day: 'numeric', month: 'short' }) +
    ', ' +
    new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onPaste={handlePaste}>
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Tell the admin about a problem you found. Attach a screenshot if you can.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">New Report</TabsTrigger>
            <TabsTrigger value="mine">My Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="issue-title">
                What went wrong? <span className="text-destructive">*</span>
              </Label>
              <Input
                id="issue-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Save button not working on GRN page"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="issue-description">Details (optional)</Label>
              <Textarea
                id="issue-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What did you do, and what happened?"
                rows={3}
                maxLength={5000}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Screenshot (optional)</Label>
              {previewUrl ? (
                <div className="relative inline-block">
                  <img
                    src={previewUrl}
                    alt="Screenshot preview"
                    className="max-h-40 rounded-md border object-contain"
                  />
                  <button
                    type="button"
                    onClick={removeScreenshot}
                    className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 shadow"
                    aria-label="Remove screenshot"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed rounded-md p-4 text-center text-sm text-muted-foreground hover:bg-muted transition-colors"
                >
                  <ImagePlus className="h-5 w-5 mx-auto mb-1" />
                  Click to attach, or press <kbd className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
                    Ctrl+V
                  </kbd>{' '}
                  to paste a screenshot
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">Reporting from: {location.pathname}</span>
              <Button onClick={() => submitMutation.mutate()} disabled={!canSubmit}>
                {submitMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Submit
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="mine" className="pt-2">
            {reportsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : myReports.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                You haven't reported any issues yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {myReports.map((report) => (
                  <div key={report.id} className="border rounded-md p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{report.title}</p>
                      <IssueStatusBadge status={report.status} />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDate(report.createdAt)}
                      {report.pageUrl && <span className="ml-2">on {report.pageUrl}</span>}
                    </div>
                    {report.adminNotes && (
                      <p className="text-xs bg-muted rounded px-2 py-1 mt-1">
                        <span className="font-medium">Admin:</span> {report.adminNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
