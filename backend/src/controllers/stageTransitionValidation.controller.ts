import { Request, Response } from 'express';
import { ProductionStage, SampleType } from '@prisma/client';
import prisma from '../config/database';
import { productionBlockingValidationService } from '../services/productionBlockingValidation.service';
import { serialize } from '../utils/serializer';
import { ValidationError } from '../errors';

/**
 * Check if a stage transition is allowed
 * GET /api/stage-validation/check?workOrderId=xxx&targetStage=IN_CUTTING
 */
export const checkStageTransition = async (req: Request, res: Response) => {
  const { workOrderId, targetStage } = req.query;

  if (!workOrderId || !targetStage) {
    throw new ValidationError('Missing required parameters: workOrderId and targetStage');
  }

  const validation = await productionBlockingValidationService.validateStageTransition(
    workOrderId as string,
    targetStage as ProductionStage,
    false // Not checking for override, just validation
  );

  res.json({
    data: serialize({
      isBlocked: validation.isBlocked,
      blockers: validation.blockers,
      canProceed: !validation.isBlocked,
    }),
  });
};

/**
 * Check if sample creation is allowed (sequential dependency validation)
 * GET /api/stage-validation/check-sample-creation?styleId=xxx&sampleType=PP_SAMPLE
 */
export const checkSampleCreation = async (req: Request, res: Response) => {
  const { styleId, sampleType } = req.query;

  if (!styleId || !sampleType) {
    throw new ValidationError('Missing required parameters: styleId and sampleType');
  }

  let validation;

  if (sampleType === 'PP_SAMPLE') {
    validation = await productionBlockingValidationService.validatePPSampleCreation(styleId as string);
  } else if (sampleType === 'SIZE_SET_SAMPLE') {
    validation = await productionBlockingValidationService.validateSizeSetSampleCreation(styleId as string);
  } else {
    // No validation needed for other sample types (FIT_SAMPLE, SHIPMENT_SAMPLE, etc.)
    return res.json({
      data: serialize({
        canCreate: true,
        blocker: null,
      }),
    });
  }

  res.json({ data: serialize(validation) });
};

/**
 * Get override history (admin only)
 * GET /api/stage-validation/override-history?workOrderId=xxx&sampleId=xxx&limit=50
 */
export const getOverrideHistory = async (req: Request, res: Response) => {
  const { workOrderId, sampleId, limit = '50' } = req.query;

  const overrides = await prisma.stage_transition_overrides.findMany({
    where: {
      ...(workOrderId && { workOrderId: workOrderId as string }),
      ...(sampleId && { sampleId: sampleId as string }),
    },
    include: {
      overriddenBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      workOrder: {
        select: {
          id: true,
          workOrderNumber: true,
        },
      },
      sample: {
        select: {
          id: true,
          sampleNumber: true,
          sampleType: true,
        },
      },
    },
    orderBy: { overriddenAt: 'desc' },
    take: parseInt(limit as string, 10),
  });

  res.json({ data: serialize(overrides) });
};
