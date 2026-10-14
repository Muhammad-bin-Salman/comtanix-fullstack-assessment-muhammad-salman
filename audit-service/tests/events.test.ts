import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { AppConfig } from '../src/config/env';
import { AuditEvent } from '../src/models/audit-event';

const sharedSecret = 'test-shared-secret';
const appConfig: AppConfig = {
  nodeEnv: 'test',
  port: 3001,
  mongoUri: 'mongodb://unused-in-app-tests',
  auditSharedSecret: sharedSecret,
};
const app = createApp(appConfig);

let mongoServer: MongoMemoryServer | undefined;

function validEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    eventId: '550e8400-e29b-41d4-a716-446655440000',
    type: 'quote.created',
    quoteRequestId: 123,
    actorId: null,
    data: { status: 'new' },
    occurredAt: '2026-10-15T10:30:00.000000Z',
    ...overrides,
  };
}

function sign(rawBody: string, secret = sharedSecret): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

function postRaw(rawBody: string, signature?: string) {
  const testRequest = request(app)
    .post('/events')
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json');

  if (signature) {
    testRequest.set('X-Signature', signature);
  }

  return testRequest.send(rawBody);
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await AuditEvent.syncIndexes();
});

afterEach(async () => {
  await AuditEvent.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe('POST /events', () => {
  it('rejects a missing signature', async () => {
    const response = await postRaw(JSON.stringify(validEvent()));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Invalid signature.' });
  });

  it('rejects an invalid signature', async () => {
    const rawBody = JSON.stringify(validEvent());
    const response = await postRaw(rawBody, '0'.repeat(64));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Invalid signature.' });
  });

  it('accepts a request with a valid HMAC', async () => {
    const rawBody = JSON.stringify(validEvent());
    const response = await postRaw(rawBody, sign(rawBody));

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      status: 'stored',
      eventId: validEvent().eventId,
    });
  });

  it('stores a valid event once', async () => {
    const rawBody = JSON.stringify(validEvent());

    await postRaw(rawBody, sign(rawBody)).expect(201);

    expect(await AuditEvent.countDocuments()).toBe(1);
    const stored = await AuditEvent.findOne().lean();
    expect(stored?.quoteRequestId).toBe(123);
    expect(stored?.occurredAt.toISOString()).toBe('2026-10-15T10:30:00.000Z');
  });

  it('returns success for duplicate delivery and keeps one document', async () => {
    const rawBody = JSON.stringify(validEvent());
    const signature = sign(rawBody);

    await postRaw(rawBody, signature).expect(201);
    const duplicateResponse = await postRaw(rawBody, signature).expect(200);

    expect(duplicateResponse.body).toEqual({
      status: 'duplicate',
      eventId: validEvent().eventId,
    });
    expect(await AuditEvent.countDocuments()).toBe(1);
  });

  it('rejects an invalid UUID', async () => {
    const rawBody = JSON.stringify(validEvent({ eventId: 'not-a-uuid' }));
    const response = await postRaw(rawBody, sign(rawBody));

    expect(response.status).toBe(422);
    expect(response.body.message).toBe('The event payload is invalid.');
    expect(response.body.errors.eventId).toBeDefined();
  });

  it('rejects an unsupported event type', async () => {
    const rawBody = JSON.stringify(validEvent({ type: 'quote.deleted' }));
    const response = await postRaw(rawBody, sign(rawBody));

    expect(response.status).toBe(422);
    expect(response.body.errors.type).toBeDefined();
  });

  it('rejects malformed JSON after verifying its signature', async () => {
    const rawBody = '{"eventId":"incomplete"';
    const response = await postRaw(rawBody, sign(rawBody));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Malformed JSON.' });
  });

  it('accepts a null actor ID', async () => {
    const rawBody = JSON.stringify(validEvent({ actorId: null }));

    await postRaw(rawBody, sign(rawBody)).expect(201);

    const stored = await AuditEvent.findOne().lean();
    expect(stored?.actorId).toBeNull();
  });

  it('verifies the exact raw bytes sent by the client', async () => {
    const rawBody = '{"eventId":"550e8400-e29b-41d4-a716-446655440000","type":"quote.created","quoteRequestId":123,"actorId":null,"data":{"status":"new"},"occurredAt":"2026-10-15T10:30:00.000000Z"}';
    const signature = sign(rawBody);

    await postRaw(rawBody, signature).expect(201);

    const sameJsonWithDifferentBytes = ` ${rawBody}`;
    await postRaw(sameJsonWithDifferentBytes, signature).expect(401);
  });

  it('rejects a signature produced with the wrong secret', async () => {
    const rawBody = JSON.stringify(validEvent());

    await postRaw(rawBody, sign(rawBody, 'wrong-secret')).expect(401);

    expect(await AuditEvent.countDocuments()).toBe(0);
  });

  it('enforces eventId uniqueness at the MongoDB index', async () => {
    const document = {
      ...validEvent(),
      occurredAt: new Date('2026-10-15T10:30:00.000Z'),
    };

    const results = await Promise.allSettled([
      AuditEvent.create(document),
      AuditEvent.create(document),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(await AuditEvent.countDocuments()).toBe(1);
  });
});
