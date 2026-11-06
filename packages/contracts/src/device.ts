import { z } from 'zod';

export type StoreMode = 'ONLINE' | 'OFFLINE_STORE' | 'RECOVERY_SYNCING' | 'DEGRADED_CONFLICT';

export const RegisterDeviceSchema = z.object({
  enrolmentCode: z.string().min(6),
  deviceName: z.string().min(2),
  publicKey: z.string().min(10),
  appVersion: z.string().default('1.0.0'),
});
export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceSchema>;

export const DeviceHeartbeatSchema = z.object({
  deviceId: z.string().min(1),
  timestamp: z.string(),
  sequence: z.number().int().nonnegative(),
  signature: z.string().optional(),
});
export type DeviceHeartbeatRequest = z.infer<typeof DeviceHeartbeatSchema>;

export interface DeviceHeartbeatResponse {
  acknowledged: boolean;
  leaseExpiresAt: string;
  storeMode: StoreMode;
  isPrimary: boolean;
  serverTime: string;
}

export interface DeviceDTO {
  id: string;
  storeId: string;
  name: string;
  isPrimaryOffline: boolean;
  publicKey: string;
  lastHeartbeat: string | null;
  appVersion: string;
  isActive: boolean;
  createdAt: string;
}

export interface StoreStatusResponse {
  storeId: string;
  name: string;
  activeMode: StoreMode;
  primaryDeviceId: string | null;
  primaryLeaseExpiresAt: string | null;
  serverTime: string;
  pendingExceptionsCount: number;
}
