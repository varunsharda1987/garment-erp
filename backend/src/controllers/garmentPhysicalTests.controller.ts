import { Request, Response } from 'express';
import { garmentPhysicalTestsService } from '../services/garmentPhysicalTests.service';
import { UnauthorizedError } from '../errors';

export const createGarmentPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const test = await garmentPhysicalTestsService.createTest(req.body, userId);

  res.status(201).json({
    data: test,
    message: 'Garment physical test created successfully',
  });
};

export const getAllGarmentPhysicalTests = async (req: Request, res: Response): Promise<void> => {
  const result = await garmentPhysicalTestsService.getAllTests((req as any).validatedQuery || req.query);

  res.json({
    data: result.data,
    pagination: result.pagination,
  });
};

export const getGarmentPhysicalTestById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const test = await garmentPhysicalTestsService.getTestById(id);

  res.json({
    data: test,
  });
};

export const updateGarmentPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const test = await garmentPhysicalTestsService.updateTest(id, req.body);

  res.json({
    data: test,
    message: 'Garment physical test updated successfully',
  });
};

export const createRetestGarmentPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const retest = await garmentPhysicalTestsService.createRetest(req.body, userId);

  res.status(201).json({
    data: retest,
    message: 'Garment physical test retest created successfully',
  });
};

export const approveGarmentPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { id } = req.params;
  const test = await garmentPhysicalTestsService.approveTest(id, req.body, userId);

  res.json({
    data: test,
    message: 'Garment physical test approved successfully',
  });
};

export const buyerApproveGarmentPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { id } = req.params;
  const test = await garmentPhysicalTestsService.buyerApproveTest(id, req.body, userId);

  res.json({
    data: test,
    message: 'Garment physical test buyer approved successfully',
  });
};

export const deleteGarmentPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await garmentPhysicalTestsService.deleteTest(id);

  res.json({
    message: 'Garment physical test deleted successfully',
  });
};
