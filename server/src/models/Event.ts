import { Schema, model, Document, Types } from 'mongoose';

export type EventStatus = 'draft' | 'planning' | 'staffing' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface IEventTimeSlot {
  _id: Types.ObjectId;
  startTime: Date;
  endTime: Date;
  breakMinutes: number;
  notes?: string;
}

export interface IEventPosition {
  _id: Types.ObjectId;
  title: string;
  roleType?: string;
  headcount: number;
  skills: string[];
  payRatePerHour: number;
  billingRatePerHour?: number;
  dresscode?: string;
  notes?: string;
  slots: IEventTimeSlot[];
}

export interface IEventNote {
  _id: Types.ObjectId;
  text: string;
  createdBy: Types.ObjectId;
  createdByName: string;
  createdAt: Date;
}

export interface IEvent extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  eventNumber: string;
  clientId: Types.ObjectId;
  clientName: string;
  venueId?: Types.ObjectId;
  venueName?: string;
  type: 'conference' | 'concert' | 'corporate' | 'wedding' | 'trade_show' | 'festival' | 'sports' | 'other';
  startDate: Date;
  endDate: Date;
  description?: string;
  budget?: number;
  plannedRevenue?: number;
  status: EventStatus;
  positions: IEventPosition[];
  notes: IEventNote[];
  documents: { name: string; fileUrl: string; uploadedAt: Date }[];
  requiresClientApproval: boolean;
  clientApprovedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  reportEmailedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const timeSlotSchema = new Schema<IEventTimeSlot>(
  {
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    breakMinutes: { type: Number, default: 0 },
    notes: String,
  },
  { _id: true }
);

const positionSchema = new Schema<IEventPosition>(
  {
    title: { type: String, required: true },
    roleType: String,
    headcount: { type: Number, required: true, min: 1 },
    skills: [{ type: String }],
    payRatePerHour: { type: Number, required: true },
    billingRatePerHour: Number,
    dresscode: String,
    notes: String,
    slots: [timeSlotSchema],
  },
  { _id: true }
);

const noteSchema = new Schema<IEventNote>(
  {
    text: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    createdByName: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const EventSchema = new Schema<IEvent>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    eventNumber: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, required: true },
    clientName: { type: String, required: true },
    venueId: Schema.Types.ObjectId,
    venueName: String,
    type: {
      type: String,
      enum: ['conference', 'concert', 'corporate', 'wedding', 'trade_show', 'festival', 'sports', 'other'],
      default: 'corporate',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    description: String,
    budget: Number,
    plannedRevenue: Number,
    status: {
      type: String,
      enum: ['draft', 'planning', 'staffing', 'confirmed', 'in_progress', 'completed', 'cancelled'],
      default: 'draft',
    },
    positions: [positionSchema],
    notes: [noteSchema],
    documents: [
      {
        name: String,
        fileUrl: String,
        uploadedAt: { type: Date, default: () => new Date() },
      },
    ],
    requiresClientApproval: { type: Boolean, default: false },
    clientApprovedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    reportEmailedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

EventSchema.index({ tenantId: 1, status: 1 });
EventSchema.index({ tenantId: 1, startDate: 1 });
EventSchema.index({ tenantId: 1, clientId: 1 });

export const Event = model<IEvent>('Event', EventSchema);
