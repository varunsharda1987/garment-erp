/**
 * Issue Reports (Admin)
 *
 * Review issues submitted by the team: screenshots, status workflow, admin notes.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bug, Loader2, ImageIcon, StickyNote, Save } from 'lucide-react';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { getAllIssueReports, updateIssueReport } from '@/services/issue-report.service';
import { IssueStatusBadge } from '@/components/ReportIssueDialog';
import type { IssueReport, IssueStatus } from '@/types/issueReport.types';

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'FIXED', label: 'Fixed' },
  { value: 'CLOSED', label: 'Closed' },
];

const STATUS_OPTIONS: IssueStatus[] = ['OPEN', 'IN_PROGRESS', 'FIXED', 'CLOSED'];

export default function IssueReports() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [notesReport, setNotesReport] = useState<IssueReport | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['issue-reports', statusFilter, page],
    queryFn: () =>
      getAllIssueReports({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as IssueStatus),
        page,
        limit: 20,
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: string; status?: IssueStatus; adminNotes?: string }) =>
      updateIssueReport(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-reports'] });
      queryClient.invalidateQueries({ queryKey: ['my-issue-reports'] });
      handleApiSuccess('Updated', 'Issue report updated.');
    },
    onError: (error) => handleApiError(error, 'Failed to update issue report'),
  });

  const reports = data?.data ?? [];
  const pagination = data?.pagination;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' +
    new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const openNotes = (report: IssueReport) => {
    setNotesReport(report);
    setNotesDraft(report.adminNotes || '');
  };

  const saveNotes = () => {
    if (!notesReport) return;
    updateMutation.mutate({ id: notesReport.id, adminNotes: notesDraft });
    setNotesReport(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Bug className="h-6 w-6" />
        <div>
          <h1 className="text-3xl font-display font-medium text-foreground">Issue Reports</h1>
          <p className="text-sm text-muted-foreground">Problems reported by your team, with screenshots</p>
        </div>
      </div>

      <Tabs
        value={statusFilter}
        onValueChange={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
      >
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bug className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No issue reports{statusFilter !== 'ALL' ? ` with status "${statusFilter}"` : ''}.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reported By</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>Screenshot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="text-sm font-medium">
                        {report.user ? `${report.user.firstName} ${report.user.lastName}` : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">{report.user?.role}</div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="text-sm font-medium">{report.title}</div>
                      {report.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2">{report.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {report.pageUrl || '—'}
                    </TableCell>
                    <TableCell>
                      {report.screenshotUrl ? (
                        <button type="button" onClick={() => setScreenshotUrl(report.screenshotUrl)} className="block">
                          <img
                            src={report.screenshotUrl}
                            alt="Screenshot"
                            className="h-12 w-20 object-cover rounded border hover:opacity-80 transition-opacity"
                          />
                        </button>
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={report.status}
                        onValueChange={(value) =>
                          updateMutation.mutate({ id: report.id, status: value as IssueStatus })
                        }
                      >
                        <SelectTrigger className="w-36 h-8">
                          <SelectValue>
                            <IssueStatusBadge status={report.status} />
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              <IssueStatusBadge status={status} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openNotes(report)} className="h-8">
                        <StickyNote className="h-4 w-4" />
                        {report.adminNotes && <span className="ml-1 text-xs">✓</span>}
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(report.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Full-size screenshot viewer */}
      <Dialog open={!!screenshotUrl} onOpenChange={(open) => !open && setScreenshotUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Screenshot</DialogTitle>
          </DialogHeader>
          {screenshotUrl && (
            <div className="overflow-auto max-h-[75vh]">
              <img src={screenshotUrl} alt="Issue screenshot" className="w-full rounded-md" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin notes editor */}
      <Dialog open={!!notesReport} onOpenChange={(open) => !open && setNotesReport(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Admin Notes</DialogTitle>
          </DialogHeader>
          {notesReport && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                For: <span className="font-medium text-foreground">{notesReport.title}</span>
              </p>
              <Textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="What did you do about it? The reporter sees this note."
                rows={4}
                maxLength={5000}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNotesReport(null)}>
                  Cancel
                </Button>
                <Button onClick={saveNotes} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Note
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
