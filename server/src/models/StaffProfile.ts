import { Schema, model, Document, Types } from 'mongoose';

export type SyncStatus = 'not_configured' | 'pending' | 'synced' | 'failed';

export interface IStaffProfile extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId?: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  skills: string[];
  certifications: {
    _id: Types.ObjectId;
    name: string;
    issuer?: string;
    issuedDate?: Date;
    expiryDate?: Date;
  }[];
  ibanEncrypted?: string;
  photoUrl?: string;
  rating: { average: number; count: number };
  totalEventsWorked: number;
  totalHoursWorked: number;
  status: 'active' | 'inactive';
  directAssignable: boolean;
  notes?: string;
  poolIds: Types.ObjectId[];
  createdBy: Types.ObjectId;
  workerId?: Types.ObjectId;
  // Payroll fields (set by HR)
  taxRate: number;           // e.g. 0.19 = 19%
  contractType: 'monthly' | 'per-event';
  deductions: { name: string; amountCents: number }[];
  // M3 sync
  syncStatus: SyncStatus;
  syncId?: string;
  syncedAt?: Date;
  syncError?: string;
  m3EmployeeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StaffProfileSchema = new Schema<IStaffProfile>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String,
    skills: [{ type: String }],
    certifications: [
      {
        name: { type: String, required: true },
        issuer: String,
        issuedDate: Date,
        expiryDate: Date,
      },
    ],
    ibanEncrypted: String,
    photoUrl: String,
    rating: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    totalEventsWorked: { type: Number, default: 0 },
    totalHoursWorked: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    directAssignable: { type: Boolean, default: false },
    notes: String,
    poolIds: [{ type: Schema.Types.ObjectId, ref: 'StaffPool' }],
    createdBy: { type: Schema.Types.ObjectId, required: true },
    workerId: { type: Schema.Types.ObjectId },
    taxRate: { type: Number, default: 0, min: 0, max: 1 },
    contractType: { type: String, enum: ['monthly', 'per-event'], default: 'per-event' },
    deductions: [{ name: { type: String, required: true }, amountCents: { type: Number, required: true } }],
    syncStatus: { type: String, enum: ['not_configured', 'pending', 'synced', 'failed'], default: 'not_configured' },
    syncId: { type: String, sparse: true },
    syncedAt: Date,
    syncError: String,
    m3EmployeeId: String,
  },
  { timestamps: true }
);

StaffProfileSchema.index({ tenantId: 1, status: 1 });
StaffProfileSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const StaffProfile = model<IStaffProfile>('StaffProfile', StaffProfileSchema);
