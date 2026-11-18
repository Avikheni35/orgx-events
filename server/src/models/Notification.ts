import { Schema, model, Types } from 'mongoose';

export interface INotification {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  recipientId: Types.ObjectId; // User._id
  type: 'assignment_confirmed' | 'assignment_declined' | 'timesheet_approved' | 'payment_paid' | 'general';
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    tenantId:    { type: Schema.Types.ObjectId, required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, required: true, index: true },
    type:        { type: String, enum: ['assignment_confirmed', 'assignment_declined', 'timesheet_approved', 'payment_paid', 'general'], required: true },
    title:       { type: String, required: true },
    body:        { type: String, required: true },
    link:        { type: String },
    read:        { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// Auto-delete after 90 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const Notification = model<INotification>('M2Notification', NotificationSchema, 'm2notifications');
