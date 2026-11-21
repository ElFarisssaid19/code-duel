import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import routes from './routes/index.js';
import { sharePageRouter } from './routes/share.routes.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
if (env.isDev) app.use(morgan('dev'));

app.use('/api', routes);
// Public share pages (no login). In development Vite proxies /s/* here.
app.use('/s', sharePageRouter);

app.use(notFound);
app.use(errorHandler);
