import prisma from '../config/database';
import logger from '../utils/logger';
import { Prisma } from '@prisma/client';
import {
  CreateFabricPhysicalTestInput,
  UpdateFabricPhysicalTestInput,
  RetestFabricInput,
  ApproveFabricTestInput,
  FabricPhysicalTestQueryOptions,
} from '../types/testing.types';
import { AppError, NotFoundError, ValidationError, InternalError } from '../errors';
import { generateAtomicMasterCode } from '../utils/atomicCodeGenerator';

class FabricPhysicalTestsService {
  /**
   * Generate the next test number (FPT-001).
   * Uses one shared atomic 'FPT' sequence so numbers are race-safe and unique.
   */
  private async generateTestNumber(): Promise<string> {
    return generateAtomicMasterCode('FPT', 3);
  }

  /**
   * Create a new fabric physical test
   */
  async createTest(data: CreateFabricPhysicalTestInput, userId: string): Promise<any> {
    try {
      // Generate test number
      const testNumber = await this.generateTestNumber();

      // Create test
      const test = await prisma.fabric_physical_tests.create({
        data: {
          testNumber,
          fabricId: data.fabricId,
          fabricProcurementId: data.fabricProcurementId,
          fabricStockLotId: data.fabricStockLotId,
          styleId: data.styleId,
          customerId: data.customerId,
          sentToLabDate: data.sentToLabDate,
          testingLabId: data.testingLabId,
          sampleQuantity: data.sampleQuantity,
          batchNumber: data.batchNumber,
          expectedGSM: data.expectedGSM,
          expectedConstruction: data.expectedConstruction,
          expectedCount: data.expectedCount,
          toleranceGSM: data.toleranceGSM,
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
          testingLab: true,
          fabric: true,
          procurement: true,
          stockLot: true,
          style: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return test;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Fabric Physical Tests Service Error Details:', error);
      throw new InternalError('Failed to create fabric physical test');
    }
  }

  /**
   * Get all tests with pagination and filters
   */
  async getAllTests(options: FabricPhysicalTestQueryOptions): Promise<any> {
    const {
      page = 1,
      limit = 20,
      search,
      styleId,
      customerId,
      testingLabId,
      overallTestResult,
      sentDateFrom,
      sentDateTo,
      receivedDateFrom,
      receivedDateTo,
      isRetest,
      pendingApproval,
    } = options;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.fabric_physical_testsWhereInput = {};

    if (search) {
      where.OR = [{ testNumber: { contains: search, mode: 'insensitive' } }];
    }

    if (styleId) {
      where.styleId = styleId;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (testingLabId) {
      where.testingLabId = testingLabId;
    }

    if (overallTestResult) {
      where.overallTestResult = overallTestResult;
    }

    if (sentDateFrom || sentDateTo) {
      where.sentToLabDate = {};
      if (sentDateFrom) {
        where.sentToLabDate.gte = new Date(sentDateFrom);
      }
      if (sentDateTo) {
        where.sentToLabDate.lte = new Date(sentDateTo);
      }
    }

    if (receivedDateFrom || receivedDateTo) {
      where.testResultReceivedDate = {};
      if (receivedDateFrom) {
        where.testResultReceivedDate.gte = new Date(receivedDateFrom);
      }
      if (receivedDateTo) {
        where.testResultReceivedDate.lte = new Date(receivedDateTo);
      }
    }

    if (pendingApproval) {
      where.AND = [{ overallTestResult: 'FAIL' }, { approvedById: null }, { adminOverride: false }];
    }

    if (isRetest !== undefined) {
      where.isRetest = isRetest;
    }

    try {
      const [tests, total] = await Promise.all([
        prisma.fabric_physical_tests.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            approvedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            testingLab: true,
            fabric: true,
            procurement: true,
            stockLot: true,
            style: {
              select: {
                id: true,
                styleCode: true,
                styleName: true,
              },
            },
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        prisma.fabric_physical_tests.count({ where }),
      ]);

      return {
        data: tests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Fabric Physical Tests Service Error Details:', error);
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to fetch fabric physical tests');
    }
  }

  /**
   * Get test by ID
   */
  async getTestById(id: string): Promise<any> {
    try {
      const test = await prisma.fabric_physical_tests.findUnique({
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
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          testingLab: true,
          fabric: true,
          procurement: true,
          stockLot: true,
          style: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
              imageUrl: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          originalTest: true,
          retests: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!test) {
        throw new NotFoundError('Fabric physical test not found');
      }

      return test;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to fetch fabric physical test');
    }
  }

  /**
   * Update test (typically to add test results)
   */
  async updateTest(id: string, data: UpdateFabricPhysicalTestInput): Promise<any> {
    try {
      const existingTest = await prisma.fabric_physical_tests.findUnique({
        where: { id },
      });

      if (!existingTest) {
        throw new NotFoundError('Fabric physical test not found');
      }

      const calculatedData: any = { ...data };

      // Auto-calculate GSM variance when both expected and tested GSM are known
      const expectedGSM = data.expectedGSM ?? existingTest.expectedGSM ?? undefined;
      if (data.testedGSM != null && expectedGSM != null && expectedGSM !== 0 && data.gsmVariance == null) {
        calculatedData.gsmVariance = ((data.testedGSM - expectedGSM) / expectedGSM) * 100;
      }

      // Auto-calculate overall test result from the sub-results if not explicitly provided
      let overallTestResult = data.overallTestResult;

      if (!overallTestResult) {
        const gsmResult = data.gsmTestResult || existingTest.gsmTestResult;
        const constructionResult = data.constructionTestResult || existingTest.constructionTestResult;
        const countResult = data.countTestResult || existingTest.countTestResult;

        if (gsmResult === 'FAIL' || constructionResult === 'FAIL' || countResult === 'FAIL') {
          overallTestResult = 'FAIL';
        } else if (gsmResult === 'PASS' && constructionResult === 'PASS' && countResult === 'PASS') {
          overallTestResult = 'PASS';
        }
      }

      const updatedTest = await prisma.fabric_physical_tests.update({
        where: { id },
        data: {
          ...calculatedData,
          overallTestResult,
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
          testingLab: true,
          fabric: true,
          style: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
            },
          },
        },
      });

      return updatedTest;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to update fabric physical test');
    }
  }

  /**
   * Create retest from failed test
   */
  async createRetest(data: RetestFabricInput, userId: string): Promise<any> {
    try {
      const originalTest = await prisma.fabric_physical_tests.findUnique({
        where: { id: data.originalTestId },
      });

      if (!originalTest) {
        throw new NotFoundError('Original test not found');
      }

      // Generate new test number
      const testNumber = await this.generateTestNumber();

      // Create retest
      const retest = await prisma.fabric_physical_tests.create({
        data: {
          testNumber,
          fabricId: originalTest.fabricId,
          fabricProcurementId: originalTest.fabricProcurementId,
          fabricStockLotId: originalTest.fabricStockLotId,
          styleId: originalTest.styleId,
          customerId: originalTest.customerId,
          testingLabId: data.testingLabId || originalTest.testingLabId,
          sentToLabDate: data.sentToLabDate,
          sampleQuantity: data.sampleQuantity,
          expectedGSM: originalTest.expectedGSM,
          expectedConstruction: originalTest.expectedConstruction,
          expectedCount: originalTest.expectedCount,
          toleranceGSM: originalTest.toleranceGSM,
          isRetest: true,
          originalTestId: data.originalTestId,
          retestReason: data.retestReason,
          retestCount: originalTest.retestCount + 1,
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
          testingLab: true,
          fabric: true,
          style: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
            },
          },
        },
      });

      return retest;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to create retest');
    }
  }

  /**
   * Admin approve test (can override FAIL)
   */
  async approveTest(id: string, data: ApproveFabricTestInput, userId: string): Promise<any> {
    try {
      const test = await prisma.fabric_physical_tests.findUnique({
        where: { id },
      });

      if (!test) {
        throw new NotFoundError('Fabric physical test not found');
      }

      if (data.adminOverride && !data.overrideReason) {
        throw new ValidationError('Override reason is required for admin override');
      }

      const updatedTest = await prisma.fabric_physical_tests.update({
        where: { id },
        data: {
          approvedById: userId,
          approvedDate: new Date(),
          adminOverride: data.adminOverride || false,
          overrideReason: data.overrideReason,
        },
        include: {
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return updatedTest;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to approve test');
    }
  }

  /**
   * Delete test
   */
  async deleteTest(id: string): Promise<void> {
    try {
      const test = await prisma.fabric_physical_tests.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              retests: true,
            },
          },
        },
      });

      if (!test) {
        throw new NotFoundError('Fabric physical test not found');
      }

      // Cannot delete if it has retests
      if (test._count.retests > 0) {
        throw new ValidationError('Cannot delete test with retests');
      }

      await prisma.fabric_physical_tests.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to delete test');
    }
  }
}

export const fabricPhysicalTestsService = new FabricPhysicalTestsService();
