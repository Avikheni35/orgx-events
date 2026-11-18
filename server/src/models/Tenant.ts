import { Schema, model, Document, Types } from 'mongoose';

// Minimal Tenant model for M2 — connects to the SAME 'tenants' collection as M1.
// Only fields M2 needs for tenant resolution and branding.

export interface ITenant extends Document {
  _id: Types.ObjectId;
  name: string;
  loginCode: string;
  status: 'active' | 'inactive' | 'trial' | 'suspended';
  // Modules this tenant has subscribed to. Absence = both enabled (backward compat).
  enabledModules?: ('m1' | 'm2')[];
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    loginCode: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: ['active', 'inactive', 'trial', 'suspended'], default: 'trial' },
    enabledModules: [{ type: String, enum: ['m1', 'm2'] }],
  },
  { timestamps: true, collection: 'tenants', strict: false }
);

export const Tenant = model<ITenant>('Tenant', TenantSchema);
