import { Request, Response } from 'express';
import { customerContactService } from '../services/customerContact.service';
import { NotFoundError } from '../errors';

export class CustomerContactController {
  /**
   * Get all contacts for a customer
   * GET /api/customer-contacts/customer/:customerId
   */
  async getByCustomerId(req: Request, res: Response) {
    const { customerId } = req.params;
    const { isActive } = req.query;

    const contacts = await customerContactService.getByCustomerId(customerId, {
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    res.json({ data: contacts });
  }

  /**
   * Get contact by ID
   * GET /api/customer-contacts/:id
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const contact = await customerContactService.getById(id);

    if (!contact) {
      throw new NotFoundError('Customer contact', id);
    }

    res.json({ data: contact });
  }

  /**
   * Create new contact
   * POST /api/customer-contacts
   */
  async create(req: Request, res: Response) {
    const contact = await customerContactService.create(req.body);

    res.status(201).json({
      data: contact,
      message: 'Contact created successfully',
    });
  }

  /**
   * Update contact
   * PUT /api/customer-contacts/:id
   */
  async update(req: Request, res: Response) {
    const { id } = req.params;

    const contact = await customerContactService.update(id, req.body);

    if (!contact) {
      throw new NotFoundError('Customer contact', id);
    }

    res.json({
      data: contact,
      message: 'Contact updated successfully',
    });
  }

  /**
   * Delete contact
   * DELETE /api/customer-contacts/:id
   */
  async delete(req: Request, res: Response) {
    const { id } = req.params;

    const existing = await customerContactService.getById(id);
    if (!existing) {
      throw new NotFoundError('Customer contact', id);
    }

    await customerContactService.delete(id);

    res.json({ message: 'Contact deleted successfully' });
  }

  /**
   * Set contact as primary
   * PUT /api/customer-contacts/:id/set-primary
   */
  async setPrimary(req: Request, res: Response) {
    const { id } = req.params;

    const contact = await customerContactService.setPrimary(id);

    if (!contact) {
      throw new NotFoundError('Customer contact', id);
    }

    res.json({
      data: contact,
      message: 'Contact set as primary successfully',
    });
  }
}

export const customerContactController = new CustomerContactController();
