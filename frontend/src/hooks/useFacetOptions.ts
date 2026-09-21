/**
 * Facet options for the Greige / Fabric list filter bars.
 *
 * One call per page fills every dropdown with the values that ACTUALLY exist in the table, plus
 * the min/max bounds of the numeric columns. Counts come back with each value so an option can
 * read "Printing (42)".
 *
 * Deliberately not sourced from /greige/generic-names or /fabric/generic-names: the fabric one
 * merges in names regex-derived from greige_master.greigeName, which frequently do not exist in
 * fabric_master — ticking one would return zero rows.
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { greigeService, fabricService } from '@/services/fabricGreigeService';
import type {
  FabricFacetOptions,
  GreigeFacetOptions,
  FacetOption,
  MultiSelectFacetOption,
} from '@/types/fabric-greige.types';

/** Option lists change only when master data is added — no need to refetch them on every mount. */
const FACET_STALE_TIME = 5 * 60 * 1000;

export function useGreigeFacets(isActive: string) {
  return useQuery<GreigeFacetOptions, Error>({
    queryKey: queryKeys.greige.facets(isActive),
    queryFn: () => greigeService.getFacets(isActive),
    staleTime: FACET_STALE_TIME,
  });
}

export function useFabricFacets(isActive: string) {
  return useQuery<FabricFacetOptions, Error>({
    queryKey: queryKeys.fabrics.facets(isActive),
    queryFn: () => fabricService.getFacets(isActive),
    staleTime: FACET_STALE_TIME,
  });
}

/**
 * Turn a facet list into MultiSelect options, optionally relabelling enum values for display.
 * `labels` maps a raw DB value to what the user should read ('SUPER_DYEING' -> 'Super Dyeing');
 * anything unmapped keeps its own value as the label, which is right for free text.
 */
export function toFacetOptions(
  facet: FacetOption[] | undefined,
  labels?: Record<string, string>
): MultiSelectFacetOption[] {
  return (facet ?? []).map((o) => ({
    value: o.value,
    label: labels?.[o.value] ?? o.value,
    count: o.count,
  }));
}
