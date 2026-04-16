import Express from 'express';
import cors from 'cors';
import * as path from 'path';
import apiRoutes from './routes';
import { APP_BASE_URL } from './config/constants';
import notFound from './middlewares/notFound';
import errorHandler from './middlewares/errorHandler';

try {
  const Module = require('module');
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request: string, parent: any, isMain: boolean) {
    if (request === '@tensorflow/tfjs-node') {
      return require('@tensorflow/tfjs');
    }

    return originalLoad.call(this, request, parent, isMain);
  };
} catch (err) {
  console.warn('AI Compatibility Hack: Could not patch tensorflow loader');
}

const app = Express();

app.use(cors());
app.use(Express.json());
app.use('/uploads', Express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.send(`Backend API is running at ${APP_BASE_URL}`);
});

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
