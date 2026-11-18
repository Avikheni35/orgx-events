import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  tenantId:      { type: Schema.Types.ObjectId, required: true, index: true },
  type:          { type: String, required: true },
  targetModule:  { type: String, required: true },
  targetPath:    { type: String, required: true },
  payload:       { type: Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['pending', 'delivered', 'failed'],
    default: 'pending',
    index: true,
  },
  attempts:      { type: Number, default: 0 },
  lastAttemptAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expireAfterSeconds: 30 * 24 * 3600 },
  },
});

export const OutboxEvent = mongoose.model('M2OutboxEvent', schema, 'm2_outbox_events');
