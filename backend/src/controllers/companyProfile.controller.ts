import { Request, Response } from 'express';
import { companyProfileService } from '../services/company-profile.service';
import { ValidationError } from '../errors';
import type { CreateCompanyProfileInput, UpdateCompanyProfileInput } from '../schemas/companyProfile.schema';

export class CompanyProfileController {
  /** GET /api/company-profiles */
  async getAll(_req: Request, res: Response) {
    const profiles = await companyProfileService.list();
    res.json({ data: profiles });
  }

  /**
   * GET /api/company-profiles/default
   * Open to any authenticated user: PO screens and letterheads need it, and gating it to
   * admins would make every non-admin's letterhead fall back forever.
   */
  async getDefault(_req: Request, res: Response) {
    const profile = await companyProfileService.getDefaultRow();
    res.json({ data: profile });
  }

  /** GET /api/company-profiles/:id */
  async getById(req: Request, res: Response) {
    const profile = await companyProfileService.getById(req.params.id);
    res.json({ data: profile });
  }

  /** POST /api/company-profiles */
  async create(req: Request, res: Response) {
    const profile = await companyProfileService.create(req.body as CreateCompanyProfileInput);
    res.status(201).json({ data: profile });
  }

  /** PUT /api/company-profiles/:id */
  async update(req: Request, res: Response) {
    const profile = await companyProfileService.update(req.params.id, req.body as UpdateCompanyProfileInput);
    res.json({ data: profile });
  }

  /** POST /api/company-profiles/:id/set-default */
  async setDefault(req: Request, res: Response) {
    const profile = await companyProfileService.setDefault(req.params.id);
    res.json({ data: profile });
  }

  /** POST /api/company-profiles/:id/logo */
  async uploadLogo(req: Request, res: Response) {
    const profile = await this.storeAsset(req, 'logoUrl');
    res.json({ data: profile });
  }

  /** POST /api/company-profiles/:id/signature */
  async uploadSignature(req: Request, res: Response) {
    const profile = await this.storeAsset(req, 'signatureUrl');
    res.json({ data: profile });
  }

  private async storeAsset(req: Request, field: 'logoUrl' | 'signatureUrl') {
    if (!req.file) {
      throw new ValidationError('No image was uploaded');
    }
    // Confirms the entity exists before the URL is written.
    await companyProfileService.getById(req.params.id);
    return companyProfileService.setAssetUrl(req.params.id, field, `/uploads/company/${req.file.filename}`);
  }
}

export const companyProfileController = new CompanyProfileController();
