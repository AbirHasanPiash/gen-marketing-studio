import { prisma } from '../lib/prisma.js';
import { ApiError } from './ApiError.js';

/** Load a brand and assert it belongs to the tenant, else 404. */
export async function ensureBrand(tenantId, brandId) {
  if (!brandId) throw ApiError.badRequest('brandId is required');
  const brand = await prisma.brandProfile.findFirst({ where: { id: brandId, tenantId } });
  if (!brand) throw ApiError.notFound('Brand not found');
  return brand;
}

/** Generic tenant-scoped findFirst that 404s if missing. */
export async function ensureOwned(model, tenantId, id, opts = {}) {
  const record = await prisma[model].findFirst({ where: { id, tenantId }, ...opts });
  if (!record) throw ApiError.notFound(`${model} not found`);
  return record;
}
