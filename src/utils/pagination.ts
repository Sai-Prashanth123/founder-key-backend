import { PAGINATION } from '@config/constants';
import { PaginationMeta, PaginationQuery } from '@appTypes/index';

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
  orderBy?: string;
  orderDir: 'asc' | 'desc';
}

export const parsePaginationQuery = (query: PaginationQuery): ParsedPagination => {
  const page = Math.max(1, Number(query.page) || PAGINATION.DEFAULT_PAGE);
  const rawLimit = Number(query.limit) || PAGINATION.DEFAULT_LIMIT;
  const limit = Math.min(Math.max(1, rawLimit), PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;
  const orderDir: 'asc' | 'desc' = query.orderDir === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    skip,
    orderBy: query.orderBy,
    orderDir,
  };
};

export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number
): PaginationMeta => {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};

export const getPrismaOrderBy = (
  orderBy?: string,
  orderDir: 'asc' | 'desc' = 'desc',
  allowedFields: string[] = ['createdAt', 'updatedAt']
): Record<string, 'asc' | 'desc'> => {
  const field = orderBy && allowedFields.includes(orderBy) ? orderBy : 'createdAt';
  return { [field]: orderDir };
};
