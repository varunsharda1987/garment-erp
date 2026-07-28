import prisma from '../config/database';
import { Prisma, CustomerAddressType } from '@prisma/client';
import { CreateCustomerAddressInput, UpdateCustomerAddressInput } from '../schemas/customerAddress.schema';

interface CustomerAddressQueryParams {
  customerId?: string;
  addressType?: CustomerAddressType;
  isActive?: boolean;
}

export class CustomerAddressService {
  /**
   * Default includes for address queries
   */
  private getDefaultIncludes() {
    return {
      state: {
        select: {
          id: true,
          stateName: true,
          stateCode: true,
        },
      },
      city: {
        select: {
          id: true,
          cityName: true,
          tier: true,
        },
      },
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
   * Create a new customer address
   */
  async create(data: CreateCustomerAddressInput) {
    // If setting as primary, unset other primaries of same type for this customer
    if (data.isPrimary) {
      await prisma.customer_addresses.updateMany({
        where: {
          customerId: data.customerId,
          addressType: data.addressType,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    return prisma.customer_addresses.create({
      data: {
        customerId: data.customerId,
        label: data.label,
        addressType: data.addressType,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        landmark: data.landmark || null,
        stateId: data.stateId || null,
        cityId: data.cityId || null,
        pincode: data.pincode,
        country: data.country || 'India',
        contactPerson: data.contactPerson || null,
        contactPhone: data.contactPhone || null,
        contactEmail: data.contactEmail || null,
        isPrimary: data.isPrimary ?? false,
        isActive: data.isActive ?? true,
      },
      include: this.getDefaultIncludes(),
    });
  }

  /**
   * Get all addresses for a customer
   */
  async getByCustomerId(customerId: string, params: CustomerAddressQueryParams = {}) {
    const { addressType, isActive } = params;

    const where: Prisma.customer_addressesWhereInput = {
      customerId,
    };

    if (addressType) {
      where.addressType = addressType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return prisma.customer_addresses.findMany({
      where,
      orderBy: [{ isPrimary: 'desc' }, { label: 'asc' }],
      include: this.getDefaultIncludes(),
    });
  }

  /**
   * Get address by ID
   */
  async getById(id: string) {
    return prisma.customer_addresses.findUnique({
      where: { id },
      include: this.getDefaultIncludes(),
    });
  }

  /**
   * Update an address
   */
  async update(id: string, data: UpdateCustomerAddressInput) {
    const existing = await prisma.customer_addresses.findUnique({
      where: { id },
      select: { customerId: true, addressType: true },
    });

    if (!existing) {
      return null;
    }

    // If setting as primary, unset other primaries of same type for this customer
    if (data.isPrimary) {
      const addressType = data.addressType || existing.addressType;
      await prisma.customer_addresses.updateMany({
        where: {
          customerId: existing.customerId,
          addressType: addressType,
          isPrimary: true,
          id: { not: id },
        },
        data: { isPrimary: false },
      });
    }

    return prisma.customer_addresses.update({
      where: { id },
      data: {
        label: data.label,
        addressType: data.addressType,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        landmark: data.landmark,
        stateId: data.stateId,
        cityId: data.cityId,
        pincode: data.pincode,
        country: data.country,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        isPrimary: data.isPrimary,
        isActive: data.isActive,
      },
      include: this.getDefaultIncludes(),
    });
  }

  /**
   * Delete an address
   */
  async delete(id: string) {
    return prisma.customer_addresses.delete({
      where: { id },
    });
  }

  /**
   * Set an address as primary for its type
   */
  async setPrimary(id: string) {
    const address = await prisma.customer_addresses.findUnique({
      where: { id },
      select: { customerId: true, addressType: true },
    });

    if (!address) {
      return null;
    }

    // Unset other primaries of same type for this customer
    await prisma.customer_addresses.updateMany({
      where: {
        customerId: address.customerId,
        addressType: address.addressType,
        isPrimary: true,
        id: { not: id },
      },
      data: { isPrimary: false },
    });

    // Set this one as primary
    return prisma.customer_addresses.update({
      where: { id },
      data: { isPrimary: true },
      include: this.getDefaultIncludes(),
    });
  }

  /**
   * Format address for copy/display
   */
  formatAddress(address: {
    label: string;
    addressLine1: string;
    addressLine2?: string | null;
    landmark?: string | null;
    city?: { cityName: string } | null;
    state?: { stateName: string } | null;
    pincode: string;
    contactPerson?: string | null;
    contactPhone?: string | null;
  }): string {
    const lines: string[] = [address.label];

    lines.push(address.addressLine1);

    if (address.addressLine2) {
      lines.push(address.addressLine2);
    }

    if (address.landmark) {
      lines.push(address.landmark);
    }

    const cityStatePincode: string[] = [];
    if (address.city?.cityName) {
      cityStatePincode.push(address.city.cityName);
    }
    if (address.state?.stateName) {
      cityStatePincode.push(address.state.stateName);
    }
    if (address.pincode) {
      cityStatePincode.push(`- ${address.pincode}`);
    }
    if (cityStatePincode.length > 0) {
      lines.push(cityStatePincode.join(', '));
    }

    if (address.contactPerson) {
      const contactLine = address.contactPhone
        ? `Contact: ${address.contactPerson} (${address.contactPhone})`
        : `Contact: ${address.contactPerson}`;
      lines.push(contactLine);
    }

    return lines.join('\n');
  }
}

export const customerAddressService = new CustomerAddressService();
