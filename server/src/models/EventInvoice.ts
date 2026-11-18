import { Schema, model, Document, Types } from 'mongoose';

export type EventInvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled';

export interface IEventInvoice extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  invoiceNumber: string;
  clientId: Types.ObjectId;
  clientName: string;
  clientAddress?: string;
  clientVatId?: string;
  eventId?: Types.ObjectId;
  eventName?: string;
  agencyName: string;
  agencyAddress?: string;
  agencyVatId?: string;
  invoiceDate: Date;
  dueDate: Date;
  lineItems: {
    timesheetId?: Types.ObjectId;
    description: string;
    hours: number;
    ratePerHour: number;
    amount: number;
  }[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes?: string;
  status: EventInvoiceStatus;
  createdBy: Types.ObjectId;
  // M3 sync
  syncStatus: 'not_configured' | 'pending' | 'synced' | 'failed';
  syncId?: string;
  syncedAt?: Date;
  syncError?: string;
  m3InvoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventInvoiceSchema = new Schema<IEventInvoice>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    invoiceNumber: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, required: true },
    clientName: { type: String, required: true },
    clientAddress: String,
    clientVatId: String,
    eventId: Schema.Types.ObjectId,
    eventName: String,
    agencyName: { type: String, required: true },
    agencyAddress: String,
    agencyVatId: String,
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    lineItems: [
      {
        timesheetId: Schema.Types.ObjectId,
        description: { type: String, required: true },
        hours: { type: Number, required: true },
        ratePerHour: { type: Number, required: true },
        amount: { type: Number, required: true },
      },
    ],
    subtotal: { type: Number, required: true },
    vatRate: { type: Number, required: true },
    vatAmount: { type: Number, required: true },
    total: { type: Number, required: true },
    notes: String,
    status: { type: String, enum: ['draft', 'sent', 'paid', 'cancelled'], default: 'draft' },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    syncStatus: { type: String, enum: ['not_configured', 'pending', 'synced', 'failed'], default: 'not_configured' },
    syncId: { type: String, sparse: true },
    syncedAt: Date,
    syncError: String,
    m3InvoiceId: String,
  },
  { timestamps: true }
);

EventInvoiceSchema.index({ tenantId: 1, status: 1 });
EventInvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

export const EventInvoice = model<IEventInvoice>('EventInvoice', EventInvoiceSchema);
