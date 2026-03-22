import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { CreateTestTemplateInput, UpdateTestTemplateInput, TestTemplateQueryOptions } from '../types/testing.types';
import { AppError, NotFoundError, ConflictError, InternalError } from '../errors';

class TestTemplatesService {
  /**
   * Create a new test template
   */
  async createTemplate(data: CreateTestTemplateInput, userId: string): Promise<any> {
    try {
      // Check if template code already exists
      const existingTemplate = await prisma.test_templates.findFirst({
        where: { templateCode: data.templateCode, isActive: true },
      });

      if (existingTemplate) {
        throw new ConflictError('Template code already exists');
      }

      // Create template
      const template = await prisma.test_templates.create({
        data: {
          templateCode: data.templateCode,
          templateName: data.templateName,
          templateType: data.templateType,
          requiredParams: JSON.stringify(data.requiredParams),
          optionalParams: data.optionalParams ? JSON.stringify(data.optionalParams) : undefined,
          toleranceRanges: data.toleranceRanges ? JSON.stringify(data.toleranceRanges) : undefined,
          description: data.description || null,
          testingStandards: data.testingStandards || null,
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

      return this.formatTemplateResponse(template);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to create test template');
    }
  }

  /**
   * Get all templates with pagination and filters
   */
  async getAllTemplates(options: TestTemplateQueryOptions): Promise<any> {
    const { page = 1, limit = 20, search, templateType, isActive } = options;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.test_templatesWhereInput = {};

    if (search) {
      where.OR = [
        { templateCode: { contains: search, mode: 'insensitive' } },
        { templateName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (templateType) {
      where.templateType = templateType;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    try {
      const [templates, total] = await Promise.all([
        prisma.test_templates.findMany({
          where,
          skip,
          take: limit,
          orderBy: { templateCode: 'asc' },
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
                customersFPT: true,
                customersGPT: true,
              },
            },
          },
        }),
        prisma.test_templates.count({ where }),
      ]);

      return {
        data: templates.map((template) => this.formatTemplateResponse(template)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Test Templates Service Error Details:', error);
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to fetch test templates');
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<any> {
    try {
      const template = await prisma.test_templates.findUnique({
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
              customersFPT: true,
              customersGPT: true,
            },
          },
        },
      });

      if (!template) {
        throw new NotFoundError('Test template not found');
      }

      return this.formatTemplateResponse(template);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to fetch test template');
    }
  }

  /**
   * Update template
   */
  async updateTemplate(id: string, data: UpdateTestTemplateInput): Promise<any> {
    try {
      // Check if template exists
      const existingTemplate = await prisma.test_templates.findUnique({
        where: { id },
      });

      if (!existingTemplate) {
        throw new NotFoundError('Test template not found');
      }

      // If updating template code, check for duplicates
      if (data.templateCode && data.templateCode !== existingTemplate.templateCode) {
        const duplicate = await prisma.test_templates.findFirst({
          where: { templateCode: data.templateCode, isActive: true },
        });

        if (duplicate) {
          throw new ConflictError('Template code already exists');
        }
      }

      // Update template
      const updatedTemplate = await prisma.test_templates.update({
        where: { id },
        data: {
          templateCode: data.templateCode,
          templateName: data.templateName,
          templateType: data.templateType,
          requiredParams: data.requiredParams ? JSON.stringify(data.requiredParams) : undefined,
          optionalParams: data.optionalParams ? JSON.stringify(data.optionalParams) : undefined,
          toleranceRanges: data.toleranceRanges ? JSON.stringify(data.toleranceRanges) : undefined,
          description: data.description,
          testingStandards: data.testingStandards,
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

      return this.formatTemplateResponse(updatedTemplate);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to update test template');
    }
  }

  /**
   * Delete template (soft delete by setting isActive = false)
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      // Check if template exists
      const template = await prisma.test_templates.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              customersFPT: true,
              customersGPT: true,
            },
          },
        },
      });

      if (!template) {
        throw new NotFoundError('Test template not found');
      }

      // Check if template is in use
      if (template._count.customersFPT > 0 || template._count.customersGPT > 0) {
        // Soft delete only
        await prisma.test_templates.update({
          where: { id },
          data: { isActive: false },
        });
      } else {
        // Hard delete if not in use
        await prisma.test_templates.delete({
          where: { id },
        });
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError('Failed to delete test template');
    }
  }

  /**
   * Format template response (parse JSON fields)
   */
  private formatTemplateResponse(template: any): any {
    return {
      ...template,
      requiredParams: template.requiredParams ? JSON.parse(template.requiredParams) : [],
      optionalParams: template.optionalParams ? JSON.parse(template.optionalParams) : null,
      toleranceRanges: template.toleranceRanges ? JSON.parse(template.toleranceRanges) : null,
    };
  }
}

export const testTemplatesService = new TestTemplatesService();
