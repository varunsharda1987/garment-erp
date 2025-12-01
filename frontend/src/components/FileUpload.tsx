import { useCallback, useState } from 'react';
import { Upload, X, File, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/notify';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  accept?: string;
  maxSize?: number; // in MB
  maxFiles?: number;
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
}

interface UploadedFile {
  file: File;
  preview?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export default function FileUpload({
  onFilesSelect,
  accept,
  maxSize = 10, // 10MB default
  maxFiles = 5,
  multiple = true,
  className,
  disabled = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      return `File size exceeds ${maxSize}MB`;
    }

    // Check file type if accept is specified
    if (accept) {
      const acceptedTypes = accept.split(',').map(t => t.trim());
      const fileType = file.type;
      const fileExtension = `.${file.name.split('.').pop()}`;

      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type;
        }
        if (type.endsWith('/*')) {
          return fileType.startsWith(type.slice(0, -1));
        }
        return fileType === type;
      });

      if (!isAccepted) {
        return `File type not accepted. Accepted types: ${accept}`;
      }
    }

    return null;
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || disabled) return;

    const fileArray = Array.from(files);

    // Check max files limit
    if (uploadedFiles.length + fileArray.length > maxFiles) {
      notify.error('Too many files', {
        description: `Maximum ${maxFiles} files allowed`,
      });
      return;
    }

    const validFiles: File[] = [];
    const newUploadedFiles: UploadedFile[] = [];

    fileArray.forEach(file => {
      const error = validateFile(file);

      if (error) {
        notify.error('File validation failed', {
          description: `${file.name}: ${error}`,
        });
        newUploadedFiles.push({
          file,
          status: 'error',
          error,
        });
      } else {
        validFiles.push(file);
        newUploadedFiles.push({
          file,
          status: 'success',
          preview: file.type.startsWith('image/')
            ? URL.createObjectURL(file)
            : undefined,
        });
      }
    });

    setUploadedFiles(prev => [...prev, ...newUploadedFiles]);

    if (validFiles.length > 0) {
      onFilesSelect(validFiles);
    }
  }, [uploadedFiles, maxFiles, disabled, onFilesSelect, validateFile]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!disabled) {
      handleFiles(e.dataTransfer.files);
    }
  }, [disabled, handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input value so same file can be selected again
    e.target.value = '';
  }, [handleFiles]);

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev];
      const removed = newFiles.splice(index, 1)[0];
      // Revoke object URL to prevent memory leaks
      if (removed.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return newFiles;
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            'p-4 rounded-full',
            isDragging ? 'bg-primary/10' : 'bg-muted'
          )}>
            <Upload className={cn(
              'h-8 w-8',
              isDragging ? 'text-primary' : 'text-muted-foreground'
            )} />
          </div>

          <div>
            <p className="text-sm font-medium mb-1">
              {isDragging ? 'Drop files here' : 'Drag and drop files here'}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              or click to browse
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={disabled}
          >
            Browse Files
          </Button>

          {(accept || maxSize || maxFiles) && (
            <div className="text-xs text-muted-foreground space-y-1">
              {accept && <p>Accepted: {accept}</p>}
              {maxSize && <p>Max size: {maxSize}MB per file</p>}
              {maxFiles && <p>Max files: {maxFiles}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadedFiles.map((uploadedFile, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              {/* File Icon/Preview */}
              <div className="flex-shrink-0">
                {uploadedFile.preview ? (
                  <img
                    src={uploadedFile.preview}
                    alt={uploadedFile.file.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                    <File className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {uploadedFile.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(uploadedFile.file.size)}
                </p>
                {uploadedFile.error && (
                  <p className="text-xs text-destructive mt-1">
                    {uploadedFile.error}
                  </p>
                )}
              </div>

              {/* Status Icon */}
              <div className="flex-shrink-0">
                {uploadedFile.status === 'success' && (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                )}
                {uploadedFile.status === 'error' && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
              </div>

              {/* Remove Button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => removeFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
