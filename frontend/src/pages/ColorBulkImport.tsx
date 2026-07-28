import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { logDebug, logError } from '../lib/logger';
import { colorService } from '@/services/colorService';
import type { ColorImportRow, ColorBulkImportResult } from '@/types/color.types';

export default function ColorBulkImport() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ColorBulkImportResult | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string | number | boolean | undefined>[]>([]);

  const downloadTemplate = () => {
    const columns = [
      { header: 'Color Name', required: true },
      { header: 'Hex Code', required: false },
      { header: 'Color Family', required: false },
      { header: 'Description', required: false },
    ];

    const headerRow = columns.map((col) => col.header);
    const requiredRow = columns.map((col) => (col.required ? 'Required' : 'Optional'));

    const sampleData = [
      ['Navy Blue', '#000080', 'Blues', 'Deep navy blue'],
      ['Crimson', '#DC143C', 'Reds', 'Bright crimson red'],
      ['Forest Green', '#228B22', 'Greens', 'Deep forest green'],
    ];

    const sheetData = [headerRow, requiredRow, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Color Template');

    ws['!cols'] = [
      { wch: 25 }, // Color Name
      { wch: 15 }, // Hex Code
      { wch: 20 }, // Color Family
      { wch: 35 }, // Description
    ];

    XLSX.writeFile(wb, 'Color_Import_Template.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      previewFile(selectedFile);
    }
  };

  const parseRows = (
    rawData: (string | number | boolean | undefined)[][]
  ): Record<string, string | number | boolean | undefined>[] => {
    const headers = rawData[0] as string[];
    let dataStartRow = 1;

    // Check if second row is a Required/Optional indicator row
    if (rawData.length > 1) {
      const secondRow = rawData[1] as (string | number | boolean | undefined)[];
      const isIndicatorRow = secondRow.every((val) => {
        const normalized = (val || '').toString().toLowerCase().trim();
        return normalized === '' || normalized === 'required' || normalized === 'optional';
      });
      if (isIndicatorRow) {
        dataStartRow = 2;
      }
    }

    const jsonData: Record<string, string | number | boolean | undefined>[] = [];
    for (let i = dataStartRow; i < rawData.length; i++) {
      const rowData = rawData[i] as (string | number | boolean | undefined)[];
      if (!rowData || rowData.length === 0) continue;

      const row: Record<string, string | number | boolean | undefined> = {};
      headers.forEach((header, index) => {
        if (header) {
          row[header] = rowData[index];
        }
      });
      jsonData.push(row);
    }
    return jsonData;
  };

  const previewFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (
          | string
          | number
          | boolean
          | undefined
        )[][];

        if (rawData.length < 2) {
          setPreviewData([]);
          return;
        }

        setPreviewData(parseRows(rawData).slice(0, 5));
      } catch (error) {
        logError('Error reading file:', error);
        alert('Error reading Excel file. Please check the format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setImporting(true);
      setResult(null);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (
            | string
            | number
            | boolean
            | undefined
          )[][];

          if (rawData.length < 2) {
            throw new Error('File must have header and at least one data row');
          }

          const jsonData = parseRows(rawData);

          // Transform Excel data to API format, dropping rows without a color name.
          const colors: ColorImportRow[] = jsonData
            .map((row) => {
              const colorName = String(row['Color Name'] ?? '').trim();
              const hexCode = String(row['Hex Code'] ?? '').trim();
              const colorFamily = String(row['Color Family'] ?? '').trim();
              const description = String(row['Description'] ?? '').trim();

              return {
                colorName,
                hexCode: hexCode || undefined,
                colorFamily: colorFamily || undefined,
                description: description || undefined,
              };
            })
            .filter((row) => row.colorName.length > 0);

          if (colors.length === 0) {
            throw new Error('No valid rows found. Each row needs a Color Name.');
          }

          logDebug('Importing colors', { count: colors.length });
          const importResult = await colorService.bulkImport(colors);
          setResult(importResult);
        } catch (error: unknown) {
          logError('Import error:', error);
          alert((error as Error).message || 'Failed to import color data');
        } finally {
          setImporting(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error: unknown) {
      logError('Import error:', error);
      alert('Failed to process file');
      setImporting(false);
    }
  };

  return (
    <>
      <PageHeader title="Bulk Import Colors" />

      <div className="space-y-6">
        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Step 1: Download Template</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Download the Excel template with the correct format and sample data.
                </p>
                <Button onClick={downloadTemplate} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-2">Step 2: Fill Data</h4>
                <p className="text-sm text-muted-foreground">Open the template and fill in your color data.</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
                  <li>Color Name (required, e.g., Navy Blue)</li>
                  <li>Hex Code (optional, e.g., #000080)</li>
                  <li>
                    Color Family (optional: Reds, Blues, Greens, Yellows, Oranges, Purples, Pinks, Browns, Neutrals,
                    Prints, Metallics)
                  </li>
                  <li>Description (optional)</li>
                </ul>
                <div className="mt-3 p-3 bg-info-muted rounded-lg border border-info/20">
                  <p className="text-sm text-info">
                    <strong>Note:</strong> Color Code will be auto-generated by the system.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-2">Step 3: Upload File</h4>
                <p className="text-sm text-muted-foreground mb-3">Upload the completed Excel file to import colors.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Excel File</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-info-muted file:text-info
                    hover:file:bg-info-muted"
                />
              </div>

              {file && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    File selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
                  </AlertDescription>
                </Alert>
              )}

              {previewData.length > 0 && (
                <div>
                  <h4 className="font-medium text-foreground mb-2">Preview (First 5 rows)</h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Color Name</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Hex Code</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                            Color Family
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                        </tr>
                      </thead>
                      <tbody className="bg-card divide-y divide-gray-200">
                        {previewData.map((row, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-sm">{row['Color Name']}</td>
                            <td className="px-3 py-2 text-sm">{row['Hex Code']}</td>
                            <td className="px-3 py-2 text-sm">{row['Color Family']}</td>
                            <td className="px-3 py-2 text-sm">{row['Description']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button onClick={handleImport} disabled={!file || importing}>
                  {importing ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Colors
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => navigate('/colors')}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Card */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.failed === 0 ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-warning" />
                )}
                Import Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-success-muted rounded-lg border border-success/20">
                    <div className="text-2xl font-bold text-success">{result.success}</div>
                    <div className="text-sm text-success">Successfully Imported</div>
                  </div>
                  <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                    <div className="text-2xl font-bold text-destructive">{result.failed}</div>
                    <div className="text-sm text-destructive">Failed</div>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-foreground mb-2">Errors:</h4>
                    <div className="space-y-2">
                      {result.errors.map((error, index) => (
                        <Alert key={index} variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            Row {error.row}
                            {error.colorName ? ` (${error.colorName})` : ''}: {error.error}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={() => navigate('/colors')}>Go to Color Master List</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
