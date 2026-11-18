import { Schema, model, Document, Types } from 'mongoose';

export type ApplicationStatus = 'pending' | 'withdrawn';

export interface IEventApplication extends Document {
  _id: Types.ObjectId;
  tenantId: string;
  eventId: Types.ObjectId;
  eventName: string;
  staffProfileId: Types.ObjectId;
  staffName: string;
  staffEmail: string;
  note?: string;
  status: ApplicationStatus;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EventApplicationSchema = new Schema<IEventApplication>(
  {
    tenantId: { type: String, required: true, index: true },
    eventId: { type: Schema.Types.ObjectId, required: true, ref: 'Event', index: true },
    eventName: { type: String, required: true },
    staffProfileId: { type: Schema.Types.ObjectId, required: true, ref: 'StaffProfile', index: true },
    staffName: { type: String, required: true },
    staffEmail: { type: String, required: true },
    note: String,
    status: { type: String, enum: ['pending', 'withdrawn'], default: 'pending' },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One application record per worker per event (re-applying just flips status back to pending)
EventApplicationSchema.index({ eventId: 1, staffProfileId: 1 }, { unique: true });

export const EventApplication = model<IEventApplication>('EventApplication', EventApplicationSchema);
