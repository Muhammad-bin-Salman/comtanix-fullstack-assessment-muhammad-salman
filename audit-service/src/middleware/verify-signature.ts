import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function verifySignature(sharedSecret: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const providedSignature = request.get('X-Signature');

    if (!Buffer.isBuffer(request.body) || !providedSignature) {
      response.status(401).json({ message: 'Invalid signature.' });
      return;
    }

    const expectedSignature = createHmac('sha256', sharedSecret)
      .update(request.body)
      .digest('hex');

    if (!/^[a-f0-9]{64}$/.test(providedSignature)) {
      response.status(401).json({ message: 'Invalid signature.' });
      return;
    }

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const providedBuffer = Buffer.from(providedSignature, 'hex');

    if (
      expectedBuffer.length !== providedBuffer.length
      || !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      response.status(401).json({ message: 'Invalid signature.' });
      return;
    }

    next();
  };
}
