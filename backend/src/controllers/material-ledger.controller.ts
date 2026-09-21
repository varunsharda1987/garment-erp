/**
 * Material Ledger endpoint — GET /api/materials/:id/ledger
 *
 * JSON for the screen; `?format=pdf` for the printable copy.
 */
import { Request, Response } from 'express';
import { getMaterialLedger, MaterialNotFoundError } from '../services/material-ledger.service';
import { documentFacadeService } from '../services/document-facade.service';
import type { MaterialLedgerQueryInput } from '../schemas/materialLedger.schema';

function sendReportPdf(res: Response, pdf: Buffer, filename: string): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', pdf.length);
  res.send(pdf);
}

export async function getMaterialLedgerHandler(req: Request, res: Response) {
  const { id } = req.params;
  // Zod's coerced Dates live only on validatedQuery — req.query re-parses the URL as raw strings
  // under Express 5 (see validation.middleware.ts).
  const query = ((req as Request & { validatedQuery?: unknown }).validatedQuery ?? {}) as MaterialLedgerQueryInput;
  const filters = { from: query.from, to: query.to, warehouseId: query.warehouseId };

  try {
    const ledger = await getMaterialLedger(id, filters);

    if (query.format === 'pdf') {
      const pdf = await documentFacadeService.generateMaterialLedgerPDF(id, filters);
      return sendReportPdf(res, pdf, `MaterialLedger-${ledger.material.code}.pdf`);
    }

    res.json({ success: true, data: ledger });
  } catch (error) {
    if (error instanceof MaterialNotFoundError) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }
    console.error('Material ledger error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to build the material ledger',
    });
  }
}
