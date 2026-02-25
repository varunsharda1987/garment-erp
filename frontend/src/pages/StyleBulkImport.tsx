import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { importStyles, downloadTemplate } from '../services/style-import.service';
import type { StyleImportResponse } from '../types/style-import.types';
import { Upload, Download, CheckCircle, XCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';

export default function StyleBulkImport() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<StyleImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!validTypes.includes(selectedFile.type) &&
        !selectedFile.name.endsWith('.csv') &&
        !selectedFile.name.endsWith('.xlsx')) {
      setError('Please upload a CSV or Excel file');
      return;
    }

    // Validate file size (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setImportResult(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'style_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to download template';
      setError(errorMessage);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file to import');
      return;
    }

    try {
      setIsUploading(true);
      setIsProcessing(true);
      setError(null);
      setImportResult(null);

      const result = await importStyles(file, {
        overwriteExisting,
        skipDuplicates,
      });

      setImportResult(result);

      if (result.success) {
        // Success - show results
      } else {
        setError('Import completed with errors. See details below.');
      }
    } catch (err) {
      const errorMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Import failed';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setImportResult(null);
    setError(null);
    setOverwriteExisting(false);
    setSkipDuplicates(true);
  };

  const renderPreview = () => {
    if (!file) return null;

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-10 w-10 text-blue-600" />
            <div>
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
          {!importResult && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-red-600 hover:text-red-700"
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!importResult) return null;

    const { summary, errors } = importResult;

    return (
      <div className="mt-6 space-y-4">
        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {summary.errorCount === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
              Import Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{summary.totalRows}</div>
                <div className="text-sm text-gray-600">Total Rows</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{summary.successCount}</div>
                <div className="text-sm text-gray-600">Success</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{summary.skippedCount || 0}</div>
                <div className="text-sm text-gray-600">Skipped</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{summary.errorCount}</div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {(summary.processingTimeMs / 1000).toFixed(2)}s
                </div>
                <div className="text-sm text-gray-600">Time</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-lg font-semibold text-gray-900">{summary.stylesCreated}</div>
                <div className="text-sm text-gray-600">Styles Created</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-lg font-semibold text-gray-900">{summary.stylesUpdated || 0}</div>
                <div className="text-sm text-gray-600">Styles Updated</div>
              </div>
              <div className="p-3 bg-gray-50 rounded">
                <div className="text-lg font-semibold text-gray-900">{summary.variantsCreated || 0}</div>
                <div className="text-sm text-gray-600">SKUs Created</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Errors Card */}
        {errors && errors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                Errors ({errors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Row
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Style Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Component
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Error
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {errors.map((error, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm text-gray-900">{error.rowNumber || index + 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{error.styleCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{error.componentName}</td>
                        <td className="px-4 py-3 text-sm text-red-600">{error.errorMessage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <Button variant="outline" onClick={handleReset}>
            Import Another File
          </Button>
          {summary.errorCount === 0 && (
            <Button onClick={() => navigate('/styles')}>
              View Styles
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Style Import</CardTitle>
          <p className="text-sm text-gray-500 mt-2">
            Import multiple styles with fabrics and CAD data from CSV or Excel file
          </p>
        </CardHeader>
        <CardContent>
          {/* Download Template */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-blue-900">Download Template First</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Download the sample template to see the required format for your import file.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Template
              </Button>
            </div>
          </div>

          {/* File Upload */}
          {!importResult && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="file-upload" className="text-base font-medium">
                  Select File to Import
                </Label>
                <div className="mt-2">
                  <div
                    className="flex items-center justify-center w-full"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <label
                      htmlFor="file-upload"
                      className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">CSV or Excel (.xlsx) file</p>
                        <p className="text-xs text-gray-400 mt-2">Maximum file size: 10MB</p>
                      </div>
                      <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        accept=".csv,.xlsx"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {renderPreview()}

              {/* Import Options */}
              {file && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900">Import Options</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={overwriteExisting}
                          onChange={(e) => setOverwriteExisting(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          Overwrite existing styles with same code
                        </span>
                      </label>
                      <div className="ml-6 mt-1 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                        <strong>Warning:</strong> Only updates basic style info (Name, Customer, Season, Gender, Category).
                        Components, Fabrics, CAD data, Variants, and Production Processes will be <strong>added new</strong>, not replaced.
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={skipDuplicates}
                          onChange={(e) => setSkipDuplicates(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">
                          Skip duplicate style codes (recommended)
                        </span>
                      </label>
                      <p className="ml-6 mt-1 text-xs text-gray-500">
                        If a style code already exists in the system, that row will be skipped without any changes.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 justify-end pt-4">
                <Button variant="outline" onClick={() => navigate('/styles')}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!file || isUploading}
                  className="flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import Styles
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Results */}
          {renderResults()}
        </CardContent>
      </Card>
    </div>
  );
}
