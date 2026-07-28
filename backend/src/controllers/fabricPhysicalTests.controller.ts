import { Request, Response } from 'express';
import { fabricPhysicalTestsService } from '../services/fabricPhysicalTests.service';
import { UnauthorizedError } from '../errors';

export const createFabricPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const test = await fabricPhysicalTestsService.createTest(req.body, userId);

  res.status(201).json({
    data: test,
    message: 'Fabric physical test created successfully',
  });
};

export const getAllFabricPhysicalTests = async (req: Request, res: Response): Promise<void> => {
  const result = await fabricPhysicalTestsService.getAllTests(req.validatedQuery || req.query);

  res.json({
    data: result.data,
    pagination: result.pagination,
  });
};

export const getFabricPhysicalTestById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const test = await fabricPhysicalTestsService.getTestById(id);

  res.json({
    data: test,
  });
};

export const updateFabricPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const test = await fabricPhysicalTestsService.updateTest(id, req.body);

  res.json({
    data: test,
    message: 'Fabric physical test updated successfully',
  });
};

export const createRetestFabricPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const retest = await fabricPhysicalTestsService.createRetest(req.body, userId);

  res.status(201).json({
    data: retest,
    message: 'Fabric physical test retest created successfully',
  });
};

export const approveFabricPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  const { id } = req.params;
  const test = await fabricPhysicalTestsService.approveTest(id, req.body, userId);

  res.json({
    data: test,
    message: 'Fabric physical test approved successfully',
  });
};

export const deleteFabricPhysicalTest = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await fabricPhysicalTestsService.deleteTest(id);

  res.json({
    message: 'Fabric physical test deleted successfully',
  });
};
