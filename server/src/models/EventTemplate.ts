import { Schema, model, Document, Types } from 'mongoose';

export interface ITemplatePosition {
  title: string;
  roleType?: string;
  headcount: number;
  skills: string[];
  payRatePerHour: number;
  billingRatePerHour?: number;
  dresscode?: string;
  notes?: string;
  durationHours: number;
  breakMinutes: number;
}

export interface IEventTemplate extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  type: 'conference' | 'concert' | 'corporate' | 'wedding' | 'trade_show' | 'festival' | 'sports' | 'other';
  description?: string;
  requiresClientApproval: boolean;
  positions: ITemplatePosition[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const positionSchema = new Schema<ITemplatePosition>(
  {
    title: { type: String, required: true },
    roleType: String,
    headcount: { type: Number, required: true, min: 1, default: 1 },
    skills: [{ type: String }],
    payRatePerHour: { type: Number, required: true, min: 0 },
    billingRatePerHour: Number,
    dresscode: String,
    notes: String,
    durationHours: { type: Number, required: true, min: 0.5, default: 8 },
    breakMinutes: { type: Number, default: 30 },
  },
  { _id: false }
);

const EventTemplateSchema = new Schema<IEventTemplate>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['conference', 'concert', 'corporate', 'wedding', 'trade_show', 'festival', 'sports', 'other'],
      required: true,
    },
    description: String,
    requiresClientApproval: { type: Boolean, default: false },
    positions: [positionSchema],
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

export const EventTemplate = model<IEventTemplate>('EventTemplate', EventTemplateSchema);
