/**
 * Mini Marker Dialog
 * Dialog for viewing, uploading, and managing mini marker files per purpose
 */
import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Trash2, FileText, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { miniMarkerService } from '@/services/miniMarker.service';
import { getUploadUrl } from '@/config/api.config';
import { notify } from '@/lib/notify';
import type { CadPurpose, MiniMarkerFile } from '@/types/cadFile.types';
import { CadPurposeLabels, groupMiniMarkersByPurpose } from '@/types/cadFile.types';
import ConfirmDialog from '@/components/ConfirmDialog';

interface MiniMarkerDialogProps {
  styleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When false, hides Upload and Delete (view-only, e.g. cutting floor) */
  editable?: boolean;
}

const PURPOSES: CadPurpose[] = ['COSTING', 'RAW_MATERIAL_CALCULATION', 'PRODUCTION'];

function getApiErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || fallback;
}

export function MiniMarkerDialog({ styleId, open, onOpenChange, editable = true }: MiniMarkerDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<CadPurpose>('PRODUCTION');
  const [uploading, setUploading] = useState(false);
  const [deleteFile, setDeleteFile] = useState<MiniMarkerFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch mini markers
  const { data, isLoading } = useQuery({
    queryKey: ['miniMarkers', styleId],
    queryFn: () => miniMarkerService.getAll(styleId),
    enabled: open,
  });

  // Backend returns a flat list; group here so the response serializer can't corrupt purpose keys
  const grouped = useMemo(() => groupMiniMarkersByPurpose(data?.files), [data]);

  const refreshMarkers = () => {
    queryClient.invalidateQueries({ queryKey: ['miniMarkers', styleId] });
    queryClient.invalidateQueries({ queryKey: ['miniMarkerCount', styleId] });
  };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: ({ file, purpose }: { file: File; purpose: CadPurpose }) =>
      miniMarkerService.upload(styleId, file, purpose),
    onSuccess: () => {
      refreshMarkers();
      notify.success('Mini marker uploaded successfully');
    },
    onError: (error: unknown) => {
      notify.error(getApiErrorMessage(error, 'Failed to upload mini marker'));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => miniMarkerService.delete(styleId, fileId),
    onSuccess: () => {
      refreshMarkers();
      notify.success('Mini marker deleted');
      setDeleteFile(null);
    },
    onError: (error: unknown) => {
      notify.error(getApiErrorMessage(error, 'Failed to delete mini marker'));
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      notify.error('Only JPG, PNG, and PDF files are allowed');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      notify.error('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      await uploadMutation.mutateAsync({ file, purpose: activeTab });
    } catch {
      // allow-silent-catch — error toast already raised by the mutation's onError
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const openFile = (fileUrl: string) => {
    window.open(getUploadUrl(fileUrl), '_blank');
  };

  const isPdf = (fileName: string | null) => fileName?.toLowerCase().endsWith('.pdf');

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderFileCard = (file: MiniMarkerFile) => {
    const isImage = !isPdf(file.fileName);

    return (
      <div key={file.id} className="relative group border rounded-lg overflow-hidden bg-muted/30">
        {/* Preview */}
        <div
          className="aspect-square cursor-pointer flex items-center justify-center"
          onClick={() => openFile(file.fileUrl)}
        >
          {isImage ? (
            <img
              src={getUploadUrl(file.fileUrl)}
              alt={file.fileName || 'Mini marker'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-4">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mt-2">PDF</span>
            </div>
          )}
        </div>

        {/* File info */}
        <div className="p-2 border-t">
          <p className="text-xs truncate" title={file.fileName || undefined}>
            {file.fileName || 'Unnamed file'}
          </p>
          <p className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</p>
        </div>

        {/* Actions overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => openFile(file.fileUrl)}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          {editable && (
            <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => setDeleteFile(file)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderPurposeContent = (purpose: CadPurpose) => {
    const files = grouped[purpose];

    return (
      <div className="space-y-4">
        {/* Upload button */}
        {editable && (
          <div className="flex justify-end">
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button onClick={handleUploadClick} disabled={uploading} size="sm">
              {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload Mini Marker
            </Button>
          </div>
        )}

        {/* Files grid */}
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
            <p>No mini markers uploaded for {CadPurposeLabels[purpose]}</p>
            {editable && <p className="text-sm">Click "Upload Mini Marker" to add files</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{files.map(renderFileCard)}</div>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Mini Markers
              {data && <Badge variant="secondary">{data.total} files</Badge>}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CadPurpose)}>
              <TabsList className="grid w-full grid-cols-3">
                {PURPOSES.map((purpose) => (
                  <TabsTrigger key={purpose} value={purpose}>
                    {CadPurposeLabels[purpose]}
                    {grouped[purpose].length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {grouped[purpose].length}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {PURPOSES.map((purpose) => (
                <TabsContent key={purpose} value={purpose} className="mt-4">
                  {renderPurposeContent(purpose)}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteFile}
        onOpenChange={(open) => !open && setDeleteFile(null)}
        title="Delete Mini Marker"
        description={`Are you sure you want to delete "${deleteFile?.fileName || 'this file'}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={() => deleteFile && deleteMutation.mutate(deleteFile.id)}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
