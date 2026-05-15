import Express from 'express';
import cors from 'cors';
import compression from 'compression';
import * as path from 'path';
import apiRoutes from './routes';
import { APP_BASE_URL } from './config/constants';
import notFound from './middlewares/notFound';
import errorHandler from './middlewares/errorHandler';

const app = Express();

// ─── Performance Middleware ───────────────────────────────────────────────────
// Gzip compress all responses — cuts payload sizes by 60–80%.
app.use(compression({ level: 6, threshold: 1024 }));

app.use(cors());
// Increase limit only for API JSON (profile descriptors can be large).
app.use(Express.json({ limit: '2mb' }));

// Static uploads with aggressive client-side caching (1 day).
app.use(
  '/uploads',
  Express.static(path.join(__dirname, '../uploads'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
  })
);

app.get('/', (_req, res) => {
  res.send(`Backend API is running at ${APP_BASE_URL}`);
});

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
