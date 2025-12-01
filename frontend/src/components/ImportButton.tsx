/**
 * ImportButton Component
 *
 * File upload button with preview modal for importing data.
 * Uses the unified Button component and DropdownMenu for consistent styling.
 */
import React, { useState, useRef } from 'react';
import { Upload, FileText, FileSpreadsheet, ChevronDown, Loader2, Download } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './ui/dropdown-menu';
import importService from '../services/import.service';
import ImportPreview from './ImportPreview';
import { notify } from '../lib/notify';
import type { ImportButtonProps, ImportResult } from '../types/import.types';
import { logError } from '../lib/logger';

const ImportButton: React.FC<ImportButtonProps> = ({
  module,
  onSuccess,
  disabled = false,
  className = '',
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      // Preview the import
      const result = await importService.previewImport(module, file);
      setPreviewResult(result);
      setSelectedFile(file);
    } catch (err: unknown) {
      logError('Preview failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to preview import';
      notify.error(message);
    } finally {
      setIsProcessing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = async (file: File): Promise<ImportResult> => {
    try {
      const result = await importService.executeImport(module, file);

      if (result.success) {
        notify.success(`Successfully imported ${result.successCount || 0} records`);
        if (onSuccess) {
          onSuccess();
        }
      }

      return result;
    } catch (err: unknown) {
      logError('Import failed:', err);
      throw err;
    }
  };

  const handleDownloadTemplate = async (format: 'csv' | 'excel') => {
    try {
      await importService.downloadTemplate(module, format);
      notify.success(`${format.toUpperCase()} template downloaded`);
    } catch (err: unknown) {
      logError('Template download failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to download template';
      notify.error(message);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled || isProcessing}
            className={className}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import
                <ChevronDown className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={triggerFileSelect}>
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV/Excel
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Download Template
          </DropdownMenuLabel>

          <DropdownMenuItem onClick={() => handleDownloadTemplate('csv')}>
            <FileText className="h-4 w-4 mr-2" />
            CSV Template
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDownloadTemplate('excel')}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel Template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Import Preview Modal */}
      <ImportPreview
        module={module}
        result={previewResult}
        file={selectedFile}
        isOpen={!!previewResult && !!selectedFile}
        onClose={() => {
          setPreviewResult(null);
          setSelectedFile(null);
        }}
        onConfirm={handleConfirmImport}
      />
    </>
  );
};

export default ImportButton;
