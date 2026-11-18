import { Schema, model, Document, Types } from 'mongoose';

export interface IStaffRating extends Document {
  tenantId: string;
  staffProfileId: Types.ObjectId;
  eventId: Types.ObjectId;
  eventName: string;
  coordinatorId: Types.ObjectId;
  coordinatorName: string;
  score: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StaffRatingSchema = new Schema<IStaffRating>(
  {
    tenantId: { type: String, required: true, index: true },
    staffProfileId: { type: Schema.Types.ObjectId, required: true, ref: 'StaffProfile', index: true },
    eventId: { type: Schema.Types.ObjectId, required: true, index: true },
    eventName: { type: String, required: true },
    coordinatorId: { type: Schema.Types.ObjectId, required: true },
    coordinatorName: { type: String, required: true },
    score: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
  },
  { timestamps: true }
);

// One rating per staff member per event
StaffRatingSchema.index({ staffProfileId: 1, eventId: 1 }, { unique: true });

export const StaffRating = model<IStaffRating>('StaffRating', StaffRatingSchema);
