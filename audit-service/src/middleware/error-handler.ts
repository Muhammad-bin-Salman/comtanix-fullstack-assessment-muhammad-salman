import type { ErrorRequestHandler } from 'express';
import { HttpError } from '../errors/http-error';

export function errorHandler(nodeEnv: string): ErrorRequestHandler {
  return (error, _request, response, _next): void => {
    if (error instanceof HttpError) {
      response.status(error.statusCode).json({
        message: error.message,
        ...(error.details ? { errors: error.details } : {}),
      });
      return;
    }

    if (nodeEnv !== 'test') {
      console.error('Unexpected request failure.', error);
    }

    response.status(500).json({ message: 'Internal server error.' });
  };
}
