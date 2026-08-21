import { z } from 'zod';

export const waterLogInputSchema = z.strictObject({
  amountMl: z.number().int().min(1).max(5000),
  loggedAt: z.iso.datetime(),
});

export const waterLogsQuerySchema = z
  .strictObject({
    date: z.iso.date().optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
  })
  .refine(
    ({ date, startDate, endDate }) =>
      date === undefined || (startDate === undefined && endDate === undefined),
    {
      message: 'date cannot be combined with startDate or endDate',
      path: ['date'],
    },
  )
  .refine(
    ({ startDate, endDate }) =>
      startDate === undefined || endDate === undefined || startDate <= endDate,
    { message: 'startDate must not be after endDate', path: ['startDate'] },
  );

export const waterLogSchema = z.strictObject({
  id: z.uuid(),
  amountMl: z.number().int().positive(),
  loggedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WaterLogInput = z.infer<typeof waterLogInputSchema>;
export type WaterLogsQuery = z.infer<typeof waterLogsQuerySchema>;
export type WaterLog = z.infer<typeof waterLogSchema>;
