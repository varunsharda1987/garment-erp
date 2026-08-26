// DEPRECATED: This page is replaced by Stock In with Greige pre-selected
// Redirects to /inventory/stock-in?materialType=GREIGE
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GreigeStockEntry() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to Stock In with Greige pre-selected
    navigate('/inventory/movements/stock-in?materialType=GREIGE', { replace: true });
  }, [navigate]);

  // Show brief loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Stock In...</p>
      </div>
    </div>
  );
}
