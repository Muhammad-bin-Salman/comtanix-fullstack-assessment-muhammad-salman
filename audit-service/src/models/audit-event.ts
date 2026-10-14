import { Schema, model } from 'mongoose';
import { auditEventTypes, type AuditEventType } from '../types/audit-event';

export type AuditEventDocument = {
  eventId: string;
  type: AuditEventType;
  quoteRequestId: number;
  actorId: number | null;
  data: Record<string, unknown>;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const auditEventSchema = new Schema<AuditEventDocument>({
  eventId: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true, enum: auditEventTypes },
  quoteRequestId: { type: Number, required: true, min: 1 },
  actorId: { type: Number, default: null, min: 1 },
  data: { type: Schema.Types.Mixed, required: true },
  occurredAt: { type: Date, required: true },
}, {
  timestamps: true,
  versionKey: false,
});

export const AuditEvent = model<AuditEventDocument>('AuditEvent', auditEventSchema);
