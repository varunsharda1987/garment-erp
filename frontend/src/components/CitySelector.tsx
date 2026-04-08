import { useEffect, useState } from 'react';
import type { City } from '../types/location.types';

interface CitySelectorProps {
  value: string | null | undefined;
  stateId: string | null | undefined;
  onChange: (cityId: string | null) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showTier?: boolean;
  allowSearch?: boolean;
}

export default function CitySelector({
  value,
  stateId,
  onChange,
  error,
  label = 'City',
  placeholder = 'Select a city',
  required = false,
  disabled = false,
  className = '',
  showTier = false,
  allowSearch = false,
}: CitySelectorProps) {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (stateId) {
      fetchCities();
    } else {
      setCities([]);
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateId]);

  useEffect(() => {
    if (allowSearch && searchTerm) {
      const timeoutId = setTimeout(() => {
        fetchCities();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (stateId) {
      fetchCities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const fetchCities = async () => {
    if (!stateId && !searchTerm) return;

    try {
      setLoading(true);
      setLoadError(null);

      const params = new URLSearchParams();
      if (stateId) {
        params.append('stateId', stateId);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/locations/cities?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch cities');
      }

      const result = await response.json();
      setCities(result.data || []);
    } catch (err) {
      console.error('Error fetching cities:', err);
      setLoadError('Failed to load cities');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    onChange(selectedValue || null);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const formatCityOption = (city: City) => {
    let display = city.cityName;
    if (showTier) {
      const tierLabel = city.tier.replace('TIER_', 'T');
      display += ` (${tierLabel})`;
    }
    if (city.state && !stateId) {
      display += ` - ${city.state.stateName}`;
    }
    return display;
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-foreground mb-1">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      {allowSearch && (
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search cities..."
          className="w-full px-3 py-2 mb-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      <select
        value={value || ''}
        onChange={handleChange}
        disabled={disabled || loading || (!stateId && !searchTerm)}
        className={`
          w-full px-3 py-2 border rounded-md shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500
          disabled:bg-muted disabled:cursor-not-allowed
          ${error ? 'border-destructive' : 'border-border'}
        `}
      >
        <option value="">
          {loading ? 'Loading cities...' : !stateId && !searchTerm ? 'Select a state first' : placeholder}
        </option>
        {cities.map((city) => (
          <option key={city.id} value={city.id}>
            {formatCityOption(city)}
          </option>
        ))}
      </select>

      {loadError && <p className="mt-1 text-sm text-primary">{loadError}</p>}

      {error && !loadError && <p className="mt-1 text-sm text-destructive">{error}</p>}

      {cities.length === 0 && !loading && stateId && (
        <p className="mt-1 text-sm text-muted-foreground">No cities found for selected state</p>
      )}
    </div>
  );
}
