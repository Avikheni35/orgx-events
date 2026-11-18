import { Schema, model, Document, Types } from 'mongoose';

export interface IStaffPool extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  description?: string;
  tags: string[];
  memberIds: Types.ObjectId[];
  status: 'active' | 'inactive';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StaffPoolSchema = new Schema<IStaffPool>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: String,
    tags: [{ type: String }],
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'StaffProfile' }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

export const StaffPool = model<IStaffPool>('StaffPool', StaffPoolSchema);
