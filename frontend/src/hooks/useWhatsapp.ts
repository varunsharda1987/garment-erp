import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { whatsappService, type WhatsAppStatus } from '@/services/whatsapp.service';

const STATUS_KEY = ['whatsapp', 'status'] as const;

/**
 * Poll the logged-in user's WhatsApp link status. Polls fast (2s) while linking (QR/finishing
 * sign-in) so the QR + "linked" transition feels live, and slowly (15s) once settled.
 */
export function useWhatsappStatus() {
  return useQuery<WhatsAppStatus>({
    queryKey: STATUS_KEY,
    queryFn: whatsappService.getStatus,
    refetchInterval: (query) => {
      const s = query.state.data?.state;
      if (s === 'qr' || s === 'initializing' || s === 'authenticated') return 2000;
      return 15000;
    },
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

export function useWhatsappConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: whatsappService.connect,
    onSuccess: (data) => {
      qc.setQueryData(STATUS_KEY, data);
      qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
  });
}

export function useWhatsappDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: whatsappService.disconnect,
    onSuccess: (data) => {
      qc.setQueryData(STATUS_KEY, data);
      qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
  });
}
