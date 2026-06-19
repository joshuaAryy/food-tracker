import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { resetTestDatabase } from './helpers/database.js';

beforeEach(async () => {
  await resetTestDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
