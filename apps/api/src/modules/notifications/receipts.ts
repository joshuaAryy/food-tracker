import { getExpoPushReceipts } from './expo-client.js';
import { prisma } from '../../lib/prisma.js';

const RECEIPT_MIN_AGE_MS = 15 * 60 * 1000;
const RECEIPT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ReceiptProcessingOptions {
  timeoutMs?: number;
  /** Absolute wall-clock deadline shared with the enclosing worker. */
  deadlineAt?: number;
}

function deadlineReached(deadlineAt: number | undefined): boolean {
  return deadlineAt !== undefined && Date.now() >= deadlineAt;
}

export async function processDueNotificationReceipts(
  now = new Date(),
  options: ReceiptProcessingOptions = {},
): Promise<number> {
  if (deadlineReached(options.deadlineAt)) return 0;
  const attempts = await prisma.notificationDeliveryAttempt.findMany({
    where: {
      expoTicketId: { not: null },
      submittedAt: {
        lte: new Date(now.getTime() - RECEIPT_MIN_AGE_MS),
        gte: new Date(now.getTime() - RECEIPT_MAX_AGE_MS),
      },
      OR: [{ nextReceiptCheckAt: null }, { nextReceiptCheckAt: { lte: now } }],
      status: 'submitted',
    },
    take: 500,
    orderBy: { submittedAt: 'asc' },
    include: { installation: true },
  });
  const ids = attempts.flatMap((attempt) =>
    attempt.expoTicketId === null ? [] : [attempt.expoTicketId],
  );
  let receipts: Record<
    string,
    Awaited<ReturnType<typeof getExpoPushReceipts>>[string]
  > = {};
  try {
    if (deadlineReached(options.deadlineAt)) return 0;
    const remainingMs =
      options.deadlineAt === undefined
        ? undefined
        : Math.max(1, options.deadlineAt - Date.now());
    receipts = await getExpoPushReceipts(
      ids,
      remainingMs === undefined
        ? options.timeoutMs
        : Math.min(options.timeoutMs ?? remainingMs, remainingMs),
    );
  } catch {
    return 0;
  }
  let processed = 0;
  for (const attempt of attempts) {
    if (deadlineReached(options.deadlineAt)) break;
    if (attempt.expoTicketId === null) continue;
    const receipt = receipts[attempt.expoTicketId];
    if (receipt === undefined) {
      if (deadlineReached(options.deadlineAt)) break;
      await prisma.notificationDeliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          receiptCheckCount: { increment: 1 },
          receiptLastCheckedAt: now,
          nextReceiptCheckAt: new Date(now.getTime() + RECEIPT_MIN_AGE_MS),
        },
      });
      continue;
    }
    if (deadlineReached(options.deadlineAt)) break;
    const error = receipt.details?.error;
    const terminal = receipt.status === 'error';
    await prisma.$transaction(async (transaction) => {
      await transaction.notificationDeliveryAttempt.update({
        where: { id: attempt.id },
        data: {
          receiptCheckCount: { increment: 1 },
          receiptLastCheckedAt: now,
          receiptStatus: receipt.status,
          status: terminal ? 'failed' : 'completed',
          errorCode: error ?? null,
          nextReceiptCheckAt: null,
        },
      });
      if (
        error === 'DeviceNotRegistered' &&
        attempt.installation !== null &&
        attempt.installation.tokenHash === attempt.tokenHash
      ) {
        await transaction.notificationInstallation.update({
          where: { id: attempt.installation.id },
          data: {
            userId: null,
            expoPushToken: null,
            tokenHash: null,
            disabledAt: now,
          },
        });
      }
    });
    processed += 1;
  }
  if (deadlineReached(options.deadlineAt)) return processed;
  await prisma.notificationDeliveryAttempt.updateMany({
    where: {
      status: 'submitted',
      submittedAt: { lt: new Date(now.getTime() - RECEIPT_MAX_AGE_MS) },
    },
    data: {
      status: 'receipt_expired',
      receiptStatus: 'expired',
      receiptLastCheckedAt: now,
    },
  });
  return processed;
}
