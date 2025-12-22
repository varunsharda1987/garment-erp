import { useEffect, useState } from 'react';
import type { State } from '../types/location.types';

interface StateSelectorProps {
  value: string | null | undefined;
  onChange: (stateId: string | null) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showStateCode?: boolean;
  stateType?: 'STATE' | 'UNION_TERRITORY' | 'ALL';
}

export default function StateSelector({
  value,
  onChange,
  error,
  label = 'State',
  placeholder = 'Select a state',
  required = false,
  disabled = false,
  className = '',
  showStateCode = true,
  stateType = 'ALL',
}: StateSelectorProps) {
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchStates();
  }, [stateType]);

  const fetchStates = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const params = new URLSearchParams();
      if (stateType !== 'ALL') {
        params.append('stateType', stateType);
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/locations/states?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch states');
      }

      const result = await response.json();
      setStates(result.data || []);
    } catch (err) {
      console.error('Error fetching states:', err);
      setLoadError('Failed to load states');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    onChange(selectedValue || null);
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <select
        value={value || ''}
        onChange={handleChange}
        disabled={disabled || loading}
        className={`
          w-full px-3 py-2 border rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : 'border-gray-300'}
        `}
      >
        <option value="">
          {loading ? 'Loading states...' : placeholder}
        </option>
        {states.map((state) => (
          <option key={state.id} value={state.id}>
            {state.stateName}
            {showStateCode && ` (${state.stateCode})`}
          </option>
        ))}
      </select>

      {loadError && (
        <p className="mt-1 text-sm text-orange-600">{loadError}</p>
      )}

      {error && !loadError && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
