import { z } from 'zod';

export type AccountType = 'OWNER' | 'STAFF';

export const LoginRequestSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  deviceId: z.string().min(1, 'Device ID is required'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const MfaVerifyRequestSchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().min(6).max(8),
  deviceId: z.string().min(1),
});
export type MfaVerifyRequest = z.infer<typeof MfaVerifyRequestSchema>;

export const QuickUnlockSchema = z.object({
  pin: z.string().min(4).max(6),
  deviceId: z.string().min(1),
});
export type QuickUnlockRequest = z.infer<typeof QuickUnlockSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
  deviceId: z.string().min(1),
});
export type RefreshTokenRequest = z.infer<typeof RefreshTokenSchema>;

export const StepUpAuthSchema = z.object({
  password: z.string().optional(),
  mfaCode: z.string().optional(),
  reason: z.string().min(3),
});
export type StepUpAuthRequest = z.infer<typeof StepUpAuthSchema>;

export const CreateStaffUserSchema = z.object({
  username: z.string().min(3).max(30),
  name: z.string().min(1),
  password: z.string().min(10, 'Password must be at least 10 characters'),
  quickPin: z.string().length(4).regex(/^\d+$/).optional(),
  maxDiscountPercent: z.number().min(0).max(100).default(10),
});
export type CreateStaffUser = z.infer<typeof CreateStaffUserSchema>;

export const UpdateStaffUserSchema = z.object({
  name: z.string().min(1).optional(),
  password: z.string().min(10, 'Password must be at least 10 characters').optional().or(z.literal('')),
  quickPin: z.string().length(4).regex(/^\d+$/).optional().or(z.literal('')),
  maxDiscountPercent: z.number().min(0).max(100).optional(),
});
export type UpdateStaffUser = z.infer<typeof UpdateStaffUserSchema>;

export interface AuthSessionUser {
  id: string;
  username: string;
  name: string;
  accountType: AccountType;
  storeId: string;
  deviceId: string;
  maxDiscountPercent: number;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: AuthSessionUser;
  requiresMfa?: boolean;
  tempToken?: string;
}
