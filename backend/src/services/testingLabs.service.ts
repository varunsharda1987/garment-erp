import prisma from '../config/database';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import { CreateTestingLabInput, UpdateTestingLabInput, TestingLabQueryOptions } from '../types/testing.types';
import { AppError, NotFoundError, ConflictError, InternalError } from '../errors';

class TestingLabsService {
  /**
   * Generate the next lab code (LAB-001, LAB-002, etc.)
   */
  private async generateLabCode(): Promise<string> {
    const lastLab = await prisma.testing_labs.findFirst({
      orderBy: { labCode: 'desc' },
      select: { labCode: true },
    });

    if (!lastLab) {
      return 'LAB-001';
    }

    const lastNumber = parseInt(lastLab.labCode.split('-')[1] || '0', 10);
    const nextNumber = lastNumber + 1;
    return `LAB-${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Create a new testing lab
   */
  async createLab(data: CreateTestingLabInput, userId: string): Promise<any> {
    try {
      // Check if lab code already exists
      const existingLab = await prisma.testing_labs.findFirst({
        where: { labCode: data.labCode, isActive: true },
      });

      if (existingLab) {
        throw new ConflictError('Lab code already exists');
      }

      // Create lab
      const lab = await prisma.testing_labs.create({
        data: {
          labCode: data.labCode,
          labName: data.labName,
          contactPerson: data.contactPerson || null,
          contactEmail: data.contactEmail || null,
          contactPhone: data.contactPhone || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          pincode: data.pincode || null,
          averageTurnaroundDays: data.averageTurnaroundDays || 7,
          accreditations: data.accreditations ? JSON.stringify(data.accreditations) : null,
          isActive: data.isActive !== undefined ? data.isActive : true,
          createdById: userId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return this.formatLabResponse(lab);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to create testing lab');
    }
  }

  /**
   * Get all labs with pagination and filters
   */
  async getAllLabs(options: TestingLabQueryOptions): Promise<any> {
    const { page = 1, limit = 20, search, isActive, city, state } = options;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.testing_labsWhereInput = {};

    if (search) {
      where.OR = [
        { labCode: { contains: search, mode: 'insensitive' } },
        { labName: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    if (state) {
      where.state = { contains: state, mode: 'insensitive' };
    }

    try {
      const [labs, total] = await Promise.all([
        prisma.testing_labs.findMany({
          where,
          skip,
          take: limit,
          orderBy: { labCode: 'asc' },
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            _count: {
              select: {
                fabricTests: true,
                garmentTests: true,
              },
            },
          },
        }),
        prisma.testing_labs.count({ where }),
      ]);

      return {
        data: labs.map((lab) => this.formatLabResponse(lab)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Testing Labs Service Error Details:', error);
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to fetch testing labs');
    }
  }

  /**
   * Get lab by ID
   */
  async getLabById(id: string): Promise<any> {
    try {
      const lab = await prisma.testing_labs.findUnique({
        where: { id },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              fabricTests: true,
              garmentTests: true,
              customerDefaults: true,
            },
          },
        },
      });

      if (!lab) {
        throw new NotFoundError('Testing lab not found');
      }

      return this.formatLabResponse(lab);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to fetch testing lab');
    }
  }

  /**
   * Update lab
   */
  async updateLab(id: string, data: UpdateTestingLabInput): Promise<any> {
    try {
      // Check if lab exists
      const existingLab = await prisma.testing_labs.findUnique({
        where: { id },
      });

      if (!existingLab) {
        throw new NotFoundError('Testing lab not found');
      }

      // If updating lab code, check for duplicates
      if (data.labCode && data.labCode !== existingLab.labCode) {
        const duplicate = await prisma.testing_labs.findFirst({
          where: { labCode: data.labCode, isActive: true },
        });

        if (duplicate) {
          throw new ConflictError('Lab code already exists');
        }
      }

      // Update lab
      const updatedLab = await prisma.testing_labs.update({
        where: { id },
        data: {
          labCode: data.labCode,
          labName: data.labName,
          contactPerson: data.contactPerson,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          averageTurnaroundDays: data.averageTurnaroundDays,
          accreditations: data.accreditations ? JSON.stringify(data.accreditations) : undefined,
          isActive: data.isActive,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return this.formatLabResponse(updatedLab);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to update testing lab');
    }
  }

  /**
   * Delete lab (soft delete by setting isActive = false)
   */
  async deleteLab(id: string): Promise<void> {
    try {
      // Check if lab exists
      const lab = await prisma.testing_labs.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              fabricTests: true,
              garmentTests: true,
            },
          },
        },
      });

      if (!lab) {
        throw new NotFoundError('Testing lab not found');
      }

      // Check if lab has any tests
      if (lab._count.fabricTests > 0 || lab._count.garmentTests > 0) {
        // Soft delete only
        await prisma.testing_labs.update({
          where: { id },
          data: { isActive: false },
        });
      } else {
        // Hard delete if no tests
        await prisma.testing_labs.delete({
          where: { id },
        });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to delete testing lab');
    }
  }

  /**
   * Get lab statistics
   */
  async getLabStats(id: string): Promise<any> {
    try {
      const lab = await prisma.testing_labs.findUnique({
        where: { id },
        include: {
          fabricTests: {
            select: {
              id: true,
              overallTestResult: true,
              sentToLabDate: true,
              testResultReceivedDate: true,
            },
          },
          garmentTests: {
            select: {
              id: true,
              overallTestResult: true,
              sentToLabDate: true,
            },
          },
        },
      });

      if (!lab) {
        throw new NotFoundError('Testing lab not found');
      }

      // Calculate stats
      const totalTests = lab.fabricTests.length + lab.garmentTests.length;
      const completedTests = [
        ...lab.fabricTests.filter((t) => t.testResultReceivedDate),
        ...lab.garmentTests.filter((t) => t.overallTestResult !== 'PENDING'),
      ].length;

      const passedTests = [
        ...lab.fabricTests.filter((t) => t.overallTestResult === 'PASS'),
        ...lab.garmentTests.filter((t) => t.overallTestResult === 'PASS'),
      ].length;

      const failedTests = [
        ...lab.fabricTests.filter((t) => t.overallTestResult === 'FAIL'),
        ...lab.garmentTests.filter((t) => t.overallTestResult === 'FAIL'),
      ].length;

      // Calculate average turnaround time from completed fabric tests
      const completedFabricTests = lab.fabricTests.filter((t) => t.sentToLabDate && t.testResultReceivedDate);

      let averageTurnaroundActual = 0;
      if (completedFabricTests.length > 0) {
        const totalDays = completedFabricTests.reduce((sum, test) => {
          const sent = new Date(test.sentToLabDate!);
          const received = new Date(test.testResultReceivedDate!);
          const days = Math.floor((received.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0);
        averageTurnaroundActual = Math.round(totalDays / completedFabricTests.length);
      }

      return {
        labId: lab.id,
        labCode: lab.labCode,
        labName: lab.labName,
        totalTests,
        completedTests,
        pendingTests: totalTests - completedTests,
        passedTests,
        failedTests,
        passRate: totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0.0',
        averageTurnaroundExpected: lab.averageTurnaroundDays,
        averageTurnaroundActual,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to fetch lab statistics');
    }
  }

  /**
   * Format lab response (parse JSON fields)
   */
  private formatLabResponse(lab: any): any {
    return {
      ...lab,
      accreditations: lab.accreditations ? JSON.parse(lab.accreditations) : [],
    };
  }
}

export const testingLabsService = new TestingLabsService();
