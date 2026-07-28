import { Request, Response } from 'express';
import { customerAddressService } from '../services/customerAddress.service';
import { NotFoundError } from '../errors';
import { CustomerAddressType } from '@prisma/client';

export class CustomerAddressController {
  /**
   * Get all addresses for a customer
   * GET /api/customer-addresses/customer/:customerId
   */
  async getByCustomerId(req: Request, res: Response) {
    const { customerId } = req.params;
    const { addressType, isActive } = req.query;

    const addresses = await customerAddressService.getByCustomerId(customerId, {
      addressType: addressType as CustomerAddressType | undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    res.json({ data: addresses });
  }

  /**
   * Get addresses by type for a customer
   * GET /api/customer-addresses/customer/:customerId/:type
   */
  async getByType(req: Request, res: Response) {
    const { customerId, type } = req.params;

    const addresses = await customerAddressService.getByCustomerId(customerId, {
      addressType: type as CustomerAddressType,
      isActive: true,
    });

    res.json({ data: addresses });
  }

  /**
   * Get address by ID
   * GET /api/customer-addresses/:id
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const address = await customerAddressService.getById(id);

    if (!address) {
      throw new NotFoundError('Customer address', id);
    }

    res.json({ data: address });
  }

  /**
   * Create new address
   * POST /api/customer-addresses
   */
  async create(req: Request, res: Response) {
    const address = await customerAddressService.create(req.body);

    res.status(201).json({
      data: address,
      message: 'Address created successfully',
    });
  }

  /**
   * Update address
   * PUT /api/customer-addresses/:id
   */
  async update(req: Request, res: Response) {
    const { id } = req.params;

    const address = await customerAddressService.update(id, req.body);

    if (!address) {
      throw new NotFoundError('Customer address', id);
    }

    res.json({
      data: address,
      message: 'Address updated successfully',
    });
  }

  /**
   * Delete address
   * DELETE /api/customer-addresses/:id
   */
  async delete(req: Request, res: Response) {
    const { id } = req.params;

    const existing = await customerAddressService.getById(id);
    if (!existing) {
      throw new NotFoundError('Customer address', id);
    }

    await customerAddressService.delete(id);

    res.json({ message: 'Address deleted successfully' });
  }

  /**
   * Set address as primary for its type
   * PUT /api/customer-addresses/:id/set-primary
   */
  async setPrimary(req: Request, res: Response) {
    const { id } = req.params;

    const address = await customerAddressService.setPrimary(id);

    if (!address) {
      throw new NotFoundError('Customer address', id);
    }

    res.json({
      data: address,
      message: 'Address set as primary successfully',
    });
  }

  /**
   * Get formatted address for copying
   * GET /api/customer-addresses/:id/formatted
   */
  async getFormatted(req: Request, res: Response) {
    const { id } = req.params;

    const address = await customerAddressService.getById(id);

    if (!address) {
      throw new NotFoundError('Customer address', id);
    }

    const formatted = customerAddressService.formatAddress(address);

    res.json({ data: { formatted } });
  }
}

export const customerAddressController = new CustomerAddressController();
