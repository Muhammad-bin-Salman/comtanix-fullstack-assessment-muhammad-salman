import { createHmac, randomUUID } from 'node:crypto';
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

async function createStoredEvent(overrides: Record<string, unknown> = {}) {
  return AuditEvent.create({
    eventId: randomUUID(),
    type: 'quote.created',
    quoteRequestId: 123,
    actorId: null,
    data: { status: 'new' },
    occurredAt: new Date('2026-10-15T10:30:00.000Z'),
    ...overrides,
  });
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

describe('GET /events', () => {
  it('returns events newest first', async () => {
    await createStoredEvent({ occurredAt: new Date('2026-10-15T10:00:00.000Z') });
    const newest = await createStoredEvent({ occurredAt: new Date('2026-10-15T12:00:00.000Z') });
    await createStoredEvent({ occurredAt: new Date('2026-10-15T11:00:00.000Z') });

    const response = await request(app).get('/events').expect(200);

    expect(response.body.data[0].eventId).toBe(newest.eventId);
    expect(response.body.data.map((event: { occurredAt: string }) => event.occurredAt)).toEqual([
      '2026-10-15T12:00:00.000Z',
      '2026-10-15T11:00:00.000Z',
      '2026-10-15T10:00:00.000Z',
    ]);
  });

  it('filters by quoteRequestId', async () => {
    await createStoredEvent({ quoteRequestId: 123 });
    await createStoredEvent({ quoteRequestId: 456 });

    const response = await request(app).get('/events?quoteRequestId=456').expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].quoteRequestId).toBe(456);
  });

  it('filters by type', async () => {
    await createStoredEvent({ type: 'quote.created' });
    await createStoredEvent({ type: 'quote.status_changed', data: { from: 'new', to: 'in_review' } });

    const response = await request(app).get('/events?type=quote.status_changed').expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].type).toBe('quote.status_changed');
  });

  it('combines quoteRequestId and type filters', async () => {
    await createStoredEvent({ quoteRequestId: 123, type: 'quote.assigned', data: { from: null, to: 2 } });
    await createStoredEvent({ quoteRequestId: 123, type: 'quote.created' });
    await createStoredEvent({ quoteRequestId: 456, type: 'quote.assigned', data: { from: null, to: 3 } });

    const response = await request(app)
      .get('/events?quoteRequestId=123&type=quote.assigned')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      quoteRequestId: 123,
      type: 'quote.assigned',
    });
  });

  it('paginates results', async () => {
    for (let index = 0; index < 5; index += 1) {
      await createStoredEvent({ occurredAt: new Date(`2026-10-15T1${index}:00:00.000Z`) });
    }

    const response = await request(app).get('/events?page=2&per_page=2').expect(200);

    expect(response.body.data).toHaveLength(2);
    expect(response.body.data.map((event: { occurredAt: string }) => event.occurredAt)).toEqual([
      '2026-10-15T12:00:00.000Z',
      '2026-10-15T11:00:00.000Z',
    ]);
  });

  it('returns correct pagination metadata', async () => {
    await Promise.all(Array.from({ length: 5 }, () => createStoredEvent()));

    const response = await request(app).get('/events?page=2&per_page=2').expect(200);

    expect(response.body.meta).toEqual({
      page: 2,
      per_page: 2,
      total: 5,
      total_pages: 3,
    });
  });

  it('rejects an invalid quoteRequestId', async () => {
    const response = await request(app).get('/events?quoteRequestId=0').expect(422);

    expect(response.body.message).toBe('The query parameters are invalid.');
    expect(response.body.errors.quoteRequestId).toBeDefined();
  });

  it('rejects an invalid type', async () => {
    const response = await request(app).get('/events?type=quote.deleted').expect(422);

    expect(response.body.errors.type).toBeDefined();
  });

  it('rejects an invalid page', async () => {
    const response = await request(app).get('/events?page=zero').expect(422);

    expect(response.body.errors.page).toBeDefined();
  });

  it('rejects per_page values over 100', async () => {
    const response = await request(app).get('/events?per_page=101').expect(422);

    expect(response.body.errors.per_page).toBeDefined();
  });

  it('does not expose __v', async () => {
    await createStoredEvent();

    const response = await request(app).get('/events').expect(200);

    expect(response.body.data[0]).not.toHaveProperty('__v');
  });

  it('does not expose MongoDB IDs or internal timestamps', async () => {
    await createStoredEvent();

    const response = await request(app).get('/events').expect(200);

    expect(response.body.data[0]).not.toHaveProperty('_id');
    expect(response.body.data[0]).not.toHaveProperty('createdAt');
    expect(response.body.data[0]).not.toHaveProperty('updatedAt');
    expect(Object.keys(response.body.data[0])).toEqual([
      'eventId',
      'type',
      'quoteRequestId',
      'actorId',
      'data',
      'occurredAt',
    ]);
  });

  it('returns empty data with correct default metadata', async () => {
    const response = await request(app).get('/events?quoteRequestId=999').expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: {
        page: 1,
        per_page: 20,
        total: 0,
        total_pages: 0,
      },
    });
  });
});
