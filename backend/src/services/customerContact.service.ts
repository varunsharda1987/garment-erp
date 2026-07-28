import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { CreateCustomerContactInput, UpdateCustomerContactInput } from '../schemas/customerContact.schema';

interface CustomerContactQueryParams {
  customerId?: string;
  isActive?: boolean;
}

export class CustomerContactService {
  /**
   * Default includes for contact queries
   */
  private getDefaultIncludes() {
    return {
      customer: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    };
  }

  /**
   * Create a new customer contact
   */
  async create(data: CreateCustomerContactInput) {
    // If setting as primary, unset other primaries for this customer
    if (data.isPrimary) {
      await prisma.customer_contacts.updateMany({
        where: {
          customerId: data.customerId,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    return prisma.customer_contacts.create({
      data: {
        customerId: data.customerId,
        name: data.name,
        designation: data.designation || null,
        phone: data.phone || null,
        alternatePhone: data.alternatePhone || null,
        email: data.email || null,
        whatsapp: data.whatsapp || null,
        isPrimary: data.isPrimary ?? false,
        isActive: data.isActive ?? true,
        notes: data.notes || null,
      },
      include: this.getDefaultIncludes(),
    });
  }

  /**
   * Get all contacts for a customer
   */
  async getByCustomerId(customerId: string, params: CustomerContactQueryParams = {}) {
    const { isActive } = params;

    const where: Prisma.customer_contactsWhereInput = {
      customerId,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return prisma.customer_contacts.findMany({
      where,
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
      include: this.getDefaultIncludes(),
    });
  }

  /**
   * Get contact by ID
   */
  async getById(id: string) {
    return prisma.customer_contacts.findUnique({
      where: { id },
      include: this.getDefaultIncludes(),
    });
  }

  /**
   * Update a contact
   */
  async update(id: string, data: UpdateCustomerContactInput) {
    const existing = await prisma.customer_contacts.findUnique({
      where: { id },
      select: { customerId: true },
    });

    if (!existing) {
      return null;
    }

    // If setting as primary, unset other primaries for this customer
    if (data.isPrimary) {
      await prisma.customer_contacts.updateMany({
        where: {
          customerId: existing.customerId,
          isPrimary: true,
          id: { not: id },
        },
        data: { isPrimary: false },
      });
    }

    return prisma.customer_contacts.update({
      where: { id },
      data: {
        name: data.name,
        designation: data.designation,
        phone: data.phone,
        alternatePhone: data.alternatePhone,
        email: data.email,
        whatsapp: data.whatsapp,
        isPrimary: data.isPrimary,
        isActive: data.isActive,
        notes: data.notes,
      },
      include: this.getDefaultIncludes(),
    });
  }

  /**
   * Delete a contact
   */
  async delete(id: string) {
    return prisma.customer_contacts.delete({
      where: { id },
    });
  }

  /**
   * Set a contact as primary
   */
  async setPrimary(id: string) {
    const contact = await prisma.customer_contacts.findUnique({
      where: { id },
      select: { customerId: true },
    });

    if (!contact) {
      return null;
    }

    // Unset other primaries for this customer
    await prisma.customer_contacts.updateMany({
      where: {
        customerId: contact.customerId,
        isPrimary: true,
        id: { not: id },
      },
      data: { isPrimary: false },
    });

    // Set this one as primary
    return prisma.customer_contacts.update({
      where: { id },
      data: { isPrimary: true },
      include: this.getDefaultIncludes(),
    });
  }
}

export const customerContactService = new CustomerContactService();
