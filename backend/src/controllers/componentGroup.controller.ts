import { Request, Response } from 'express';
import { componentGroupService } from '../services/componentGroup.service';
import {
  createComponentGroupSchema,
  updateComponentGroupSchema,
  reorderComponentGroupsSchema,
} from '../types/componentGroup.types';
import { z } from 'zod';

export class ComponentGroupController {
  /**
   * Create a new component group
   * POST /api/component-groups
   */
  async createComponentGroup(req: Request, res: Response) {
    try {
      const validatedData = createComponentGroupSchema.parse(req.body);
      const componentGroup = await componentGroupService.createComponentGroup(validatedData);

      res.status(201).json({
        success: true,
        message: 'Component group created successfully',
        data: componentGroup,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          return res.status(409).json({
            success: false,
            message: error.message,
          });
        }
      }

      console.error('Error creating component group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create component group',
      });
    }
  }

  /**
   * Get all component groups with pagination
   * GET /api/component-groups
   */
  async getComponentGroups(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string | undefined;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const result = await componentGroupService.getComponentGroups(page, limit, search, isActive);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('Error fetching component groups:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch component groups',
      });
    }
  }

  /**
   * Get component group by ID
   * GET /api/component-groups/:id
   */
  async getComponentGroupById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const componentGroup = await componentGroupService.getComponentGroupById(id);

      if (!componentGroup) {
        return res.status(404).json({
          success: false,
          message: 'Component group not found',
        });
      }

      res.json({
        success: true,
        data: componentGroup,
      });
    } catch (error) {
      console.error('Error fetching component group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch component group',
      });
    }
  }

  /**
   * Get component group by code
   * GET /api/component-groups/code/:code
   */
  async getComponentGroupByCode(req: Request, res: Response) {
    try {
      const { code } = req.params;
      const componentGroup = await componentGroupService.getComponentGroupByCode(code);

      if (!componentGroup) {
        return res.status(404).json({
          success: false,
          message: 'Component group not found',
        });
      }

      res.json({
        success: true,
        data: componentGroup,
      });
    } catch (error) {
      console.error('Error fetching component group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch component group',
      });
    }
  }

  /**
   * Update component group
   * PUT /api/component-groups/:id
   */
  async updateComponentGroup(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = updateComponentGroupSchema.parse(req.body);

      const componentGroup = await componentGroupService.updateComponentGroup(id, validatedData);

      res.json({
        success: true,
        message: 'Component group updated successfully',
        data: componentGroup,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      if (error instanceof Error) {
        if (error.message === 'Component group not found') {
          return res.status(404).json({
            success: false,
            message: error.message,
          });
        }

        if (error.message.includes('already exists')) {
          return res.status(409).json({
            success: false,
            message: error.message,
          });
        }
      }

      console.error('Error updating component group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update component group',
      });
    }
  }

  /**
   * Delete component group (soft delete)
   * DELETE /api/component-groups/:id
   */
  async deleteComponentGroup(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const componentGroup = await componentGroupService.deleteComponentGroup(id);

      res.json({
        success: true,
        message: 'Component group deleted successfully',
        data: componentGroup,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Component group not found') {
          return res.status(404).json({
            success: false,
            message: error.message,
          });
        }

        if (error.message.includes('Cannot delete')) {
          return res.status(400).json({
            success: false,
            message: error.message,
          });
        }
      }

      console.error('Error deleting component group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete component group',
      });
    }
  }

  /**
   * Reorder component groups
   * POST /api/component-groups/reorder
   */
  async reorderComponentGroups(req: Request, res: Response) {
    try {
      const validatedData = reorderComponentGroupsSchema.parse(req.body);
      await componentGroupService.reorderComponentGroups(validatedData);

      res.json({
        success: true,
        message: 'Component groups reordered successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
      }

      console.error('Error reordering component groups:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reorder component groups',
      });
    }
  }

  /**
   * Get components in a specific group
   * GET /api/component-groups/:id/components
   */
  async getComponentsByGroup(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const components = await componentGroupService.getComponentsByGroup(id, isActive);

      res.json({
        success: true,
        data: components,
      });
    } catch (error) {
      console.error('Error fetching components by group:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch components',
      });
    }
  }
}

export const componentGroupController = new ComponentGroupController();
