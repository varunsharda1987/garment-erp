import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  const [previewData, setPreviewData] = useState<any[]>([]);

  const downloadTemplate = () => {
    const template = [
      {
        'Greige Code': 'GRG-0001',
        'Generic Fabric Name': 'Cambric',
        'Fabric Name': 'Cambric 58" - White',
        'Color Name': 'White',
        'Color Code': '#FFFFFF',
        'Finish Type': 'Mercerized',
        'Print Design': '',
        'Actual Width (inches)': 58,
        'Cutable Width (inches)': 56,
        'Finished Construction': '40×40/133×72',
        'Actual GSM': 120,
        'Value Addition': 'Embroidery',
        'Value Addition Cost': 15.50,
        'Style Reference': '',
        'Component Type': '',
        'Description': 'High quality cambric fabric',
        'Notes': '',
        'Is Generic': 'TRUE',
        'Is Active': 'TRUE',
      },
      {
        'Greige Code': 'GRG-0002',
        'Generic Fabric Name': 'Poplin',
        'Fabric Name': 'STY-001 - BODY - Poplin 60" - Blue',
        'Color Name': 'Sky Blue',
        'Color Code': '#87CEEB',
        'Finish Type': 'Soft Finish',
        'Print Design': '',
        'Actual Width (inches)': 60,
        'Cutable Width (inches)': 58,
        'Finished Construction': '40×40/120×60',
        'Actual GSM': 115,
        'Value Addition': '',
        'Value Addition Cost': '',
        'Style Reference': 'STY-001',
        'Component Type': 'BODY',
        'Description': 'Style-specific poplin',
        'Notes': '',
        'Is Generic': 'FALSE',
        'Is Active': 'TRUE',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fabric Template');

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Greige Code
      { wch: 20 }, // Generic Fabric Name
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
      { wch: 15 }, // Component Type
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setPreviewData(jsonData.slice(0, 5)); // Show first 5 rows
      } catch (error) {
        console.error('Error reading file:', error);
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
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Transform Excel data to API format
          const fabricData = jsonData.map((row: any, index: number) => {
            // Parse numeric values
            const parseNumber = (value: any, defaultValue: any = undefined) => {
              if (value === undefined || value === null || value === '') return defaultValue;
              const parsed = parseFloat(String(value).replace(/[^0-9.]/g, ''));
              return isNaN(parsed) ? defaultValue : parsed;
            };

            const actualWidth = parseNumber(row['Actual Width (inches)'], 58);
            const cutableWidth = parseNumber(
              row['Cutable Width (inches)'],
              actualWidth ? actualWidth - 2 : undefined
            );

            const result = {
              // Note: fabricCode will be auto-generated by backend
              fabricName: row['Fabric Name']?.trim() || '',
              greigeCode: row['Greige Code']?.trim() || '',
              genericFabricName: row['Generic Fabric Name']?.trim() || '',
              colorName: row['Color Name']?.trim() || '',
              colorCode: row['Color Code']?.trim() || '',
              finishType: row['Finish Type']?.trim() || '',
              printDesign: row['Print Design']?.trim() || '',
              actualWidth,
              cutableWidth,
              finishedConstruction: row['Finished Construction']?.trim() || '',
              actualGSM: parseNumber(row['Actual GSM']),
              valueAddition: row['Value Addition']?.trim() || '',
              valueAdditionCost: parseNumber(row['Value Addition Cost']),
              styleReference: row['Style Reference']?.trim() || '',
              componentType: row['Component Type']?.trim() || '',
              description: row['Description']?.trim() || '',
              notes: row['Notes']?.trim() || '',
              isGeneric: row['Is Generic']?.toString().toUpperCase() === 'TRUE',
              isActive: row['Is Active']?.toString().toUpperCase() === 'TRUE',
              suppliers: [],
            };

            // Debug logging for first row
            if (index === 0) {
              console.log('First row Excel data:', row);
              console.log('Parsed fabric data:', result);
            }

            return result;
          });

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
          const response = await fetch(
            `${import.meta.env.VITE_API_URL}/api/fabric-management/fabric/bulk-import`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ fabrics: fabricData }),
            }
          );

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
        } catch (error: any) {
          console.error('Import error:', error);
          alert(error.message || 'Failed to import fabrics. Please try again.');
        } finally {
          setImporting(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error('File reading error:', error);
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
                <li>Optional fields: Cutable Width (auto-calculated if empty), Value Addition fields, Style Reference, Component Type</li>
                <li>For generic fabrics: Set "Is Generic" to TRUE and leave Style Reference empty</li>
                <li>For style-specific fabrics: Set "Is Generic" to FALSE and provide Style Reference and Component Type</li>
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
            <p className="text-sm text-gray-600 mt-2">
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
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-sm text-gray-600 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">Excel files (.xlsx, .xls)</p>
                </label>
              </div>

              {file && (
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-900">{file.name}</span>
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
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Greige Code</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Generic Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Fabric Name</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Color</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Width</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Construction</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Generic?</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.map((row: any, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Greige Code']}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Generic Fabric Name']}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Fabric Name']}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Color Name']}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Actual Width (inches)']}"</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Finished Construction']}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">{row['Is Generic']}</td>
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
              <Button
                onClick={handleImport}
                disabled={importing}
                className="w-full"
              >
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
                  <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Successfully Imported</p>
                      <p className="text-2xl font-bold text-green-600">{result.success}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-4 bg-red-50 rounded-lg">
                    <XCircle className="h-6 w-6 text-red-600" />
                    <div>
                      <p className="text-sm text-gray-600">Failed</p>
                      <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                    </div>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Errors:</h4>
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
                  <Button onClick={() => navigate('/fabric')}>
                    View Imported Fabrics
                  </Button>
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
