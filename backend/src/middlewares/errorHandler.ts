import { Request, Response, NextFunction } from 'express';

interface HttpError extends Error {
  statusCode?: number;
}

function errorHandler(err: HttpError, req: Request, res: Response, next: NextFunction) {
  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
}

export default errorHandler;
