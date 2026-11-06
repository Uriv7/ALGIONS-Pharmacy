/**
 * ALGIONS Pharmacy - RFC 7807 Problem Details
 */

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: ErrorCode;
  instance?: string;
  invalidParams?: { field: string; message: string }[];
  meta?: Record<string, unknown>;
}

export type ErrorCode =
  | 'STORE_MODE_BLOCKED'
  | 'INSUFFICIENT_STOCK'
  | 'BATCH_EXPIRED'
  | 'IDEMPOTENT_REPLAY'
  | 'SEQUENCE_GAP'
  | 'STEP_UP_REQUIRED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'DEVICE_REVOKED'
  | 'DEVICE_NOT_PRIMARY'
  | 'INVALID_CREDENTIALS'
  | 'DISCOUNT_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

export function createProblemDetails(
  status: number,
  code: ErrorCode,
  title: string,
  detail: string,
  extra?: Partial<ProblemDetails>
): ProblemDetails {
  return {
    type: `https://algions.com/errors/${code.toLowerCase()}`,
    title,
    status,
    detail,
    code,
    ...extra,
  };
}
