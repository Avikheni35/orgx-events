import { Schema, model, Document, Types } from 'mongoose';
import type { M2UserRole } from '../types';

// M2 User — connects to the SAME 'users' collection as M1.
// M2-specific roles: coordinator, event_staff, event_client.
// super_admin from M1 also has platform-level access here.

export interface IModuleRole {
  module: 'm1' | 'm2';
  role: string;
  profileId: Types.ObjectId;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId | null;
  role: M2UserRole;
  moduleRoles: IModuleRole[];
  email: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  emailOtpHash?: string;
  emailOtpExpires?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  magicLinkTokenHash?: string;
  magicLinkExpires?: Date;
  inviteTokenHash?: string;
  inviteExpires?: Date;
  refreshTokenHashes: string[];
  lastLoginAt?: Date;
  language: 'de' | 'en';
  notificationPreferences: { email: boolean; sms: boolean; push: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    role: {
      type: String,
      enum: ['super_admin', 'agency_admin', 'disponent', 'worker', 'business_contact', 'coordinator', 'event_staff', 'event_client'],
      required: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: String,
    firstName: { type: String, default: '', trim: true },
    lastName: { type: String, default: '', trim: true },
    phone: String,
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    emailVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    emailOtpHash: String,
    emailOtpExpires: Date,
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    passwordResetTokenHash: String,
    passwordResetExpires: Date,
    magicLinkTokenHash: String,
    magicLinkExpires: Date,
    inviteTokenHash: String,
    inviteExpires: Date,
    moduleRoles: [
      {
        module:    { type: String, enum: ['m1', 'm2'], required: true },
        role:      { type: String, required: true },
        profileId: { type: Schema.Types.ObjectId, required: true },
      },
    ],
    refreshTokenHashes: [{ type: String }],
    lastLoginAt: Date,
    language: { type: String, enum: ['de', 'en'], default: 'de' },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },
  },
  { timestamps: true, collection: 'users' }
);

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const User = model<IUser>('User', UserSchema);
