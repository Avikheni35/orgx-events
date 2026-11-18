import { Schema, model, Document, Types } from 'mongoose';

export type EventTimesheetStatus = 'pending' | 'approved' | 'disputed';

export interface IEventTimesheet extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  eventId: Types.ObjectId;
  eventName: string;
  assignmentId: Types.ObjectId;
  staffProfileId: Types.ObjectId;
  staffName: string;
  clientId: Types.ObjectId;
  clientName: string;
  positionTitle: string;
  plannedStartTime: Date;
  plannedEndTime: Date;
  plannedBreakMinutes: number;
  actualStartTime?: Date;
  actualEndTime?: Date;
  actualBreakMinutes: number;
  totalHours: number;
  payRatePerHour: number;
  grossPay: number;
  taxRate: number;
  deductionsCents: number;
  netPay: number;
  billingRatePerHour?: number;
  breakTaken: boolean;
  ratingByCoordinator?: number;
  ratingNote?: string;
  status: EventTimesheetStatus;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  disputeReason?: string;
  // M3 sync
  syncStatus: 'not_configured' | 'pending' | 'synced' | 'failed';
  syncId?: string;
  syncedAt?: Date;
  syncError?: string;
  m3PayrollId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventTimesheetSchema = new Schema<IEventTimesheet>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    eventId: { type: Schema.Types.ObjectId, required: true, index: true },
    eventName: { type: String, required: true },
    assignmentId: { type: Schema.Types.ObjectId, required: true },
    staffProfileId: { type: Schema.Types.ObjectId, required: true, index: true },
    staffName: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, required: true },
    clientName: { type: String, required: true },
    positionTitle: { type: String, required: true },
    plannedStartTime: { type: Date, required: true },
    plannedEndTime: { type: Date, required: true },
    plannedBreakMinutes: { type: Number, default: 0 },
    actualStartTime: Date,
    actualEndTime: Date,
    actualBreakMinutes: { type: Number, default: 0 },
    totalHours: { type: Number, required: true },
    payRatePerHour: { type: Number, required: true },
    grossPay: { type: Number, required: true },
    taxRate: { type: Number, default: 0 },
    deductionsCents: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    billingRatePerHour: Number,
    breakTaken: { type: Boolean, default: false },
    ratingByCoordinator: { type: Number, min: 1, max: 5 },
    ratingNote: String,
    status: { type: String, enum: ['pending', 'approved', 'disputed'], default: 'pending' },
    approvedBy: Schema.Types.ObjectId,
    approvedAt: Date,
    disputeReason: String,
    syncStatus: { type: String, enum: ['not_configured', 'pending', 'synced', 'failed'], default: 'not_configured' },
    syncId: { type: String, sparse: true },
    syncedAt: Date,
    syncError: String,
    m3PayrollId: String,
  },
  { timestamps: true }
);

EventTimesheetSchema.index({ tenantId: 1, status: 1 });
EventTimesheetSchema.index({ assignmentId: 1 }, { unique: true });

export const EventTimesheet = model<IEventTimesheet>('EventTimesheet', EventTimesheetSchema);
