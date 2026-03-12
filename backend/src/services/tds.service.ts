import prisma from '../config/database';

interface TDSCreateInput {
  invoiceId?: string;
  paymentId?: string;
  deductorName: string;
  deducteeName: string;
  tdsSection: string;  // "194C", "194J", etc.
  tdsRate: number;
  grossAmount: number;
  tdsAmount: number;
  netAmount: number;
  certificateNo?: string;
  deductionDate: string;
  financialYear: string;
  quarter: number;
  remarks?: string;
}

interface TDSQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  financialYear?: string;
  quarter?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class TDSService {
  async create(data: TDSCreateInput, userId: string) {
    return prisma.tds_entries.create({
      data: {
        ...data,
        deductionDate: new Date(data.deductionDate),
        createdById: userId,
      },
    });
  }

  async getAll(params: TDSQueryParams) {
    const { page = 1, limit = 20, search, financialYear, quarter, status, sortBy = 'deductionDate', sortOrder = 'desc' } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { deductorName: { contains: search, mode: 'insensitive' } },
        { tdsSection: { contains: search, mode: 'insensitive' } },
        { certificateNo: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (financialYear) where.financialYear = financialYear;
    if (quarter) where.quarter = quarter;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.tds_entries.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.tds_entries.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    return prisma.tds_entries.findUnique({ where: { id } });
  }

  async update(id: string, data: Partial<TDSCreateInput>) {
    const updateData: any = { ...data };
    if (data.deductionDate) updateData.deductionDate = new Date(data.deductionDate);
    return prisma.tds_entries.update({ where: { id }, data: updateData });
  }

  async updateStatus(id: string, status: string, certificateNo?: string) {
    const updateData: any = { status };
    if (certificateNo) updateData.certificateNo = certificateNo;
    return prisma.tds_entries.update({ where: { id }, data: updateData });
  }

  async delete(id: string) {
    return prisma.tds_entries.delete({ where: { id } });
  }

  async getSummary(financialYear: string) {
    const entries = await prisma.tds_entries.findMany({
      where: { financialYear },
      orderBy: { quarter: 'asc' },
    });

    const quarterSummary = [1, 2, 3, 4].map(q => {
      const qEntries = entries.filter(e => e.quarter === q);
      return {
        quarter: q,
        count: qEntries.length,
        totalGross: qEntries.reduce((s, e) => s + Number(e.grossAmount), 0),
        totalTDS: qEntries.reduce((s, e) => s + Number(e.tdsAmount), 0),
        totalNet: qEntries.reduce((s, e) => s + Number(e.netAmount), 0),
        pending: qEntries.filter(e => e.status === 'PENDING').length,
        certificateReceived: qEntries.filter(e => e.status === 'CERTIFICATE_RECEIVED').length,
        verified: qEntries.filter(e => e.status === 'VERIFIED').length,
      };
    });

    return {
      financialYear,
      quarterSummary,
      totalEntries: entries.length,
      totalGross: entries.reduce((s, e) => s + Number(e.grossAmount), 0),
      totalTDS: entries.reduce((s, e) => s + Number(e.tdsAmount), 0),
      totalNet: entries.reduce((s, e) => s + Number(e.netAmount), 0),
    };
  }
}

export const tdsService = new TDSService();
