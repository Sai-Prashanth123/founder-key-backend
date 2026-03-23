import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '@utils/errors';

type ValidationSource = 'body' | 'query' | 'params';

export const validate = (schema: ZodSchema, source: ValidationSource = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      throw new ValidationError(errors);
    }

    // Replace the source data with validated/transformed data
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    req[source] = result.data;
    next();
  };
};

const formatZodErrors = (error: ZodError): Array<{ field: string; message: string }> => {
  return error.errors.map((err) => ({
    field: err.path.join('.') || 'value',
    message: err.message,
  }));
};

export const validateAll = (
  schemas: Partial<Record<ValidationSource, ZodSchema>>
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const allErrors: Array<{ field: string; message: string }> = [];

    for (const [source, schema] of Object.entries(schemas)) {
      const src = source as ValidationSource;
      const result = schema.safeParse(req[src]);

      if (!result.success) {
        allErrors.push(...formatZodErrors(result.error));
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        req[src] = result.data;
      }
    }

    if (allErrors.length > 0) {
      throw new ValidationError(allErrors);
    }

    next();
  };
};
