import { Schema, model, Document, Types } from 'mongoose';

export interface IEventClientContact {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  isPrimary: boolean;
}

export interface IEventClient extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId?: Types.ObjectId;
  name: string;
  type: 'company' | 'individual';
  industry?: string;
  vatId?: string;
  address: { street?: string; city?: string; postalCode?: string; country?: string };
  billingAddress?: { street?: string; city?: string; postalCode?: string; country?: string };
  paymentTermsDays: number;
  contacts: IEventClientContact[];
  notes?: string;
  status: 'active' | 'inactive';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IEventClientContact>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String,
    jobTitle: String,
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true }
);

const addressSchema = new Schema(
  { street: String, city: String, postalCode: String, country: { type: String, default: 'DE' } },
  { _id: false }
);

const EventClientSchema = new Schema<IEventClient>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, index: true, sparse: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['company', 'individual'], default: 'company' },
    industry: String,
    vatId: String,
    address: { type: addressSchema, default: {} },
    billingAddress: addressSchema,
    paymentTermsDays: { type: Number, default: 14 },
    contacts: [contactSchema],
    notes: String,
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

EventClientSchema.index({ tenantId: 1, status: 1 });

export const EventClient = model<IEventClient>('EventClient', EventClientSchema);
