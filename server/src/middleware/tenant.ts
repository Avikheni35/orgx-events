import { Request, Response, NextFunction } from 'express';
import { Tenant } from '../models/Tenant';

export async function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const code =
      (req.headers['x-tenant-code'] as string | undefined) ||
      req.hostname.split('.')[0];

    if (!code || code === 'localhost' || code === '127') {
      next();
      return;
    }

    const tenant = await Tenant.findOne({ loginCode: code }).select('_id').lean();
    if (tenant) req.tenantId = tenant._id.toString();
    next();
  } catch (err) {
    next(err);
  }
}
