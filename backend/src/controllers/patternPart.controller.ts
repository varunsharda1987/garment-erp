import { Request, Response } from 'express';
import { patternPartService } from '../services/patternPart.service';
import {
  createPatternPartSchema,
  updatePatternPartSchema,
  reorderPatternPartsSchema,
  addComponentPatternPartSchema,
  updateComponentPatternPartSchema,
} from '../types/patternPart.types';
import { z } from 'zod';
import { NotFoundError, ValidationError, ConflictError } from '../errors';

export class PatternPartController {
  /**
   * Create a new pattern part
   * POST /api/pattern-parts
   */
  async createPatternPart(req: Request, res: Response) {
    try {
      const validatedData = createPatternPartSchema.parse(req.body);
      const patternPart = await patternPartService.createPatternPart(validatedData);

      res.status(201).json({
        success: true,
        message: 'Pattern part created successfully',
        data: patternPart,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation error', { errors: error.issues });
      }

      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          throw new ConflictError(error.message);
        }
      }

      throw error;
    }
  }

  /**
   * Get all pattern parts with pagination
   * GET /api/pattern-parts
   */
  async getPatternParts(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string | undefined;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

    const result = await patternPartService.getPatternParts(page, limit, search, isActive);

    res.json({
      success: true,
      ...result,
    });
  }

  /**
   * Get pattern part by ID
   * GET /api/pattern-parts/:id
   */
  async getPatternPartById(req: Request, res: Response) {
    const { id } = req.params;
    const patternPart = await patternPartService.getPatternPartById(id);

    if (!patternPart) {
      throw new NotFoundError('Pattern part', id);
    }

    res.json({
      success: true,
      data: patternPart,
    });
  }

  /**
   * Get pattern part by code
   * GET /api/pattern-parts/code/:code
   */
  async getPatternPartByCode(req: Request, res: Response) {
    const { code } = req.params;
    const patternPart = await patternPartService.getPatternPartByCode(code);

    if (!patternPart) {
      throw new NotFoundError('Pattern part', code);
    }

    res.json({
      success: true,
      data: patternPart,
    });
  }

  /**
   * Update pattern part
   * PUT /api/pattern-parts/:id
   */
  async updatePatternPart(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = updatePatternPartSchema.parse(req.body);

      const patternPart = await patternPartService.updatePatternPart(id, validatedData);

      res.json({
        success: true,
        message: 'Pattern part updated successfully',
        data: patternPart,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation error', { errors: error.issues });
      }

      if (error instanceof Error) {
        if (error.message === 'Pattern part not found') {
          throw new NotFoundError('Pattern part', req.params.id);
        }

        if (error.message.includes('already exists')) {
          throw new ConflictError(error.message);
        }
      }

      throw error;
    }
  }

  /**
   * Delete pattern part (soft delete)
   * DELETE /api/pattern-parts/:id
   */
  async deletePatternPart(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const patternPart = await patternPartService.deletePatternPart(id);

      res.json({
        success: true,
        message: 'Pattern part deleted successfully',
        data: patternPart,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Pattern part not found') {
          throw new NotFoundError('Pattern part', req.params.id);
        }

        if (error.message.includes('Cannot delete')) {
          throw new ValidationError(error.message);
        }
      }

      throw error;
    }
  }

  /**
   * Reorder pattern parts
   * POST /api/pattern-parts/reorder
   */
  async reorderPatternParts(req: Request, res: Response) {
    try {
      const validatedData = reorderPatternPartsSchema.parse(req.body);
      await patternPartService.reorderPatternParts(validatedData);

      res.json({
        success: true,
        message: 'Pattern parts reordered successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation error', { errors: error.issues });
      }

      throw error;
    }
  }

  /**
   * Get pattern parts for a component
   * GET /api/components/:componentId/pattern-parts
   */
  async getPatternPartsByComponent(req: Request, res: Response) {
    const { componentId } = req.params;
    const patternParts = await patternPartService.getPatternPartsByComponent(componentId);

    res.json({
      success: true,
      data: patternParts,
    });
  }

  /**
   * Add pattern part to component
   * POST /api/components/:componentId/pattern-parts
   */
  async addPatternPartToComponent(req: Request, res: Response) {
    try {
      const { componentId } = req.params;
      const validatedData = addComponentPatternPartSchema.parse(req.body);

      const association = await patternPartService.addPatternPartToComponent(componentId, validatedData);

      res.status(201).json({
        success: true,
        message: 'Pattern part added to component successfully',
        data: association,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation error', { errors: error.issues });
      }

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          throw new ValidationError(error.message);
        }
        if (error.message.includes('already associated')) {
          throw new ConflictError(error.message);
        }
      }

      throw error;
    }
  }

  /**
   * Update component-pattern part association
   * PUT /api/components/:componentId/pattern-parts/:patternPartId
   */
  async updateComponentPatternPart(req: Request, res: Response) {
    try {
      const { componentId, patternPartId } = req.params;
      const validatedData = updateComponentPatternPartSchema.parse(req.body);

      const association = await patternPartService.updateComponentPatternPart(
        componentId,
        patternPartId,
        validatedData
      );

      res.json({
        success: true,
        message: 'Pattern part association updated successfully',
        data: association,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation error', { errors: error.issues });
      }

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          throw new NotFoundError('Component pattern part association');
        }
      }

      throw error;
    }
  }

  /**
   * Remove pattern part from component
   * DELETE /api/components/:componentId/pattern-parts/:patternPartId
   */
  async removePatternPartFromComponent(req: Request, res: Response) {
    try {
      const { componentId, patternPartId } = req.params;

      await patternPartService.removePatternPartFromComponent(componentId, patternPartId);

      res.json({
        success: true,
        message: 'Pattern part removed from component successfully',
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          throw new NotFoundError('Component pattern part association');
        }
      }

      throw error;
    }
  }
}

export const patternPartController = new PatternPartController();
