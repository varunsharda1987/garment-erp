/**
 * IRP (Invoice Registration Portal) provider abstraction.
 *
 * The payload builder speaks only the standard INV-01 JSON schema; how it is
 * transported (NIC direct crypto envelope, GSP REST wrapper, IRIS IRP, ...) is
 * a provider concern. Only the NIC adapter exists today.
 */

import { EInvoiceSettings } from '../einvoice-settings.service';
import { NicIrpProvider } from './nic-irp-provider';
import type { Inv01Payload } from './einvoice-payload.builder';

export interface IrnResult {
  irn: string;
  ackNo: string;
  ackDt: string; // IRP format: yyyy-MM-dd HH:mm:ss
  signedInvoice?: string;
  signedQrCode: string;
  status: string;
}

export interface CancelResult {
  irn: string;
  cancelDate: string;
}

export interface TestAuthResult {
  ok: boolean;
  tokenExpiry?: string;
  message: string;
}

export interface IrpProvider {
  testAuth(): Promise<TestAuthResult>;
  generateIrn(payload: Inv01Payload): Promise<IrnResult>;
  cancelIrn(irn: string, reason: string, remarks: string): Promise<CancelResult>;
  getIrnDetails(irn: string): Promise<IrnResult | null>;
}

export function getIrpProvider(settings: EInvoiceSettings): IrpProvider {
  switch (settings.einvProvider) {
    case 'NIC':
      return new NicIrpProvider(settings);
    default:
      throw new Error(`Unknown e-Invoice provider "${settings.einvProvider}". Supported: NIC.`);
  }
}
