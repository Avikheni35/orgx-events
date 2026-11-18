import { Schema, model, Document, Types } from 'mongoose';

export type AssignmentStatus = 'invited' | 'confirmed' | 'declined' | 'no_show' | 'worked' | 'cancelled';

export interface IEventStaffAssignment extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  eventId: Types.ObjectId;
  eventName: string;
  positionId: Types.ObjectId;
  positionTitle: string;
  slotId: Types.ObjectId;
  slotStart: Date;
  slotEnd: Date;
  staffProfileId: Types.ObjectId;
  staffName: string;
  staffEmail: string;
  payRatePerHour: number;
  billingRatePerHour?: number;
  status: AssignmentStatus;
  inviteToken?: string;
  inviteExpires?: Date;
  staffNote?: string;
  checkInTime?: Date;
  checkInLocation?: { lat: number; lng: number };
  checkOutTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  actualBreakMinutes: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IEventStaffAssignment>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    eventId: { type: Schema.Types.ObjectId, required: true, index: true },
    eventName: { type: String, required: true },
    positionId: { type: Schema.Types.ObjectId, required: true },
    positionTitle: { type: String, required: true },
    slotId: { type: Schema.Types.ObjectId, required: true },
    slotStart: { type: Date, required: true },
    slotEnd: { type: Date, required: true },
    staffProfileId: { type: Schema.Types.ObjectId, required: true, index: true },
    staffName: { type: String, required: true },
    staffEmail: { type: String, required: true },
    payRatePerHour: { type: Number, required: true },
    billingRatePerHour: Number,
    status: {
      type: String,
      enum: ['invited', 'confirmed', 'declined', 'no_show', 'worked', 'cancelled'],
      default: 'invited',
    },
    inviteToken: String,
    inviteExpires: Date,
    staffNote: String,
    checkInTime: Date,
    checkInLocation: { lat: Number, lng: Number },
    checkOutTime: Date,
    actualStartTime: Date,
    actualEndTime: Date,
    actualBreakMinutes: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

// Prevent duplicate assignment of same staff to same slot
AssignmentSchema.index(
  { tenantId: 1, eventId: 1, slotId: 1, staffProfileId: 1 },
  { unique: true, partialFilterExpression: { status: { $nin: ['declined', 'cancelled'] } } }
);

export const EventStaffAssignment = model<IEventStaffAssignment>('EventStaffAssignment', AssignmentSchema);
