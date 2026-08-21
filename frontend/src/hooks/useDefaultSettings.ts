import { useQuery } from '@tanstack/react-query';
import { getSystemSettingsDefaults } from '../services/system-settings.service';

/**
 * Reads the system default values.
 *
 * There are NO fallback literals in this file, deliberately. Every default is declared once,
 * in backend/src/config/defaults.registry.ts, and served from there. A local `?? 5` here is
 * a second source of truth that silently wins whenever the request is slow or broken — which
 * is exactly what happened before: the defaults endpoint returned a key-mangled map, every
 * lookup was `undefined`, and the whole app quietly ran on these literals for months.
 *
 * Because there is no fallback, a value can be `undefined` until the query resolves.
 * Gate on `isLoading` before using a value you are going to SAVE. For display-only use,
 * render a placeholder while loading rather than substituting a number.
 */
export function useDefaultSettings() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['system-settings', 'defaults'],
    queryFn: getSystemSettingsDefaults,
    staleTime: 10 * 60 * 1000, // 10 min cache
  });

  const byKey = new Map((data ?? []).map((row) => [row.key, row]));

  const num = (key: string): number | undefined => {
    const raw = byKey.get(key)?.value;
    if (raw == null) return undefined;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  return {
    isLoading,
    isError,
    /** All rows, for a settings-style screen. */
    rows: data ?? [],
    /** Raw typed lookup for any registered key. */
    getNumber: num,
    getString: (key: string): string | undefined => byKey.get(key)?.value,

    // Named getters for the values components actually use.
    fabricWastagePercent: num('FABRIC_DEFAULT_WASTAGE_PERCENT'),
    greigeWastagePercent: num('GREIGE_DEFAULT_WASTAGE_PERCENT'),
    trimWastagePercent: num('TRIM_DEFAULT_WASTAGE_PERCENT'),
    laceWastagePercent: num('LACE_DEFAULT_WASTAGE_PERCENT'),
    labelExtraPercent: num('LABEL_DEFAULT_EXTRA_PERCENT'),
    /** Selvedge deduction in INCHES: finished − deduction = cutable; cutable + deduction = width to ask for. */
    cutableWidthDeduction: num('GREIGE_CUTABLE_WIDTH_DEDUCTION_CM'),
    stockAgingThresholdDays: num('STOCK_AGING_THRESHOLD_DAYS'),
    kaajButtonholeRate: num('KAAJ_BUTTONHOLE_RATE_PER_UNIT'),
    kaajButtonRate: num('KAAJ_BUTTON_RATE_PER_UNIT'),
  };
}
