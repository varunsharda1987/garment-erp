/**
 * ExportButton Component
 *
 * Dropdown button for exporting data in various formats (CSV, Excel, PDF).
 * Uses the unified Button component and DropdownMenu for consistent styling.
 */
import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import exportService from '../services/export.service';
import { notify } from '../lib/notify';
import type { ExportButtonProps } from '../types/export.types';
import { logError } from '../lib/logger';

const ExportButton: React.FC<ExportButtonProps> = ({
  module,
  filters = {},
  disabled = false,
  className = '',
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setIsExporting(true);

    try {
      await exportService.exportData(module, { format, filters });
      notify.success(`Exported as ${format.toUpperCase()} successfully`);
    } catch (err: unknown) {
      logError('Export failed:', err);
      const message = err instanceof Error ? err.message : 'Export failed';
      notify.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled || isExporting}
          className={className}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export
              <ChevronDown className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportButton;
