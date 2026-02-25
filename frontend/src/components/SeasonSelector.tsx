/**
 * SeasonSelector Component
 * A searchable dropdown for selecting seasons from the season_master table
 */
import { useEffect, useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Calendar } from 'lucide-react';
import { searchSeasons } from '@/services/season.service';
import type { SeasonSearchResult } from '@/types/season.types';
import { formatSeasonDisplay } from '@/types/season.types';

interface SeasonSelectorProps {
  value: string | null | undefined;
  onChange: (seasonId: string | null, season?: SeasonSearchResult) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
}

export default function SeasonSelector({
  value,
  onChange,
  error,
  label = 'Season',
  placeholder = 'Select a season',
  required = false,
  disabled = false,
  className = '',
  showLabel = true,
}: SeasonSelectorProps) {
  const [seasons, setSeasons] = useState<SeasonSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch seasons on mount and when search changes
  useEffect(() => {
    fetchSeasons();
  }, []);

  const fetchSeasons = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await searchSeasons({ limit: 100 });
      setSeasons(data);
    } catch (err) {
      console.error('Error fetching seasons:', err);
      setLoadError('Failed to load seasons');
    } finally {
      setLoading(false);
    }
  };

  // Filter seasons based on search term
  const filteredSeasons = useMemo(() => {
    if (!searchTerm) return seasons;
    const term = searchTerm.toLowerCase();
    return seasons.filter(
      (s) =>
        s.code.toLowerCase().includes(term) ||
        s.name.toLowerCase().includes(term) ||
        s.year.toString().includes(term)
    );
  }, [seasons, searchTerm]);

  // Group seasons by year for better UX
  const groupedSeasons = useMemo(() => {
    const groups: Record<number, SeasonSearchResult[]> = {};
    filteredSeasons.forEach((season) => {
      if (!groups[season.year]) {
        groups[season.year] = [];
      }
      groups[season.year].push(season);
    });
    // Sort years in descending order (newest first)
    return Object.entries(groups)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([year, items]) => ({
        year: Number(year),
        seasons: items.sort((a, _b) => (a.seasonType === 'SS' ? -1 : 1)),
      }));
  }, [filteredSeasons]);

  // Find selected season for display
  const selectedSeason = useMemo(() => {
    if (!value) return null;
    return seasons.find((s) => s.id === value);
  }, [value, seasons]);

  const handleValueChange = (newValue: string) => {
    if (newValue === '__clear__') {
      onChange(null);
    } else {
      const season = seasons.find((s) => s.id === newValue);
      onChange(newValue, season);
    }
    setSearchTerm('');
  };

  return (
    <div className={className}>
      {showLabel && label && (
        <Label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      <Select
        value={value || undefined}
        onValueChange={handleValueChange}
        disabled={disabled || loading}
      >
        <SelectTrigger
          className={`w-full ${error ? 'border-red-500' : ''}`}
        >
          <SelectValue placeholder={loading ? 'Loading...' : placeholder}>
            {selectedSeason ? (
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {formatSeasonDisplay(selectedSeason)}
              </span>
            ) : (
              placeholder
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Search input inside dropdown */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search seasons..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {loading && (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Loading seasons...
            </div>
          )}

          {loadError && (
            <div className="p-4 text-center text-red-500">{loadError}</div>
          )}

          {!loading && !loadError && filteredSeasons.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? 'No seasons found' : 'No seasons available'}
            </div>
          )}

          {/* Clear option */}
          {value && !loading && (
            <SelectItem value="__clear__" className="text-muted-foreground italic">
              Clear selection
            </SelectItem>
          )}

          {/* Grouped seasons by year */}
          {groupedSeasons.map(({ year, seasons: yearSeasons }) => (
            <SelectGroup key={year}>
              <SelectLabel className="font-semibold text-xs uppercase tracking-wide text-muted-foreground px-2 py-1.5">
                {year}
              </SelectLabel>
              {yearSeasons.map((season) => (
                <SelectItem key={season.id} value={season.id}>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                      season.seasonType === 'SS'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {season.code}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// Simple variant without search (for smaller forms)
export function SeasonSelectorSimple({
  value,
  onChange,
  error,
  label = 'Season',
  placeholder = 'Select a season',
  required = false,
  disabled = false,
  className = '',
  showLabel = true,
}: SeasonSelectorProps) {
  const [seasons, setSeasons] = useState<SeasonSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSeasons = async () => {
      try {
        setLoading(true);
        const data = await searchSeasons({ limit: 100 });
        setSeasons(data);
      } catch (err) {
        console.error('Error fetching seasons:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSeasons();
  }, []);

  const handleValueChange = (newValue: string) => {
    if (newValue === '__none__') {
      onChange(null);
    } else {
      const season = seasons.find((s) => s.id === newValue);
      onChange(newValue, season);
    }
  };

  return (
    <div className={className}>
      {showLabel && label && (
        <Label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      <Select
        value={value || undefined}
        onValueChange={handleValueChange}
        disabled={disabled || loading}
      >
        <SelectTrigger className={`w-full ${error ? 'border-red-500' : ''}`}>
          <SelectValue placeholder={loading ? 'Loading...' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground">None</span>
          </SelectItem>
          {seasons.map((season) => (
            <SelectItem key={season.id} value={season.id}>
              {formatSeasonDisplay(season)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
