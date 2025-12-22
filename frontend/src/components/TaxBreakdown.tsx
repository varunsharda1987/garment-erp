interface TaxBreakdownProps {
  subtotal: number;
  cgst?: number | null;
  sgst?: number | null;
  igst?: number | null;
  cgstRate?: number | null;
  sgstRate?: number | null;
  igstRate?: number | null;
  isInterstate: boolean;
  total: number;
  className?: string;
  showRates?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function TaxBreakdown({
  subtotal,
  cgst = 0,
  sgst = 0,
  igst = 0,
  cgstRate,
  sgstRate,
  igstRate,
  isInterstate,
  total,
  className = '',
  showRates = true,
  size = 'md',
}: TaxBreakdownProps) {
  const totalTax = (cgst || 0) + (sgst || 0) + (igst || 0);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs';
      case 'lg':
        return 'text-base';
      default:
        return 'text-sm';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatRate = (rate?: number | null) => {
    return rate ? `(${rate}%)` : '';
  };

  return (
    <div className={`border border-gray-200 rounded-lg bg-gray-50 p-4 ${className}`}>
      <h3 className={`font-semibold text-gray-900 mb-3 ${size === 'lg' ? 'text-lg' : 'text-base'}`}>
        Tax Breakdown
      </h3>

      <div className={`space-y-2 ${getSizeClasses()}`}>
        {/* Subtotal */}
        <div className="flex justify-between text-gray-700">
          <span>Subtotal:</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>

        {/* Tax Type Indicator */}
        <div className="flex items-center gap-2 py-1">
          <span className="text-gray-600">Tax Type:</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              isInterstate
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {isInterstate ? 'Interstate (IGST)' : 'Intrastate (CGST + SGST)'}
          </span>
        </div>

        {/* Tax Components */}
        {isInterstate ? (
          <div className="flex justify-between text-gray-700">
            <span>
              IGST {showRates && formatRate(igstRate)}:
            </span>
            <span className="font-medium">{formatCurrency(igst || 0)}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-gray-700">
              <span>
                CGST {showRates && formatRate(cgstRate)}:
              </span>
              <span className="font-medium">{formatCurrency(cgst || 0)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>
                SGST {showRates && formatRate(sgstRate)}:
              </span>
              <span className="font-medium">{formatCurrency(sgst || 0)}</span>
            </div>
          </>
        )}

        {/* Total Tax */}
        <div className="flex justify-between text-gray-900 font-semibold pt-2 border-t border-gray-300">
          <span>Total Tax:</span>
          <span>{formatCurrency(totalTax)}</span>
        </div>

        {/* Grand Total */}
        <div className="flex justify-between text-gray-900 font-bold pt-2 border-t-2 border-gray-400">
          <span>Grand Total:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Information Note */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className={`text-gray-600 ${size === 'sm' ? 'text-xs' : 'text-xs'}`}>
          {isInterstate ? (
            <>
              <strong>Interstate Transaction:</strong> IGST is applicable as the supply is between different states.
            </>
          ) : (
            <>
              <strong>Intrastate Transaction:</strong> CGST and SGST are applicable as the supply is within the same state.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// Compact version for tables and lists
interface TaxBreakdownCompactProps {
  cgst?: number | null;
  sgst?: number | null;
  igst?: number | null;
  isInterstate: boolean;
  className?: string;
}

export function TaxBreakdownCompact({
  cgst = 0,
  sgst = 0,
  igst = 0,
  isInterstate,
  className = '',
}: TaxBreakdownCompactProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className={`text-xs ${className}`}>
      {isInterstate ? (
        <div className="text-gray-600">
          IGST: <span className="font-medium text-gray-900">{formatCurrency(igst || 0)}</span>
        </div>
      ) : (
        <div className="space-y-0.5 text-gray-600">
          <div>
            CGST: <span className="font-medium text-gray-900">{formatCurrency(cgst || 0)}</span>
          </div>
          <div>
            SGST: <span className="font-medium text-gray-900">{formatCurrency(sgst || 0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
