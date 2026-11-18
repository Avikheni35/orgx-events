import { Schema, model, Document, Types } from 'mongoose';

export interface IVenue extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  type: 'indoor' | 'outdoor' | 'hybrid';
  capacity?: number;
  address: { street?: string; city?: string; postalCode?: string; country?: string };
  facilities: string[];
  notes?: string;
  layoutFileUrl?: string;
  status: 'active' | 'inactive';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VenueSchema = new Schema<IVenue>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['indoor', 'outdoor', 'hybrid'], default: 'indoor' },
    capacity: Number,
    address: {
      street: String,
      city: String,
      postalCode: String,
      country: { type: String, default: 'DE' },
    },
    facilities: [{ type: String }],
    notes: String,
    layoutFileUrl: String,
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

VenueSchema.index({ tenantId: 1, status: 1 });

export const Venue = model<IVenue>('Venue', VenueSchema);
