import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { logDebug, logError } from '../lib/logger';
import { API_URL } from '../config/api.config';

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export default function GreigeBulkImport() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string | number | boolean | undefined>[]>([]);

  const downloadTemplate = () => {
    // Define column headers with their required/optional status
    const columns = [
      { header: 'Generic Greige Name', required: true },
      { header: 'Yarn Count', required: true },
      { header: 'Construction', required: true },
      { header: 'Greige Width (inches)', required: true },
      { header: 'Default Cutable Width (inches)', required: true },
      { header: 'Composition', required: true },
      { header: 'Weave Type', required: false },
      { header: 'GSM Range', required: false },
      { header: 'Expected Finished Width Min', required: false },
      { header: 'Expected Finished Width Max', required: false },
      { header: 'Average Shrinkage %', required: false },
      { header: 'Description', required: false },
      { header: 'Notes', required: false },
      { header: 'Is Active', required: false },
    ];

    // Create header row
    const headerRow = columns.map(col => col.header);

    // Create Required/Optional indicator row
    const requiredRow = columns.map(col => col.required ? 'Required' : 'Optional');

    // Sample data rows
    const sampleData = [
      ['Cambric', '40×40', '92×88', 63, 61, '100% Cotton', 'Plain', '120-130', 58, 61, 8, 'High quality cambric fabric', '', 'TRUE'],
      ['Poplin', '40×40', '133×72', 60, 58, '100% Cotton', 'Plain', '120-130', 54, 58, 8, 'Cotton poplin greige', '', 'TRUE'],
    ];

    // Create sheet data with headers, required/optional row, and sample data
    const sheetData = [headerRow, requiredRow, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Greige Template');

    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, // Generic Greige Name
      { wch: 15 }, // Yarn Count
      { wch: 15 }, // Construction
      { wch: 20 }, // Greige Width
      { wch: 28 }, // Default Cutable Width
      { wch: 20 }, // Composition
      { wch: 15 }, // Weave Type
      { wch: 15 }, // GSM Range
      { wch: 25 }, // Expected Finished Width Min
      { wch: 25 }, // Expected Finished Width Max
      { wch: 20 }, // Average Shrinkage %
      { wch: 30 }, // Description
      { wch: 20 }, // Notes
      { wch: 12 }, // Is Active
    ];

    XLSX.writeFile(wb, 'Greige_Import_Template.xlsx');
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
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | boolean | undefined)[][];

        if (rawData.length < 2) {
          setPreviewData([]);
          return;
        }

        const headers = rawData[0] as string[];
        let dataStartRow = 1;

        // Check if second row is a Required/Optional indicator row
        if (rawData.length > 1) {
          const secondRow = rawData[1] as (string | number | boolean | undefined)[];
          const isIndicatorRow = secondRow.every(val => {
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
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | boolean | undefined)[][];

          if (rawData.length < 2) {
            throw new Error('File must have header and at least one data row');
          }

          const headers = rawData[0] as string[];
          let dataStartRow = 1;

          // Check if second row is a Required/Optional indicator row
          if (rawData.length > 1) {
            const secondRow = rawData[1] as (string | number | boolean | undefined)[];
            const isIndicatorRow = secondRow.every(val => {
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
          const greigeData = jsonData.map((row: Record<string, string | number | boolean | undefined>, index: number) => {
            const genericName = row['Generic Greige Name']?.trim() || '';
            const yarnCount = row['Yarn Count']?.toString().trim() || '';
            const construction = row['Construction']?.toString().trim() || '';

            // Parse width - handle both string and number formats
            let width = 0;
            const widthValue = row['Greige Width (inches)'];
            if (widthValue !== undefined && widthValue !== null && widthValue !== '') {
              width = parseFloat(String(widthValue).replace(/[^0-9.]/g, ''));
              if (isNaN(width)) width = 0;
            }

            // Parse shrinkage - handle both string and number formats
            let shrinkage = 8.0;
            const shrinkageValue = row['Average Shrinkage %'];
            if (shrinkageValue !== undefined && shrinkageValue !== null && shrinkageValue !== '') {
              shrinkage = parseFloat(String(shrinkageValue).replace(/[^0-9.]/g, ''));
              if (isNaN(shrinkage)) shrinkage = 8.0;
            }

            // Auto-generate greige name
            const greigeName = `${genericName} ${yarnCount} / ${construction} / ${width}"`;

            // Parse default cutable width
            let defaultCutableWidth = undefined;
            const cutableWidthValue = row['Default Cutable Width (inches)'];
            if (cutableWidthValue !== undefined && cutableWidthValue !== null && cutableWidthValue !== '') {
              const parsed = parseFloat(String(cutableWidthValue).replace(/[^0-9.]/g, ''));
              if (!isNaN(parsed)) defaultCutableWidth = parsed;
            }

            // Parse finished widths
            const finishedWidthMin = row['Expected Finished Width Min'];
            const finishedWidthMax = row['Expected Finished Width Max'];

            let parsedFinishedMin = undefined;
            if (finishedWidthMin !== undefined && finishedWidthMin !== null && finishedWidthMin !== '') {
              const parsed = parseFloat(String(finishedWidthMin).replace(/[^0-9.]/g, ''));
              if (!isNaN(parsed)) parsedFinishedMin = parsed;
            }

            let parsedFinishedMax = undefined;
            if (finishedWidthMax !== undefined && finishedWidthMax !== null && finishedWidthMax !== '') {
              const parsed = parseFloat(String(finishedWidthMax).replace(/[^0-9.]/g, ''));
              if (!isNaN(parsed)) parsedFinishedMax = parsed;
            }

            const result = {
              // Note: greigeCode will be auto-generated by backend
              greigeName,
              genericGreigeName: genericName,
              yarnCount,
              construction,
              composition: row['Composition']?.trim() || '',
              weaveType: row['Weave Type']?.trim() || '',
              greigeWidth: width,
              defaultCutableWidth,
              expectedFinishedWidthMin: parsedFinishedMin,
              expectedFinishedWidthMax: parsedFinishedMax,
              averageShrinkagePercent: shrinkage,
              gsmRange: row['GSM Range']?.toString().trim() || '',
              description: row['Description']?.trim() || '',
              notes: row['Notes']?.trim() || '',
              isActive: row['Is Active']?.toString().toUpperCase() === 'TRUE',
              suppliers: [],
            };

            // Debug logging for first row
            if (index === 0) {
              logDebug('First row Excel data:', row);
              logDebug('Parsed greige data:', result);
              logDebug('Width value:', widthValue, '-> Parsed:', width);
              logDebug('Shrinkage value:', shrinkageValue, '-> Parsed:', shrinkage);
            }

            return result;
          });

          // Get auth token
          const authStorage = localStorage.getItem('auth-storage');
          let token = null;
          if (authStorage) {
            const parsed = JSON.parse(authStorage);
            token = parsed.state?.token || null;
          }

          // Send to backend
          const response = await fetch(`${API_URL}/fabric-management/greige/bulk-import`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ greiges: greigeData }),
          });

          const resultData = await response.json();

          if (response.ok) {
            setResult({
              success: resultData.summary.created,
              failed: resultData.summary.failed,
              errors: resultData.errors || [],
            });
          } else {
            throw new Error(resultData.error || 'Import failed');
          }
        } catch (error: unknown) {
          logError('Import error:', error);
          alert(error.message || 'Failed to import greige data');
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
      <PageHeader title="Bulk Import Greige Masters" />

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
                <h4 className="font-medium text-gray-900 mb-2">Step 1: Download Template</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Download the Excel template with the correct format and sample data.
                </p>
                <Button onClick={downloadTemplate} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Step 2: Fill Data</h4>
                <p className="text-sm text-gray-600">
                  Open the template and fill in your greige master data. Required fields:
                </p>
                <ul className="text-sm text-gray-600 list-disc list-inside mt-2 space-y-1">
                  <li>Generic Greige Name (e.g., Cambric, Poplin, Denim)</li>
                  <li>Yarn Count (e.g., 40×40)</li>
                  <li>Construction (e.g., 92×88)</li>
                  <li>Greige Width in inches</li>
                  <li>Composition (e.g., 100% Cotton)</li>
                </ul>
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Greige Code and Greige Name will be auto-generated.
                    <br />
                    Format: GRG-XXXX and "{'{Generic Name} {Yarn Count} / {Construction} / {Width}\"'}"
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Step 3: Upload File</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Upload the completed Excel file to import greige masters.
                </p>
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
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
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
                  <h4 className="font-medium text-gray-900 mb-2">Preview (First 5 rows)</h4>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Generic Name</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Yarn Count</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Construction</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Width</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Composition</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previewData.map((row, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2 text-sm">{row['Generic Greige Name']}</td>
                            <td className="px-3 py-2 text-sm">{row['Yarn Count']}</td>
                            <td className="px-3 py-2 text-sm">{row['Construction']}</td>
                            <td className="px-3 py-2 text-sm">{row['Greige Width (inches)']}"</td>
                            <td className="px-3 py-2 text-sm">{row['Composition']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={handleImport}
                  disabled={!file || importing}
                >
                  {importing ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Greige Masters
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => navigate('/greige')}>
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
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                )}
                Import Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-700">{result.success}</div>
                    <div className="text-sm text-green-600">Successfully Imported</div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-2xl font-bold text-red-700">{result.failed}</div>
                    <div className="text-sm text-red-600">Failed</div>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Errors:</h4>
                    <div className="space-y-2">
                      {result.errors.map((error, index) => (
                        <Alert key={index} variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            Row {error.row}: {error.error}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={() => navigate('/greige')}>
                  Go to Greige Master List
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
