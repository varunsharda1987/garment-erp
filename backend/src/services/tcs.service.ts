import prisma from '../config/database';

interface TCSCreateInput {
  invoiceId?: string;
  customerName: string;
  tcsSection: string; // "206C(1H)"
  tcsRate: number;
  saleAmount: number;
  tcsAmount: number;
  collectionDate: string;
  financialYear: string;
  quarter: number;
  remarks?: string;
}

interface TCSQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  financialYear?: string;
  quarter?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class TCSService {
  async create(data: TCSCreateInput, userId: string) {
    return prisma.tcs_entries.create({
      data: {
        ...data,
        collectionDate: new Date(data.collectionDate),
        createdById: userId,
      },
    });
  }

  async getAll(params: TCSQueryParams) {
    const {
      page = 1,
      limit = 20,
      search,
      financialYear,
      quarter,
      status,
      sortBy = 'collectionDate',
      sortOrder = 'desc',
    } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { tcsSection: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (financialYear) where.financialYear = financialYear;
    if (quarter) where.quarter = quarter;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.tcs_entries.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.tcs_entries.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    return prisma.tcs_entries.findUnique({ where: { id } });
  }

  async update(id: string, data: Partial<TCSCreateInput>) {
    const updateData: any = { ...data };
    if (data.collectionDate) updateData.collectionDate = new Date(data.collectionDate);
    return prisma.tcs_entries.update({ where: { id }, data: updateData });
  }

  async updateStatus(id: string, status: string, remarks?: string) {
    const data: any = { status };
    if (remarks !== undefined) data.remarks = remarks;
    return prisma.tcs_entries.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.tcs_entries.delete({ where: { id } });
  }

  async getSummary(financialYear: string) {
    const entries = await prisma.tcs_entries.findMany({
      where: { financialYear },
      orderBy: { quarter: 'asc' },
    });

    const quarterSummary = [1, 2, 3, 4].map((q) => {
      const qEntries = entries.filter((e) => e.quarter === q);
      return {
        quarter: q,
        count: qEntries.length,
        totalSaleAmount: qEntries.reduce((s, e) => s + Number(e.saleAmount), 0),
        totalTCS: qEntries.reduce((s, e) => s + Number(e.tcsAmount), 0),
        pending: qEntries.filter((e) => e.status === 'PENDING').length,
        deposited: qEntries.filter((e) => e.status === 'DEPOSITED').length,
      };
    });

    return {
      financialYear,
      quarterSummary,
      totalEntries: entries.length,
      totalSaleAmount: entries.reduce((s, e) => s + Number(e.saleAmount), 0),
      totalTCS: entries.reduce((s, e) => s + Number(e.tcsAmount), 0),
    };
  }
}

export const tcsService = new TCSService();
