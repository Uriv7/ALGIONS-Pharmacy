import { Request, Response, NextFunction } from 'express';
import { ProblemDetails, createProblemDetails } from '@algions/contracts';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: ProblemDetails['code'],
    public title: string,
    public detail: string,
    public meta?: Record<string, unknown>
  ) {
    super(detail);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  if (err instanceof AppError) {
    const problem = createProblemDetails(err.status, err.code, err.title, err.detail, {
      instance: req.originalUrl,
      meta: err.meta,
    });
    res.status(err.status).json(problem);
    return;
  }

  if (err.name === 'ZodError') {
    const zodErr = err as any;
    const problem = createProblemDetails(
      400,
      'VALIDATION_ERROR',
      'Validation Failed',
      'The request payload failed schema validation.',
      {
        instance: req.originalUrl,
        invalidParams: zodErr.issues?.map((i: any) => ({ field: i.path.join('.'), message: i.message })),
      }
    );
    res.status(400).json(problem);
    return;
  }

  // Unhandled error
  console.error('[UNHANDLED_ERROR]', err);
  const internalProblem = createProblemDetails(
    500,
    'INTERNAL_ERROR',
    'Internal Server Error',
    'An unexpected error occurred while processing the request.',
    { instance: req.originalUrl }
  );
  res.status(500).json(internalProblem);
}
