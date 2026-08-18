import { useQuery } from '@tanstack/react-query';
import { getSystemSettingsDefaults } from '../services/system-settings.service';

export function useDefaultSettings() {
  const { data } = useQuery({
    queryKey: ['system-settings', 'defaults'],
    queryFn: getSystemSettingsDefaults,
    staleTime: 10 * 60 * 1000, // 10 min cache
  });

  return {
    fabricWastagePercent:
      data?.FABRIC_DEFAULT_WASTAGE_PERCENT != null ? Number(data.FABRIC_DEFAULT_WASTAGE_PERCENT) : 0,
    greigeWastagePercent:
      data?.GREIGE_DEFAULT_WASTAGE_PERCENT != null ? Number(data.GREIGE_DEFAULT_WASTAGE_PERCENT) : 0,
    laceWastagePercent: data?.LACE_DEFAULT_WASTAGE_PERCENT != null ? Number(data.LACE_DEFAULT_WASTAGE_PERCENT) : 5,
    labelExtraPercent: data?.LABEL_DEFAULT_EXTRA_PERCENT != null ? Number(data.LABEL_DEFAULT_EXTRA_PERCENT) : 5,
    /** Selvedge deduction in INCHES: finished − deduction = cutable; asked finished = cutable + deduction. */
    cutableWidthDeduction:
      data?.GREIGE_CUTABLE_WIDTH_DEDUCTION_CM != null ? Number(data.GREIGE_CUTABLE_WIDTH_DEDUCTION_CM) : 2,
  };
}
