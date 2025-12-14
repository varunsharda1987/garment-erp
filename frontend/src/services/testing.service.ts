import api from '@/lib/api';
import type {
  TestingLab,
  CreateTestingLabInput,
  UpdateTestingLabInput,
  TestTemplate,
  CreateTestTemplateInput,
  UpdateTestTemplateInput,
  FabricPhysicalTest,
  CreateFabricPhysicalTestInput,
  UpdateFabricPhysicalTestInput,
  GarmentPhysicalTest,
  CreateGarmentPhysicalTestInput,
  UpdateGarmentPhysicalTestInput,
  PaginatedResponse,
  ApiResponse,
} from '@/types/testing.types';

// ============================================================================
// TESTING LABS SERVICE
// ============================================================================

export const testingLabsService = {
  getAll: async (params?: Record<string, any>): Promise<PaginatedResponse<TestingLab>> => {
    const { data } = await api.get('/testing-labs', { params });
    return data;
  },

  getById: async (id: string): Promise<ApiResponse<TestingLab>> => {
    const { data } = await api.get(`/testing-labs/${id}`);
    return data;
  },

  getStats: async (id: string): Promise<ApiResponse<any>> => {
    const { data } = await api.get(`/testing-labs/${id}/stats`);
    return data;
  },

  create: async (input: CreateTestingLabInput): Promise<ApiResponse<TestingLab>> => {
    const { data } = await api.post('/testing-labs', input);
    return data;
  },

  update: async (id: string, input: UpdateTestingLabInput): Promise<ApiResponse<TestingLab>> => {
    const { data } = await api.put(`/testing-labs/${id}`, input);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/testing-labs/${id}`);
  },
};

// ============================================================================
// TEST TEMPLATES SERVICE
// ============================================================================

export const testTemplatesService = {
  getAll: async (params?: Record<string, any>): Promise<PaginatedResponse<TestTemplate>> => {
    const { data } = await api.get('/test-templates', { params });
    return data;
  },

  getById: async (id: string): Promise<ApiResponse<TestTemplate>> => {
    const { data } = await api.get(`/test-templates/${id}`);
    return data;
  },

  create: async (input: CreateTestTemplateInput): Promise<ApiResponse<TestTemplate>> => {
    const { data } = await api.post('/test-templates', input);
    return data;
  },

  update: async (id: string, input: UpdateTestTemplateInput): Promise<ApiResponse<TestTemplate>> => {
    const { data } = await api.put(`/test-templates/${id}`, input);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/test-templates/${id}`);
  },
};

// ============================================================================
// FABRIC PHYSICAL TESTS SERVICE
// ============================================================================

export const fabricPhysicalTestsService = {
  getAll: async (params?: Record<string, any>): Promise<PaginatedResponse<FabricPhysicalTest>> => {
    const { data } = await api.get('/fabric-physical-tests', { params });
    return data;
  },

  getById: async (id: string): Promise<ApiResponse<FabricPhysicalTest>> => {
    const { data } = await api.get(`/fabric-physical-tests/${id}`);
    return data;
  },

  create: async (input: CreateFabricPhysicalTestInput): Promise<ApiResponse<FabricPhysicalTest>> => {
    const { data } = await api.post('/fabric-physical-tests', input);
    return data;
  },

  update: async (id: string, input: UpdateFabricPhysicalTestInput): Promise<ApiResponse<FabricPhysicalTest>> => {
    const { data } = await api.put(`/fabric-physical-tests/${id}`, input);
    return data;
  },

  createRetest: async (input: {
    originalTestId: string;
    retestReason: string;
    sentToLabDate?: string;
    testingLabId?: string;
    sampleQuantity?: number;
  }): Promise<ApiResponse<FabricPhysicalTest>> => {
    const { data } = await api.post('/fabric-physical-tests/retest', input);
    return data;
  },

  approve: async (
    id: string,
    input: { adminOverride?: boolean; overrideReason?: string }
  ): Promise<ApiResponse<FabricPhysicalTest>> => {
    const { data } = await api.post(`/fabric-physical-tests/${id}/approve`, input);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/fabric-physical-tests/${id}`);
  },
};

// ============================================================================
// GARMENT PHYSICAL TESTS SERVICE
// ============================================================================

export const garmentPhysicalTestsService = {
  getAll: async (params?: Record<string, any>): Promise<PaginatedResponse<GarmentPhysicalTest>> => {
    const { data } = await api.get('/garment-physical-tests', { params });
    return data;
  },

  getById: async (id: string): Promise<ApiResponse<GarmentPhysicalTest>> => {
    const { data } = await api.get(`/garment-physical-tests/${id}`);
    return data;
  },

  create: async (input: CreateGarmentPhysicalTestInput): Promise<ApiResponse<GarmentPhysicalTest>> => {
    const { data } = await api.post('/garment-physical-tests', input);
    return data;
  },

  update: async (id: string, input: UpdateGarmentPhysicalTestInput): Promise<ApiResponse<GarmentPhysicalTest>> => {
    const { data } = await api.put(`/garment-physical-tests/${id}`, input);
    return data;
  },

  createRetest: async (input: {
    originalTestId: string;
    retestReason: string;
    sentToLabDate?: string;
    testingLabId?: string;
    sampleQuantity?: number;
  }): Promise<ApiResponse<GarmentPhysicalTest>> => {
    const { data } = await api.post('/garment-physical-tests/retest', input);
    return data;
  },

  approve: async (
    id: string,
    input: { adminOverride?: boolean; overrideReason?: string }
  ): Promise<ApiResponse<GarmentPhysicalTest>> => {
    const { data } = await api.post(`/garment-physical-tests/${id}/approve`, input);
    return data;
  },

  buyerApprove: async (
    id: string,
    input: { buyerRemarks?: string }
  ): Promise<ApiResponse<GarmentPhysicalTest>> => {
    const { data } = await api.post(`/garment-physical-tests/${id}/buyer-approve`, input);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/garment-physical-tests/${id}`);
  },
};
