import prisma from '../config/database';
import logger from '../utils/logger';
import { Prisma } from '@prisma/client';
import {
  CreateGarmentPhysicalTestInput,
  UpdateGarmentPhysicalTestInput,
  RetestGarmentInput,
  ApproveGarmentTestInput,
  BuyerApproveGarmentTestInput,
  GarmentPhysicalTestQueryOptions,
} from '../types/testing.types';
import { AppError, NotFoundError, ValidationError, InternalError, ConflictError } from '../errors';
import { generateAtomicMasterCode } from '../utils/atomicCodeGenerator';
import { applySearch } from '../utils/search-filter';
import { GARMENT_RESULT_KEYS } from '../schemas/testing.schemas';
import { conflictIfDuplicateRound, pickResultFields, resolveTrfForTest } from './helpers/lab-round.helper';

/** The lab round a test belongs to, and through it the sample (tests never carry a sampleId). */
const TRF_SUMMARY = {
  select: { id: true, trfNumber: true, sampleId: true, sample: { select: { id: true, sampleNumber: true } } },
} as const;

class GarmentPhysicalTestsService {
  /**
   * Generate the next test number (GPT-WO001-001).
   * Uses one shared atomic 'GPT' sequence so numbers are race-safe and unique
   * across all work orders (the suffix no longer restarts per work order).
   */
  private async generateTestNumber(workOrderNumber?: string): Promise<string> {
    const code = await generateAtomicMasterCode('GPT', 3);
    return workOrderNumber ? code.replace('GPT-', `GPT-${workOrderNumber}-`) : code;
  }

  /**
   * Create a new garment physical test
   */
  async createTest(data: CreateGarmentPhysicalTestInput, userId: string): Promise<any> {
    try {
      // A production run's garments carry a work order; a sample's garment test (done on the PP
      // sample before it is sent) has none and hangs off the sample's lab round (trfId) instead.
      const workOrder = data.workOrderId
        ? await prisma.work_orders.findUnique({
            where: { id: data.workOrderId },
            select: { id: true, workOrderNumber: true, styleId: true },
          })
        : null;
      if (data.workOrderId && !workOrder) {
        throw new NotFoundError('Work order not found');
      }

      // A result recorded against a lab round (TRF): the round, the test and any work order must all
      // be the same style.
      const trf = data.trfId ? await resolveTrfForTest(data.trfId, 'garment', data.styleId) : null;
      if (trf && workOrder && workOrder.styleId !== trf.styleId) {
        throw new ValidationError(
          `Work order ${workOrder.workOrderNumber} is for a different style than ${trf.trfNumber}`
        );
      }
      if (!workOrder && !trf) {
        throw new ValidationError('A garment test needs a work order or a test requirement form (lab round)');
      }

      // Generate test number
      const testNumber = await this.generateTestNumber(workOrder?.workOrderNumber);

      // Create test
      const test = await prisma.garment_physical_tests.create({
        data: {
          testNumber,
          workOrderId: workOrder?.id ?? null,
          styleId: data.styleId,
          customerId: data.customerId ?? trf?.customerId,
          sizeId: data.sizeId,
          colorId: data.colorId,
          sentToLabDate: data.sentToLabDate,
          testingLabId: data.testingLabId ?? trf?.testingLabId ?? undefined,
          sampleQuantity: data.sampleQuantity,

          buyerApprovalRequired: data.buyerApprovalRequired || false,
          trfId: trf?.id,
          ...pickResultFields(data, GARMENT_RESULT_KEYS),
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
          style: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
            },
          },
          workOrder: {
            select: {
              id: true,
              workOrderNumber: true,
            },
          },
          trf: TRF_SUMMARY,
        },
      });

