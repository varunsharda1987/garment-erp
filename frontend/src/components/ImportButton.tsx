// ImportButton Component - File upload button with preview modal
import React, { useState, useRef } from 'react';
import importService from '../services/import.service';
import ImportPreview from './ImportPreview';
import type { ImportButtonProps, ImportResult } from '../types/import.types';
import { logError } from '../lib/logger';

const ImportButton: React.FC<ImportButtonProps> = ({
  module,
  onSuccess,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setIsOpen(false);

    try {
      // Preview the import
      const result = await importService.previewImport(module, file);
      setPreviewResult(result);
      setSelectedFile(file);
    } catch (err: any) {
      logError('Preview failed:', err);
      setError(err.message || 'Failed to preview import');
      setTimeout(() => setError(null), 5000);
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
        if (onSuccess) {
          onSuccess();
        }
      }

      return result;
    } catch (err: any) {
      logError('Import failed:', err);
      throw err;
    }
  };

  const handleDownloadTemplate = async (format: 'csv' | 'excel') => {
    setIsOpen(false);
    try {
      await importService.downloadTemplate(module, format);
    } catch (err: any) {
      logError('Template download failed:', err);
      setError(err.message || 'Failed to download template');
      setTimeout(() => setError(null), 5000);
    }
  };

  const triggerFileSelect = () => {
    setIsOpen(false);
    fileInputRef.current?.click();
  };

  return (
    <>
      <div className="relative inline-block">
        {/* Import Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled || isProcessing}
          className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 ${className}`}
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span>Import</span>
              <svg
                className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </>
          )}
        </button>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Dropdown Menu */}
        {isOpen && !isProcessing && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 border border-gray-200">
              <div className="py-1">
                <button
                  onClick={triggerFileSelect}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
                  </svg>
                  <span>Upload CSV/Excel</span>
                </button>

                <div className="border-t border-gray-200 my-1"></div>

                <div className="px-4 py-2 text-xs text-gray-500 font-medium">
                  Download Template
                </div>

                <button
                  onClick={() => handleDownloadTemplate('csv')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                  </svg>
                  <span>CSV Template</span>
                </button>

                <button
                  onClick={() => handleDownloadTemplate('excel')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                  </svg>
                  <span>Excel Template</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded shadow-lg z-20">
            <p className="text-sm">{error}</p>
          </div>
        )}
      </div>

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
