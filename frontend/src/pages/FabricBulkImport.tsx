import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { logDebug, logError } from '../lib/logger';

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export default function FabricBulkImport() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string | number | boolean | undefined>[]>([]);

  const downloadTemplate = () => {
    // Define column headers with their required/optional status
    const columns = [
      { header: 'Greige Code', required: true },
      { header: 'Generic Greige Name', required: false },
      { header: 'Fabric Name', required: false },
      { header: 'Color Name', required: false },
      { header: 'Color Code', required: false },
      { header: 'Finish Type', required: true },
      { header: 'Print Design', required: false },
      { header: 'Actual Width (inches)', required: true },
      { header: 'Cutable Width (inches)', required: false },
      { header: 'Finished Construction', required: false },
      { header: 'Actual GSM', required: false },
      { header: 'Value Addition', required: false },
      { header: 'Value Addition Cost', required: false },
      { header: 'Style Reference', required: false },
      { header: 'Description', required: false },
      { header: 'Notes', required: false },
      { header: 'Is Generic', required: false },
      { header: 'Is Active', required: false },
    ];

    // Create header row
    const headerRow = columns.map((col) => col.header);

    // Create Required/Optional indicator row
    const requiredRow = columns.map((col) => (col.required ? 'Required' : 'Optional'));

    // Sample data rows
    const sampleData = [
      [
        'GRG-0001',
        'Cambric',
        'Cambric 58" - White',
        'White',
        '#FFFFFF',
        'Mercerized',
        '',
        58,
        56,
        '40×40/133×72',
        120,
        'Embroidery',
        15.5,
        '',
        'High quality cambric fabric',
        '',
        'TRUE',
        'TRUE',
      ],
      [
        'GRG-0002',
        'Poplin',
        'STY-001 - Poplin 60" - Blue',
        'Sky Blue',
        '#87CEEB',
        'Soft Finish',
        '',
        60,
        58,
        '40×40/120×60',
        115,
        '',
        '',
        'STY-001',
        'Style-specific poplin',
        '',
        'FALSE',
        'TRUE',
      ],
    ];

    // Create sheet data with headers, required/optional row, and sample data
    const sheetData = [headerRow, requiredRow, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fabric Template');

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Greige Code
      { wch: 20 }, // Generic Greige Name
      { wch: 35 }, // Fabric Name
      { wch: 15 }, // Color Name
      { wch: 12 }, // Color Code
      { wch: 15 }, // Finish Type
      { wch: 20 }, // Print Design
      { wch: 20 }, // Actual Width
      { wch: 20 }, // Cutable Width
      { wch: 20 }, // Finished Construction
      { wch: 12 }, // Actual GSM
      { wch: 20 }, // Value Addition
      { wch: 20 }, // Value Addition Cost
      { wch: 20 }, // Style Reference
      { wch: 30 }, // Description
      { wch: 20 }, // Notes
      { wch: 12 }, // Is Generic
      { wch: 12 }, // Is Active
    ];

    XLSX.writeFile(wb, 'Fabric_Import_Template.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      previewFile(selectedFile);
    }
  };

  const previewFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Get raw data as array of arrays to check for indicator row
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
            dataStartRow = 2; // Skip the indicator row
          }
        }

        // Convert remaining rows to objects
        const jsonData: Record<string, string | number | boolean | undefined>[] = [];
        for (let i = dataStartRow; i < rawData.length && jsonData.length < 5; i++) {
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

        setPreviewData(jsonData);
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

          // Get raw data as array of arrays to check for indicator row
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (
            | string
            | number
            | boolean
            | undefined
          )[][];

          if (rawData.length < 2) {
            throw new Error('File must have header and at least one data row');
          }

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
              dataStartRow = 2; // Skip the indicator row
            }
          }

          // Convert remaining rows to objects
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

          // Transform Excel data to API format
          const fabricData = jsonData.map(
            (row: Record<string, string | number | boolean | undefined>, index: number) => {
              // Parse numeric values
              const parseNumber = (value: unknown, defaultValue?: number): number | undefined => {
                if (value === undefined || value === null || value === '') return defaultValue;
                const parsed = parseFloat(String(value).replace(/[^0-9.]/g, ''));
                return isNaN(parsed) ? defaultValue : parsed;
              };

              // Safely get trimmed string value
              const getString = (value: string | number | boolean | undefined): string => {
                if (value === undefined || value === null) return '';
                return String(value).trim();
              };

              const actualWidth = parseNumber(row['Actual Width (inches)'], 58);
              const cutableWidth = parseNumber(
                row['Cutable Width (inches)'],
                actualWidth ? actualWidth - 2 : undefined
              );

              const result = {
                // Note: fabricCode will be auto-generated by backend
                fabricName: getString(row['Fabric Name']),
                greigeCode: getString(row['Greige Code']),
                genericGreigeName: getString(row['Generic Greige Name']),
                colorName: getString(row['Color Name']),
                colorCode: getString(row['Color Code']),
                finishType: getString(row['Finish Type']),
                printDesign: getString(row['Print Design']),
                actualWidth,
                cutableWidth,
                finishedConstruction: getString(row['Finished Construction']),
                actualGSM: parseNumber(row['Actual GSM']),
                valueAddition: getString(row['Value Addition']),
                valueAdditionCost: parseNumber(row['Value Addition Cost']),
                styleReference: getString(row['Style Reference']),
                description: getString(row['Description']),
                notes: getString(row['Notes']),
                isGeneric: row['Is Generic']?.toString().toUpperCase() === 'TRUE',
                isActive: row['Is Active']?.toString().toUpperCase() === 'TRUE',
                suppliers: [],
              };

              // Debug logging for first row
              if (index === 0) {
                logDebug('First row Excel data:', row);
                logDebug('Parsed fabric data:', result);
              }

              return result;
            }
          );

          // Get auth token
          const authStorage = localStorage.getItem('auth-storage');
          let token = null;
          if (authStorage) {
            const parsed = JSON.parse(authStorage);
            token = parsed?.state?.token;
          }

          // Fallback to direct token storage
          if (!token) {
            token = localStorage.getItem('token');
          }

          if (!token) {
            throw new Error('Authentication required. Please login again.');
          }

          // Call bulk import API
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/fabric-management/fabric/bulk-import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ fabrics: fabricData }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Import failed');
          }

          const importResult = await response.json();

          setResult({
            success: importResult.imported || 0,
            failed: importResult.failed || 0,
            errors: importResult.errors || [],
          });
        } catch (error: unknown) {
          logError('Import error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to import fabrics. Please try again.';
          alert(errorMessage);
        } finally {
          setImporting(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error: unknown) {
      logError('File reading error:', error);
      alert('Error reading file. Please try again.');
      setImporting(false);
    }
  };

  return (
    <>
      <PageHeader title="Fabric Bulk Import">
        <Button variant="outline" onClick={() => navigate('/fabric')}>
          Back to Fabric Master
        </Button>
      </PageHeader>

      <div className="space-y-6">
        {/* Instructions */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Import Instructions:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Download the Excel template below</li>
                <li>Fill in the fabric data (Greige Code is required, must exist in system)</li>
                <li>
                  Optional fields: Cutable Width (auto-calculated if empty), Value Addition fields, Style Reference
                </li>
                <li>For generic fabrics: Set "Is Generic" to TRUE and leave Style Reference empty</li>
                <li>For style-specific fabrics: Set "Is Generic" to FALSE and provide Style Reference</li>
                <li>Upload the completed file and click "Import"</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        {/* Template Download */}
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Download Template</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Excel Template
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Download the template file with sample data and correct column headers.
            </p>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Upload Completed File</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">Excel files (.xlsx, .xls)</p>
                </label>
              </div>

              {file && (
                <div className="flex items-center justify-between p-4 bg-info-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-info" />
                    <span className="text-sm font-medium text-foreground">{file.name}</span>
                  </div>
                  <Button
                    onClick={() => {
                      setFile(null);
                      setPreviewData([]);
                      setResult(null);
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {previewData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Preview (First 5 Rows)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Greige Code</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Generic Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fabric Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Color</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Width</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Construction</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Generic?</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-gray-200">
                    {previewData.map((row, index) => (
                      <tr key={index} className="hover:bg-muted">
                        <td className="px-3 py-2 text-sm text-foreground">{row['Greige Code']}</td>
                        <td className="px-3 py-2 text-sm text-foreground">{row['Generic Greige Name']}</td>
                        <td className="px-3 py-2 text-sm text-foreground">{row['Fabric Name']}</td>
                        <td className="px-3 py-2 text-sm text-foreground">{row['Color Name']}</td>
                        <td className="px-3 py-2 text-sm text-foreground">{row['Actual Width (inches)']}"</td>
                        <td className="px-3 py-2 text-sm text-foreground">{row['Finished Construction']}</td>
                        <td className="px-3 py-2 text-sm text-foreground">{row['Is Generic']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Import Button */}
        {file && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Import Data</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={handleImport} disabled={importing} className="w-full">
                {importing ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {previewData.length > 0 ? `(${previewData.length}+ rows)` : 'Fabrics'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Import Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Import Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 p-4 bg-success-muted rounded-lg">
                    <CheckCircle className="h-6 w-6 text-success" />
                    <div>
                      <p className="text-sm text-muted-foreground">Successfully Imported</p>
                      <p className="text-2xl font-bold text-success">{result.success}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg">
                    <XCircle className="h-6 w-6 text-destructive" />
                    <div>
                      <p className="text-sm text-muted-foreground">Failed</p>
                      <p className="text-2xl font-bold text-destructive">{result.failed}</p>
                    </div>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-foreground mb-2">Errors:</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {result.errors.map((err, index) => (
                        <Alert key={index} variant="destructive">
                          <AlertDescription>
                            Row {err.row}: {err.error}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={() => navigate('/fabric')}>View Imported Fabrics</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setPreviewData([]);
                      setResult(null);
                    }}
                  >
                    Import More
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
