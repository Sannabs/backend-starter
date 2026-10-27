import { z } from "zod";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export const getPagination = (query: Record<string, unknown>): Pagination => {
  const page = Math.max(Number(query.page) || 1, 1);
  // Clamped at both ends — a negative limit reaches Prisma as a negative `take`.
  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  return { page, limit, skip: (page - 1) * limit };
};

export const paginated = <T>(data: T[], total: number, { page, limit }: Pagination) => ({
  data,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
  },
});
