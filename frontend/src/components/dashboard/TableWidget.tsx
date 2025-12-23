/**
 * TableWidget Component
 * Mini-table widget for dashboard summaries
 */

import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Column<T> {
  key: keyof T | string;
  label: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T) => ReactNode;
}

interface TableWidgetProps<T> {
  title: string;
  description?: string;
  columns: Column<T>[];
  data: T[];
  maxRows?: number;
  viewAllPath?: string;
  viewAllLabel?: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
}

/**
 * Dashboard table widget for displaying lists
 *
 * @example
 * <TableWidget
 *   title="Recent Orders"
 *   columns={[
 *     { key: 'orderNumber', label: 'Order #' },
 *     { key: 'customer', label: 'Customer' },
 *     { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
 *   ]}
 *   data={orders}
 *   viewAllPath="/orders"
 * />
 */
export function TableWidget<T extends Record<string, unknown>>({
  title,
  description,
  columns,
  data,
  maxRows = 5,
  viewAllPath,
  viewAllLabel = 'View All',
  onRowClick,
  emptyMessage = 'No data available',
  isLoading = false,
}: TableWidgetProps<T>) {
  const navigate = useNavigate();
  const displayData = data.slice(0, maxRows);

  const getCellValue = (row: T, column: Column<T>): ReactNode => {
    const value = row[column.key as keyof T];
    if (column.render) {
      return column.render(value, row);
    }
    return String(value ?? '-');
  };

  const getAlignment = (align?: string) => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <p className="text-sm text-gray-500">{description}</p>}
        </div>
        {viewAllPath && data.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(viewAllPath)}
            className="text-indigo-600 hover:text-indigo-700"
          >
            {viewAllLabel}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : displayData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">{emptyMessage}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={String(column.key)}
                    className={getAlignment(column.align)}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((row, index) => (
                <TableRow
                  key={index}
                  className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={String(column.key)}
                      className={getAlignment(column.align)}
                    >
                      {getCellValue(row, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data.length > maxRows && (
          <p className="text-sm text-gray-500 mt-2 text-center">
            Showing {maxRows} of {data.length} items
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default TableWidget;