      return test;
    } catch (error) {
      if (error instanceof AppError) throw error;
      conflictIfDuplicateRound(error, 'garment');
      throw new InternalError('Failed to create garment physical test');
    }
  }

  /**
   * Get all tests with pagination and filters
   */
  async getAllTests(options: GarmentPhysicalTestQueryOptions): Promise<any> {
    const {
      page = 1,
      limit = 20,
      search,
      workOrderId,
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
      pendingBuyerApproval,
    } = options;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.garment_physical_testsWhereInput = {};

    if (search) {
      applySearch(where, search, ['testNumber']);
    }

    if (workOrderId) {
      where.workOrderId = workOrderId;
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
      where.AND = where.AND
        ? [
            ...(where.AND as Array<object>),
            { overallTestResult: 'FAIL' },
            { approvedById: null },
            { adminOverride: false },
          ]
        : [{ overallTestResult: 'FAIL' }, { approvedById: null }, { adminOverride: false }];
    }

    if (pendingBuyerApproval) {
      where.AND = where.AND
        ? [...(where.AND as Array<object>), { buyerApprovalRequired: true }, { buyerApprovedDate: null }]
        : [{ buyerApprovalRequired: true }, { buyerApprovedDate: null }];
    }

    if (isRetest !== undefined) {
      where.isRetest = isRetest;
    }

    try {
      const [tests, total] = await Promise.all([
        prisma.garment_physical_tests.findMany({
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
            style: {
              select: {
                id: true,
                styleCode: true,
                buyerStyleRef: true,
                styleName: true,
              },
            },
            workOrder: {
              select: {
                id: true,
                workOrderNumber: true,
              },
            },
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
            trf: TRF_SUMMARY,
          },
        }),
        prisma.garment_physical_tests.count({ where }),
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
      logger.error('Garment Physical Tests Service Error Details:', error);
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to fetch garment physical tests');
    }
  }

  /**
   * Get test by ID
   */
  async getTestById(id: string): Promise<any> {
    try {
      const test = await prisma.garment_physical_tests.findUnique({
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
          style: {
            select: {
              id: true,
              styleCode: true,
              styleName: true,
              imageUrl: true,
            },
          },
          workOrder: {
            select: {
              id: true,
              workOrderNumber: true,
              totalQuantity: true,
              completedQuantity: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              requiresGPT: true,
              gptBlocksShipment: true,
              buyerApprovesGPT: true,
            },
          },
          size: true,
          color: true,
          originalTest: true,
          retests: {
            orderBy: { createdAt: 'desc' },
          },
          trf: TRF_SUMMARY,
        },
      });

      if (!test) {
        throw new NotFoundError('Garment physical test not found');
      }

      return test;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to fetch garment physical test');
    }
  }

  /**
   * Update test (typically to add test results)
   */
  async updateTest(id: string, data: UpdateGarmentPhysicalTestInput): Promise<any> {
    try {
      const existingTest = await prisma.garment_physical_tests.findUnique({
        where: { id },
      });

      if (!existingTest) {
        throw new NotFoundError('Garment physical test not found');
      }

      // Auto-calculate shrinkage percentages if measurements are provided
      let calculatedData: any = { ...data };

      if (data.prewashLength && data.postwashLength) {
        calculatedData.lengthShrinkage = ((data.prewashLength - data.postwashLength) / data.prewashLength) * 100;
      }

      if (data.prewashWidth && data.postwashWidth) {
        calculatedData.widthShrinkage = ((data.prewashWidth - data.postwashWidth) / data.prewashWidth) * 100;
      }

      // Auto-calculate overall test result
      let overallTestResult = data.overallTestResult;

      if (!overallTestResult) {
        const shrinkageResult = data.shrinkageTestResult || existingTest.shrinkageTestResult;
        const seamResult = data.seamTestResult || existingTest.seamTestResult;
        const colorResult = data.colorTestResult || existingTest.colorTestResult;

        if (shrinkageResult === 'FAIL' || seamResult === 'FAIL' || colorResult === 'FAIL') {
          overallTestResult = 'FAIL';
        } else if (shrinkageResult === 'PASS' && seamResult === 'PASS' && colorResult === 'PASS') {
          overallTestResult = 'PASS';
        }
      }

      const updatedTest = await prisma.garment_physical_tests.update({
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
      throw new InternalError('Failed to update garment physical test');
    }
  }

  /**
   * Create retest from failed test
   */
  async createRetest(data: RetestGarmentInput, userId: string): Promise<any> {
    try {
      const originalTest = await prisma.garment_physical_tests.findUnique({
        where: { id: data.originalTestId },
        include: {
          workOrder: {
            select: { workOrderNumber: true },
          },
          _count: { select: { retests: true } },
        },
      });

      if (!originalTest) {
        throw new NotFoundError('Original test not found');
      }
      if (!originalTest.isActive) {
        throw new ValidationError(`${originalTest.testNumber} has been deactivated and cannot be retested`);
      }
      // One retest per test keeps the chain a line, not a tree: a double-click used to make two.
      if (originalTest._count.retests > 0) {
        throw new ConflictError(
          `${originalTest.testNumber} has already been retested — record the new result on that retest`
        );
      }
      const trf = data.trfId ? await resolveTrfForTest(data.trfId, 'garment', originalTest.styleId) : null;

      // Generate new test number
      const testNumber = await this.generateTestNumber(originalTest.workOrder?.workOrderNumber);

      // Create retest
      const retest = await prisma.garment_physical_tests.create({
        data: {
          testNumber,
          workOrderId: originalTest.workOrderId,
          styleId: originalTest.styleId,
          customerId: originalTest.customerId,
          sizeId: originalTest.sizeId,
          colorId: originalTest.colorId,
          testingLabId: data.testingLabId || originalTest.testingLabId,
          sentToLabDate: data.sentToLabDate,
          sampleQuantity: data.sampleQuantity,
          buyerApprovalRequired: originalTest.buyerApprovalRequired,
          isRetest: true,
          originalTestId: data.originalTestId,
          retestReason: data.retestReason,
          retestCount: originalTest.retestCount + 1,
          trfId: trf?.id,
          ...pickResultFields(data, GARMENT_RESULT_KEYS),
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
      conflictIfDuplicateRound(error, 'garment');
      throw new InternalError('Failed to create retest');
    }
  }

  /**
   * Admin approve test (can override FAIL)
   */
  async approveTest(id: string, data: ApproveGarmentTestInput, userId: string): Promise<any> {
    try {
      const test = await prisma.garment_physical_tests.findUnique({
        where: { id },
      });

      if (!test) {
        throw new NotFoundError('Garment physical test not found');
      }

      if (data.adminOverride && !data.overrideReason) {
        throw new ValidationError('Override reason is required for admin override');
      }

      const updatedTest = await prisma.garment_physical_tests.update({
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
   * Buyer approve test (CRITICAL for GPT before shipment)
   */
  async buyerApproveTest(id: string, data: BuyerApproveGarmentTestInput, userId: string): Promise<any> {
    try {
      const test = await prisma.garment_physical_tests.findUnique({
        where: { id },
      });

      if (!test) {
        throw new NotFoundError('Garment physical test not found');
      }

      if (!test.buyerApprovalRequired) {
        throw new ValidationError('This test does not require buyer approval');
      }

      const updatedTest = await prisma.garment_physical_tests.update({
        where: { id },
        data: {
          buyerApprovedDate: new Date(),
          buyerApprovedBy: userId,
          buyerRemarks: data.buyerRemarks,
        },
      });

      return updatedTest;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to buyer approve test');
    }
  }

  /**
   * Delete test
   */
  async deleteTest(id: string): Promise<void> {
    try {
      const test = await prisma.garment_physical_tests.findUnique({
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
        throw new NotFoundError('Garment physical test not found');
      }

      // Cannot delete if it has retests
      if (test._count.retests > 0) {
        throw new ValidationError('Cannot delete test with retests');
      }

      await prisma.garment_physical_tests.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to delete test');
    }
  }
}

export const garmentPhysicalTestsService = new GarmentPhysicalTestsService();
