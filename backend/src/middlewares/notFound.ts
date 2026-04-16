import { Request, Response } from 'express';

function notFound(req: Request, res: Response) {
  res.status(404).json({ error: `Route not found: ${req.originalUrl}` });
}

export default notFound;
