import {
  AuthSessionUser,
  SaleInvoiceDTO,
  StoreStatusResponse,
} from '@algions/contracts';

const API_BASE_URL = 'http://localhost:3001';

export class ApiClient {
  private token: string | null = null;
  private deviceId: string = 'dev-primary-01-0000-0000-000000000001';

  constructor() {
    this.token = localStorage.getItem('algions_pos_token');
    const storedDevice = localStorage.getItem('algions_pos_device_id');
    if (storedDevice) this.deviceId = storedDevice;
  }

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('algions_pos_token', token);
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('algions_pos_token');
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  setDeviceId(id: string): void {
    this.deviceId = id;
    localStorage.setItem('algions_pos_device_id', id);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errData;
      try {
        errData = await res.json();
      } catch {
        errData = { detail: res.statusText, code: 'HTTP_ERROR' };
      }
      const error: any = new Error(errData.detail || 'Request failed');
      error.code = errData.code;
      error.status = res.status;
      error.details = errData;
      throw error;
    }

    return res.json();
  }

  async login(username: string, password: string): Promise<{ accessToken: string; user: AuthSessionUser; requiresMfa?: boolean; tempToken?: string }> {
    const res = await this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, deviceId: this.deviceId }),
    });
    if (res.accessToken) {
      this.setToken(res.accessToken);
    }
    return res;
  }

  async verifyMfa(tempToken: string, code: string): Promise<{ accessToken: string; user: AuthSessionUser }> {
    const res = await this.request<any>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code, deviceId: this.deviceId }),
    });
    if (res.accessToken) {
      this.setToken(res.accessToken);
    }
    return res;
  }

  async quickUnlock(pin: string): Promise<{ accessToken: string; user: AuthSessionUser }> {
    const res = await this.request<any>('/auth/unlock', {
      method: 'POST',
      body: JSON.stringify({ pin, deviceId: this.deviceId }),
    });
    if (res.accessToken) {
      this.setToken(res.accessToken);
    }
    return res;
  }

  async getStoreStatus(): Promise<StoreStatusResponse> {
    return this.request<StoreStatusResponse>('/store/status');
  }

  async sendHeartbeat(sequence: number): Promise<any> {
    return this.request<any>('/devices/primary/heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: this.deviceId,
        timestamp: new Date().toISOString(),
        sequence,
      }),
    });
  }

  async searchProducts(q: string): Promise<{ results: any[] }> {
    return this.request<{ results: any[] }>(`/products/search?q=${encodeURIComponent(q)}`);
  }

  async createSale(payload: any, idempotencyKey: string): Promise<SaleInvoiceDTO> {
    return this.request<SaleInvoiceDTO>('/pos/sales', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
  }

  async getInvoices(): Promise<{ invoices: any[] }> {
    return this.request<{ invoices: any[] }>('/pos/invoices');
  }

  async getInvoice(id: string): Promise<SaleInvoiceDTO> {
    return this.request<SaleInvoiceDTO>(`/pos/invoices/${id}`);
  }

  async getBatches(): Promise<{ batches: any[] }> {
    return this.request<{ batches: any[] }>('/stock/batches');
  }

  async getExpiryList(thresholdDays = 90): Promise<any> {
    return this.request<any>(`/stock/expiry?thresholdDays=${thresholdDays}`);
  }

  async getHeldBills(): Promise<{ heldBills: any[] }> {
    return this.request<{ heldBills: any[] }>('/pos/holds');
  }

  async saveHeldBill(bill: any): Promise<any> {
    return this.request<any>('/pos/holds', {
      method: 'POST',
      body: JSON.stringify(bill),
    });
  }

  async deleteHeldBill(id: string): Promise<any> {
    return this.request<any>(`/pos/holds/${id}`, {
      method: 'DELETE',
    });
  }

  async getSuppliers(): Promise<{ suppliers: any[] }> {
    return this.request<{ suppliers: any[] }>('/suppliers');
  }

  async createPurchase(payload: any): Promise<any> {
    return this.request<any>('/purchases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async syncBatchEvents(events: any[]): Promise<any> {
    return this.request<any>('/sync/events:batch', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: this.deviceId,
        events,
      }),
    });
  }

  async getOwnerDashboard(): Promise<any> {
    return this.request<any>('/owner/dashboard');
  }

  async getReconciliationExceptions(): Promise<{ exceptions: any[] }> {
    return this.request<{ exceptions: any[] }>('/sync/exceptions');
  }

  async resolveException(id: string, payload: { resolutionNotes: string; action: string }): Promise<any> {
    return this.request<any>(`/sync/exceptions/${id}/resolve`, {
      method: 'POST',
      headers: {
        'X-Step-Up-Token': 'owner-authorized-session',
      },
      body: JSON.stringify(payload),
    });
  }

  async getStaffUsers(): Promise<{ users: any[] }> {
    return this.request<{ users: any[] }>('/owner/users');
  }

  async createStaffUser(user: any): Promise<any> {
    return this.request<any>('/owner/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async getAuditLogs(): Promise<{ logs: any[]; tamperCheckPassed: boolean }> {
    return this.request<{ logs: any[]; tamperCheckPassed: boolean }>('/owner/audit/logs');
  }

  async createSalesReturn(payload: {
    originalInvoiceId: string;
    items: { batchId: string; quantity: number; isSellable: boolean; returnReason: string }[];
  }): Promise<any> {
    return this.request<any>('/pos/returns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async voidInvoice(invoiceId: string, reason: string): Promise<any> {
    return this.request<any>(`/pos/sales/${invoiceId}/void`, {
      method: 'POST',
      headers: {
        'X-Step-Up-Token': 'owner-authorized-session',
      },
      body: JSON.stringify({ reason }),
    });
  }

  async getCustomers(query?: string): Promise<{ customers: any[] }> {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    return this.request<{ customers: any[] }>(`/customers${q}`);
  }

  async createCustomer(customer: any): Promise<any> {
    return this.request<any>('/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
  }

  async recordCustomerPayment(customerId: string, payload: { amountPaise: number; mode: string; notes?: string }): Promise<any> {
    return this.request<any>(`/customers/${customerId}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getDoctors(): Promise<{ doctors: any[] }> {
    return this.request<{ doctors: any[] }>('/doctors');
  }

  async createDoctor(doctor: any): Promise<any> {
    return this.request<any>('/doctors', {
      method: 'POST',
      body: JSON.stringify(doctor),
    });
  }

  async getDayBook(): Promise<{ dayBook: any[] }> {
    return this.request<{ dayBook: any[] }>('/accounting/day-book');
  }

  async getLedgers(): Promise<{ accounts: any[] }> {
    return this.request<{ accounts: any[] }>('/accounting/ledgers');
  }

  async getGstSummary(): Promise<any> {
    return this.request<any>('/accounting/gst-summary');
  }

  async createStockAdjustment(payload: {
    batchId: string;
    adjustmentType: string;
    deltaQuantity: number;
    reason: string;
  }): Promise<any> {
    return this.request<any>('/stock/adjustments', {
      method: 'POST',
      headers: {
        'X-Step-Up-Token': 'owner-authorized-session',
      },
      body: JSON.stringify(payload),
    });
  }

  async getProductsList(query?: string): Promise<{ products: any[] }> {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    return this.request<{ products: any[] }>(`/products${q}`);
  }

  async createProduct(product: any): Promise<any> {
    return this.request<any>('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  async updateProduct(id: string, product: any): Promise<any> {
    return this.request<any>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product),
    });
  }

  async deactivateProduct(id: string): Promise<any> {
    return this.request<any>(`/products/${id}`, {
      method: 'DELETE',
    });
  }

  async getSuppliersList(): Promise<{ suppliers: any[] }> {
    return this.request<{ suppliers: any[] }>('/suppliers');
  }

  async createSupplier(supplier: any): Promise<any> {
    return this.request<any>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplier),
    });
  }

  async recordSupplierPayment(supplierId: string, payload: { amountPaise: number; mode: string; notes?: string }): Promise<any> {
    return this.request<any>(`/suppliers/${supplierId}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getSalesReport(startDate?: string, endDate?: string): Promise<any> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<any>(`/owner/reports/sales${qs}`);
  }

  async getVelocityReport(): Promise<any> {
    return this.request<any>('/owner/reports/velocity');
  }

  async createExpense(payload: {
    category: string;
    payeeName: string;
    amountPaise: number;
    paymentMode: string;
    narration?: string;
  }): Promise<any> {
    return this.request<any>('/accounting/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getExpenses(): Promise<{ expenses: any[] }> {
    return this.request<{ expenses: any[] }>('/accounting/expenses');
  }

  async getScheduleH1Register(): Promise<{ register: any[] }> {
    return this.request<{ register: any[] }>('/accounting/registers/schedule-h1');
  }

  async getDevices(): Promise<{ devices: any[] }> {
    return this.request<{ devices: any[] }>('/devices');
  }

  async revokeDevice(deviceId: string, stepUpPinOrPassword?: string): Promise<any> {
    return this.request<any>(`/devices/${deviceId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ password: stepUpPinOrPassword || 'Owner@Algions2026!' }),
    });
  }

  async registerDevice(payload: {
    deviceName: string;
    enrolmentCode: string;
    publicKey: string;
    appVersion?: string;
  }): Promise<any> {
    return this.request<any>('/devices/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiClient();
