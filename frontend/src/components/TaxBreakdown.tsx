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
    <div className={`border border-border rounded-lg bg-muted p-4 ${className}`}>
      <h3 className={`font-semibold text-foreground mb-3 ${size === 'lg' ? 'text-lg' : 'text-base'}`}>Tax Breakdown</h3>

      <div className={`space-y-2 ${getSizeClasses()}`}>
        {/* Subtotal */}
        <div className="flex justify-between text-foreground">
          <span>Subtotal:</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>

        {/* Tax Type Indicator */}
        <div className="flex items-center gap-2 py-1">
          <span className="text-muted-foreground">Tax Type:</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              isInterstate ? 'bg-info-muted text-info' : 'bg-success-muted text-success'
            }`}
          >
            {isInterstate ? 'Interstate (IGST)' : 'Intrastate (CGST + SGST)'}
          </span>
        </div>

        {/* Tax Components */}
        {isInterstate ? (
          <div className="flex justify-between text-foreground">
            <span>IGST {showRates && formatRate(igstRate)}:</span>
            <span className="font-medium">{formatCurrency(igst || 0)}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-foreground">
              <span>CGST {showRates && formatRate(cgstRate)}:</span>
              <span className="font-medium">{formatCurrency(cgst || 0)}</span>
            </div>
            <div className="flex justify-between text-foreground">
              <span>SGST {showRates && formatRate(sgstRate)}:</span>
              <span className="font-medium">{formatCurrency(sgst || 0)}</span>
            </div>
          </>
        )}

        {/* Total Tax */}
        <div className="flex justify-between text-foreground font-semibold pt-2 border-t border-border">
          <span>Total Tax:</span>
          <span>{formatCurrency(totalTax)}</span>
        </div>

        {/* Grand Total */}
        <div className="flex justify-between text-foreground font-bold pt-2 border-t-2 border-gray-400">
          <span>Grand Total:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Information Note */}
      <div className="mt-3 pt-3 border-t border-border">
        <p className={`text-muted-foreground ${size === 'sm' ? 'text-xs' : 'text-xs'}`}>
          {isInterstate ? (
            <>
              <strong>Interstate Transaction:</strong> IGST is applicable as the supply is between different states.
            </>
          ) : (
            <>
              <strong>Intrastate Transaction:</strong> CGST and SGST are applicable as the supply is within the same
              state.
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
        <div className="text-muted-foreground">
          IGST: <span className="font-medium text-foreground">{formatCurrency(igst || 0)}</span>
        </div>
      ) : (
        <div className="space-y-0.5 text-muted-foreground">
          <div>
            CGST: <span className="font-medium text-foreground">{formatCurrency(cgst || 0)}</span>
          </div>
          <div>
            SGST: <span className="font-medium text-foreground">{formatCurrency(sgst || 0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
