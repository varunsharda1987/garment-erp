import api from '../lib/api';

interface BlockerInfo {
  type: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface StageTransitionValidation {
  isBlocked: boolean;
  blockers: BlockerInfo[];
  canProceed: boolean;
}

interface SampleCreationValidation {
  canCreate: boolean;
  blocker: {
    message: string;
    prerequisiteType: string;
  } | null;
}

interface OverrideHistoryItem {
  id: string;
  blockType: string;
  workOrderId?: string;
  orderItemId?: string;
  sampleId?: string;
  fromStage?: string;
  toStage?: string;
  blockedSampleType?: string;
  prerequisiteSampleType?: string;
  overrideReason: string;
  overriddenById: string;
  overriddenAt: string;
  overriddenBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  workOrder?: {
    id: string;
    workOrderNumber: string;
  };
  sample?: {
    id: string;
    sampleNumber: string;
    sampleType: string;
  };
}

class StageValidationService {
  /**
   * Check if a stage transition is allowed
   * @param workOrderId - Work order ID
   * @param targetStage - Target production stage (e.g., 'IN_CUTTING', 'IN_PRINTING')
   * @returns Validation result with blockers
   */
  async checkStageTransition(workOrderId: string, targetStage: string): Promise<StageTransitionValidation> {
    try {
      const response = await api.get('/stage-validation/check', {
        params: { workOrderId, targetStage },
      });
      return response.data.data;
    } catch (error: unknown) {
      console.error('Error checking stage transition:', error);
      throw error;
    }
  }

  /**
   * Check if sample creation is allowed (sequential dependencies)
   * @param styleId - Style ID
   * @param sampleType - Sample type (PP_SAMPLE, SIZE_SET_SAMPLE, etc.)
   * @returns Validation result
   */
  async checkSampleCreation(styleId: string, sampleType: string): Promise<SampleCreationValidation> {
    try {
      const response = await api.get('/stage-validation/check-sample-creation', {
        params: { styleId, sampleType },
      });
      return response.data.data;
    } catch (error: unknown) {
      console.error('Error checking sample creation:', error);
      throw error;
    }
  }

  /**
   * Get override history (admin only)
   * @param workOrderId - Optional work order ID filter
   * @param sampleId - Optional sample ID filter
   * @param limit - Max records to return (default: 50)
   * @returns Override history records
   */
  async getOverrideHistory(
    workOrderId?: string,
    sampleId?: string,
    limit: number = 50
  ): Promise<OverrideHistoryItem[]> {
    try {
      const response = await api.get('/stage-validation/override-history', {
        params: { workOrderId, sampleId, limit },
      });
      return response.data.data;
    } catch (error: unknown) {
      console.error('Error fetching override history:', error);
      throw error;
    }
  }
}

export const stageValidationService = new StageValidationService();
export default stageValidationService;
