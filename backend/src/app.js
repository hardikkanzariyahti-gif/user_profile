// AI compatibility: alias tfjs-node to tfjs if native bindings are unavailable.
try {
  const tf = require('@tensorflow/tfjs');
  require.cache[require.resolve('@tensorflow/tfjs-node')] = {
    id: require.resolve('@tensorflow/tfjs-node'),
    loaded: true,
    exports: tf,
  };
} catch (err) {
  console.warn('AI Compatibility Hack: Could not alias tensorflow');
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes');
const { APP_BASE_URL } = require('./config/constants');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const faceAi = require('../faceAi');

const app = express();

faceAi.loadModels();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.send(`Backend API is running at ${APP_BASE_URL}`);
});

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
