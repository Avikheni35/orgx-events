import { Schema, model, Document, Types } from 'mongoose';

export interface IWeeklySlot {
  dayOfWeek: number; // 0=Sun, 1=Mon … 6=Sat
  available: boolean;
  startTime?: string; // "09:00"
  endTime?: string;   // "17:00"
}

export interface IDateOverride {
  _id?: Types.ObjectId;
  date: Date;
  available: boolean;
  startTime?: string;
  endTime?: string;
  note?: string;
}

export interface IStaffAvailability extends Document {
  tenantId: string;
  staffProfileId: Types.ObjectId;
  weeklyPattern: IWeeklySlot[];
  dateOverrides: IDateOverride[];
  updatedAt: Date;
}

const WeeklySlotSchema = new Schema<IWeeklySlot>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    available: { type: Boolean, default: true },
    startTime: String,
    endTime: String,
  },
  { _id: false }
);

const DateOverrideSchema = new Schema<IDateOverride>({
  date: { type: Date, required: true },
  available: { type: Boolean, required: true },
  startTime: String,
  endTime: String,
  note: String,
});

const StaffAvailabilitySchema = new Schema<IStaffAvailability>(
  {
    tenantId: { type: String, required: true },
    staffProfileId: { type: Schema.Types.ObjectId, required: true, ref: 'StaffProfile', unique: true },
    weeklyPattern: {
      type: [WeeklySlotSchema],
      default: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, available: d >= 1 && d <= 5 })),
    },
    dateOverrides: [DateOverrideSchema],
  },
  { timestamps: true }
);

export const StaffAvailability = model<IStaffAvailability>('StaffAvailability', StaffAvailabilitySchema);
