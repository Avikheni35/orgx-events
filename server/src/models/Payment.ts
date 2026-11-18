import { Schema, model, Types } from 'mongoose';

export interface IPayment {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  staffProfileId: Types.ObjectId;
  staffName: string;

  year: number;
  month: number; // 1–12

  // Pulled from approved timesheets for this month
  totalHoursWorked: number;
  totalEventsWorked: number;
  basePayFromTimesheets: number;

  // Editable by coordinator
  basePay: number;            // defaults to basePayFromTimesheets; coordinator can override
  bonus: number;
  deductions: number;
  totalAmount: number;        // basePay + bonus - deductions

  status: 'pending' | 'paid';
  paidAt?: Date;
  paidByUserId?: Types.ObjectId;
  notes?: string;
  // Partial payment tracking
  paidHours?: number;
  totalHours?: number;
  carryForwardHours?: number;
  // M3 integration
  source: 'm2' | 'm3';
  syncStatus: 'not_configured' | 'pending' | 'synced' | 'failed';
  syncId?: string;
  syncedAt?: Date;
  syncError?: string;
  m3JournalEntryId?: string;

  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    tenantId:           { type: Schema.Types.ObjectId, required: true, index: true },
    staffProfileId:     { type: Schema.Types.ObjectId, required: true },
    staffName:          { type: String, required: true },

    year:               { type: Number, required: true },
    month:              { type: Number, required: true, min: 1, max: 12 },

    totalHoursWorked:   { type: Number, default: 0 },
    totalEventsWorked:  { type: Number, default: 0 },
    basePayFromTimesheets: { type: Number, default: 0 },

    basePay:            { type: Number, default: 0 },
    bonus:              { type: Number, default: 0 },
    deductions:         { type: Number, default: 0 },
    totalAmount:        { type: Number, default: 0 },

    status:             { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paidAt:             { type: Date },
    paidByUserId:       { type: Schema.Types.ObjectId },
    notes:              { type: String },
    paidHours:          { type: Number },
    totalHours:         { type: Number },
    carryForwardHours:  { type: Number },
    source:             { type: String, enum: ['m2', 'm3'], default: 'm2' },
    syncStatus:         { type: String, enum: ['not_configured', 'pending', 'synced', 'failed'], default: 'not_configured' },
    syncId:             { type: String, sparse: true },
    syncedAt:           Date,
    syncError:          String,
    m3JournalEntryId:   String,
  },
  { timestamps: true }
);

// One record per staff per month per tenant
PaymentSchema.index({ tenantId: 1, staffProfileId: 1, year: 1, month: 1 }, { unique: true });

export const Payment = model<IPayment>('Payment', PaymentSchema);
