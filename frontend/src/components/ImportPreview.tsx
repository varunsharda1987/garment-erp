// ImportPreview Component - Modal showing import preview with validation errors
import React, { useState } from 'react';
import type { ImportPreviewProps, ImportResult } from '../types/import.types';

const ImportPreview: React.FC<ImportPreviewProps> = ({
  module,
  result,
  file,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  if (!isOpen || !result) return null;

  const hasErrors = result.errors && result.errors.length > 0;
  const canImport = result.validRows > 0;

  const handleConfirm = async () => {
    if (!file) return;

    setIsImporting(true);

    try {
      const execResult = await onConfirm(file);
      setImportResult(execResult);

      // Auto-close after successful import
      if (execResult.success) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Import failed:', err);
      setImportResult({
        success: false,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: [{ row: 0, message: err.message || 'Import failed' }],
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">
              Import Preview - {module.charAt(0).toUpperCase() + module.slice(1)}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isImporting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-600">Total Rows</div>
                <div className="text-2xl font-bold text-blue-900">{result.totalRows}</div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm font-medium text-green-600">Valid Rows</div>
                <div className="text-2xl font-bold text-green-900">{result.validRows}</div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-sm font-medium text-red-600">Invalid Rows</div>
                <div className="text-2xl font-bold text-red-900">{result.invalidRows}</div>
              </div>
            </div>

            {/* Import Result (after execution) */}
            {importResult && (
              <div
                className={`mb-6 p-4 rounded-lg ${
                  importResult.success
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {importResult.success ? (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-medium">
                        Successfully imported {importResult.validRows} records!
                      </span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-medium">Import failed</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Validation Errors */}
            {hasErrors && result.errors && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-red-900 mb-3">
                  Validation Errors ({result.errors.length})
                </h3>
                <div className="max-h-64 overflow-y-auto">
                  <table className="min-w-full divide-y divide-red-200">
                    <thead className="bg-red-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-red-900">
                          Row
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-red-900">
                          Field
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-red-900">
                          Error
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-red-900">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-200">
                      {result.errors.slice(0, 50).map((error, index) => (
                        <tr key={index} className="bg-white">
                          <td className="px-3 py-2 text-sm text-red-900">{error.row}</td>
                          <td className="px-3 py-2 text-sm text-red-900">{error.field || '-'}</td>
                          <td className="px-3 py-2 text-sm text-red-700">{error.message}</td>
                          <td className="px-3 py-2 text-sm text-red-600 font-mono text-xs">
                            {error.value !== undefined ? String(error.value) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.errors.length > 50 && (
                    <p className="text-sm text-red-700 mt-2 text-center">
                      Showing first 50 of {result.errors.length} errors
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Preview Data */}
            {result.data && result.data.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Preview Data (First {Math.min(result.data.length, 10)} rows)
                </h3>
                <div className="max-h-64 overflow-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        {result.data[0] &&
                          Object.keys(result.data[0]).map((key) => (
                            <th
                              key={key}
                              className="px-3 py-2 text-left text-xs font-medium text-gray-700"
                            >
                              {key}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.data.slice(0, 10).map((row, index) => (
                        <tr key={index}>
                          {Object.values(row).map((value: any, cellIndex) => (
                            <td
                              key={cellIndex}
                              className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap"
                            >
                              {value !== null && value !== undefined ? String(value) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No Valid Data Warning */}
            {!canImport && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-800">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-medium">
                    No valid rows found. Please fix the errors and try again.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
            <button
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>

            {canImport && !importResult && (
              <button
                onClick={handleConfirm}
                disabled={isImporting}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isImporting ? (
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
                    <span>Importing {result.validRows} rows...</span>
                  </>
                ) : (
                  <span>Confirm Import ({result.validRows} rows)</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportPreview;
