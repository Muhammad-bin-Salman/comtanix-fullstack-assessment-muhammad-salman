import { Router, raw } from 'express';
import { storeEvent } from '../controllers/event-controller';
import { listEvents } from '../controllers/list-events-controller';
import { verifySignature } from '../middleware/verify-signature';

export function createEventRouter(sharedSecret: string): Router {
  const router = Router();

  router.get('/', listEvents);

  router.post(
    '/',
    raw({ type: 'application/json', limit: '100kb' }),
    verifySignature(sharedSecret),
    storeEvent,
  );

  return router;
}
