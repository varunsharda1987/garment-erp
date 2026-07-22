import { Request, Response } from 'express';
import { componentGroupService } from '../services/componentGroup.service';
import type {
  CreateComponentGroupInput,
  UpdateComponentGroupInput,
  ReorderComponentGroupsInput,
} from '../schemas/componentGroup.schema';
import { NotFoundError, ValidationError, ConflictError } from '../errors';

export class ComponentGroupController {
  /**
   * Create a new component group
   * POST /api/component-groups
   */
  async createComponentGroup(req: Request, res: Response) {
    try {
      // Body validated by validateBody(createComponentGroupSchema) at the route
      const validatedData = req.body as CreateComponentGroupInput;
      const componentGroup = await componentGroupService.createComponentGroup(validatedData);

      res.status(201).json({
        success: true,
        message: 'Component group created successfully',
        data: componentGroup,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          throw new ConflictError(error.message);
        }
      }

      throw error;
    }
  }

  /**
   * Get all component groups with pagination
   * GET /api/component-groups
   */
  async getComponentGroups(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string | undefined;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

    const result = await componentGroupService.getComponentGroups(page, limit, search, isActive);

    res.json({
      success: true,
      ...result,
    });
  }

  /**
   * Get component group by ID
   * GET /api/component-groups/:id
   */
  async getComponentGroupById(req: Request, res: Response) {
    const { id } = req.params;
    const componentGroup = await componentGroupService.getComponentGroupById(id);

    if (!componentGroup) {
      throw new NotFoundError('Component group', id);
    }

    res.json({
      success: true,
      data: componentGroup,
    });
  }

  /**
   * Get component group by code
   * GET /api/component-groups/code/:code
   */
  async getComponentGroupByCode(req: Request, res: Response) {
    const { code } = req.params;
    const componentGroup = await componentGroupService.getComponentGroupByCode(code);

    if (!componentGroup) {
      throw new NotFoundError('Component group', code);
    }

    res.json({
      success: true,
      data: componentGroup,
    });
  }

  /**
   * Update component group
   * PUT /api/component-groups/:id
   */
  async updateComponentGroup(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // Body validated by validateBody(updateComponentGroupSchema) at the route
      const validatedData = req.body as UpdateComponentGroupInput;

      const componentGroup = await componentGroupService.updateComponentGroup(id, validatedData);

      res.json({
        success: true,
        message: 'Component group updated successfully',
        data: componentGroup,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Component group not found') {
          throw new NotFoundError('Component group', req.params.id);
        }

        if (error.message.includes('already exists')) {
          throw new ConflictError(error.message);
        }
      }

      throw error;
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
          throw new NotFoundError('Component group', req.params.id);
        }

        if (error.message.includes('Cannot delete')) {
          throw new ValidationError(error.message);
        }
      }

      throw error;
    }
  }

  /**
   * Reorder component groups
   * POST /api/component-groups/reorder
   */
  async reorderComponentGroups(req: Request, res: Response) {
    // Body validated by validateBody(reorderComponentGroupsSchema) at the route
    const validatedData = req.body as ReorderComponentGroupsInput;
    await componentGroupService.reorderComponentGroups(validatedData);

    res.json({
      success: true,
      message: 'Component groups reordered successfully',
    });
  }

  /**
   * Get components in a specific group
   * GET /api/component-groups/:id/components
   */
  async getComponentsByGroup(req: Request, res: Response) {
    const { id } = req.params;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

    const components = await componentGroupService.getComponentsByGroup(id, isActive);

    res.json({
      success: true,
      data: components,
    });
  }
}

export const componentGroupController = new ComponentGroupController();
