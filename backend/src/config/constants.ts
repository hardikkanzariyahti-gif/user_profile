import * as path from 'path';

const PORT = Number(process.env.PORT || 4000);
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

export { PORT, APP_BASE_URL, UPLOADS_DIR };
