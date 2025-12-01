import { APIRequestContext } from '@playwright/test';
import { TestConfig } from '../config/test-config';

/**
 * API Helper
 * Provides direct API calls for fast test data setup and teardown
 */

export class APIHelper {
  private token: string | null = null;

  constructor(private request: APIRequestContext) {}

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Get default headers with authentication
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Register a new user
   */
  async register(name: string, email: string, password: string): Promise<{ token: string; user: any }> {
    const response = await this.request.post(`${TestConfig.apiURL}/auth/register`, {
      data: { name, email, password },
    });

    if (!response.ok()) {
      throw new Error(`Registration failed: ${response.status()}`);
    }

    const data = await response.json();
    this.token = data.token || data.data?.token;
    return { token: this.token!, user: data.user || data.data?.user };
  }

  /**
   * Login with existing credentials
   */
  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    const response = await this.request.post(`${TestConfig.apiURL}/auth/login`, {
      data: { email, password },
    });

    if (!response.ok()) {
      throw new Error(`Login failed: ${response.status()}`);
    }

    const data = await response.json();
    this.token = data.token || data.data?.token;
    return { token: this.token!, user: data.user || data.data?.user };
  }

  // ============================================
  // CUSTOMER API
  // ============================================

  async createCustomer(data: Record<string, any>): Promise<{ id: string; data: any }> {
    const response = await this.request.post(`${TestConfig.apiURL}/customers`, {
      data,
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Create customer failed: ${response.status()} - ${error}`);
    }

    const result = await response.json();
    return { id: result.data?.id || result.id, data: result.data || result };
  }

  async getCustomer(id: string): Promise<any> {
    const response = await this.request.get(`${TestConfig.apiURL}/customers/${id}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Get customer failed: ${response.status()}`);
    }

    const result = await response.json();
    return result.data || result;
  }

  async updateCustomer(id: string, data: Record<string, any>): Promise<any> {
    const response = await this.request.put(`${TestConfig.apiURL}/customers/${id}`, {
      data,
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Update customer failed: ${response.status()}`);
    }

    const result = await response.json();
    return result.data || result;
  }

  async deleteCustomer(id: string): Promise<void> {
    const response = await this.request.delete(`${TestConfig.apiURL}/customers/${id}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Delete customer failed: ${response.status()}`);
    }
  }

  async listCustomers(params?: { page?: number; limit?: number; search?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', String(params.page));
    if (params?.limit) queryParams.set('limit', String(params.limit));
    if (params?.search) queryParams.set('search', params.search);

    const url = `${TestConfig.apiURL}/customers?${queryParams.toString()}`;
    const response = await this.request.get(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`List customers failed: ${response.status()}`);
    }

    return await response.json();
  }

  // ============================================
  // SUPPLIER API
  // ============================================

  async createSupplier(data: Record<string, any>): Promise<{ id: string; data: any }> {
    const response = await this.request.post(`${TestConfig.apiURL}/suppliers`, {
      data,
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Create supplier failed: ${response.status()} - ${error}`);
    }

    const result = await response.json();
    return { id: result.data?.id || result.id, data: result.data || result };
  }

  async deleteSupplier(id: string): Promise<void> {
    const response = await this.request.delete(`${TestConfig.apiURL}/suppliers/${id}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Delete supplier failed: ${response.status()}`);
    }
  }

  // ============================================
  // MATERIAL API
  // ============================================

  async createMaterial(data: Record<string, any>): Promise<{ id: string; data: any }> {
    const response = await this.request.post(`${TestConfig.apiURL}/materials`, {
      data,
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Create material failed: ${response.status()} - ${error}`);
    }

    const result = await response.json();
    return { id: result.data?.id || result.id, data: result.data || result };
  }

  async deleteMaterial(id: string): Promise<void> {
    const response = await this.request.delete(`${TestConfig.apiURL}/materials/${id}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Delete material failed: ${response.status()}`);
    }
  }

  // ============================================
  // STYLE API
  // ============================================

  async createStyle(data: Record<string, any>): Promise<{ id: string; data: any }> {
    const response = await this.request.post(`${TestConfig.apiURL}/styles`, {
      data,
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Create style failed: ${response.status()} - ${error}`);
    }

    const result = await response.json();
    return { id: result.data?.id || result.id, data: result.data || result };
  }

  async deleteStyle(id: string): Promise<void> {
    const response = await this.request.delete(`${TestConfig.apiURL}/styles/${id}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Delete style failed: ${response.status()}`);
    }
  }

  // ============================================
  // ORDER API
  // ============================================

  async createOrder(data: Record<string, any>): Promise<{ id: string; data: any }> {
    const response = await this.request.post(`${TestConfig.apiURL}/orders`, {
      data,
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Create order failed: ${response.status()} - ${error}`);
    }

    const result = await response.json();
    return { id: result.data?.id || result.id, data: result.data || result };
  }

  async deleteOrder(id: string): Promise<void> {
    const response = await this.request.delete(`${TestConfig.apiURL}/orders/${id}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Delete order failed: ${response.status()}`);
    }
  }

  // ============================================
  // WAREHOUSE API
  // ============================================

  async createWarehouse(data: Record<string, any>): Promise<{ id: string; data: any }> {
    const response = await this.request.post(`${TestConfig.apiURL}/warehouses`, {
      data,
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Create warehouse failed: ${response.status()} - ${error}`);
    }

    const result = await response.json();
    return { id: result.data?.id || result.id, data: result.data || result };
  }

  async deleteWarehouse(id: string): Promise<void> {
    const response = await this.request.delete(`${TestConfig.apiURL}/warehouses/${id}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Delete warehouse failed: ${response.status()}`);
    }
  }

  // ============================================
  // PURCHASE ORDER API
  // ============================================

  async createPurchaseOrder(data: Record<string, any>): Promise<{ id: string; data: any }> {
    const response = await this.request.post(`${TestConfig.apiURL}/purchase-orders`, {
      data,
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Create purchase order failed: ${response.status()} - ${error}`);
    }

    const result = await response.json();
    return { id: result.data?.id || result.id, data: result.data || result };
  }

  async deletePurchaseOrder(id: string): Promise<void> {
    const response = await this.request.delete(`${TestConfig.apiURL}/purchase-orders/${id}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Delete purchase order failed: ${response.status()}`);
    }
  }

  // ============================================
  // BOM API
  // ============================================

  async createBOM(data: Record<string, any>): Promise<{ id: string; data: any }> {
    const response = await this.request.post(`${TestConfig.apiURL}/bom`, {
      data,
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Create BOM failed: ${response.status()} - ${error}`);
    }

    const result = await response.json();
    return { id: result.data?.id || result.id, data: result.data || result };
  }

  async deleteBOM(id: string): Promise<void> {
    const response = await this.request.delete(`${TestConfig.apiURL}/bom/${id}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Delete BOM failed: ${response.status()}`);
    }
  }

  // ============================================
  // WORK ORDER API
  // ============================================

  async createWorkOrder(data: Record<string, any>): Promise<{ id: string; data: any }> {
    const response = await this.request.post(`${TestConfig.apiURL}/work-orders`, {
      data,
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      const error = await response.text();
      throw new Error(`Create work order failed: ${response.status()} - ${error}`);
    }

    const result = await response.json();
    return { id: result.data?.id || result.id, data: result.data || result };
  }

  async deleteWorkOrder(id: string): Promise<void> {
    const response = await this.request.delete(`${TestConfig.apiURL}/work-orders/${id}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok()) {
      throw new Error(`Delete work order failed: ${response.status()}`);
    }
  }
}

/**
 * Factory function to create an API helper
 */
export function createAPIHelper(request: APIRequestContext): APIHelper {
  return new APIHelper(request);
}

export default APIHelper;
