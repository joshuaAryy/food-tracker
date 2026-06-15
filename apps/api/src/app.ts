import cors from 'cors';
import express from 'express';
import { API_BASE_PATH } from '@food-tracker/shared';
import { mockAuth } from './middleware/mock-auth.js';
import { notFound } from './middleware/not-found.js';
import { apiRouter } from './routes/api.js';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(API_BASE_PATH, mockAuth, apiRouter);
app.use(notFound);
