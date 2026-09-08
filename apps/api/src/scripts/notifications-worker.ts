import { runNotificationWorker } from '../modules/notifications/worker.js';
import { prisma } from '../lib/prisma.js';
import { validateNotificationAcceptanceGuards } from '../modules/notifications/acceptance-guards.js';

const environment = process.env.APP_ENV ?? 'development';
const override =
  process.env.NOTIFICATION_ACCEPTANCE_TIME_OVERRIDE_ENABLED === 'true';
const args = process.argv.slice(2);
const atIndex = args.indexOf('--at');
const userIndex = args.indexOf('--acceptance-user-firebase-uid');
const hasExplicitTime = args.includes('--at');
const send = args.includes('--send');
const dryRun = !send;
const now =
  atIndex >= 0 && args[atIndex + 1] !== undefined
    ? new Date(args[atIndex + 1] as string)
    : new Date();

const acceptanceFirebaseUid = userIndex >= 0 ? args[userIndex + 1] : undefined;
validateNotificationAcceptanceGuards({
  environment,
  overrideEnabled: override,
  acceptanceFirebaseUid,
  configuredApprovedFirebaseUid:
    process.env.NOTIFICATION_ACCEPTANCE_APPROVED_FIREBASE_UID,
  explicitTime: hasExplicitTime,
  send,
  sendEnabled: process.env.NOTIFICATION_ACCEPTANCE_SEND_ENABLED === 'true',
});
if (override && !Number.isFinite(now.getTime())) {
  throw new Error('The acceptance clock must be a valid ISO timestamp.');
}

const acceptanceUserId =
  acceptanceFirebaseUid === undefined
    ? undefined
    : (
        await prisma.user.findFirst({
          where: { firebaseUid: acceptanceFirebaseUid },
          select: { id: true },
        })
      )?.id;
if (override && acceptanceUserId === undefined) {
  throw new Error(
    'The acceptance Firebase UID must belong to one staging user.',
  );
}
const result = await runNotificationWorker({
  now,
  dryRun,
  ...(acceptanceUserId === undefined ? {} : { acceptanceUserId }),
});
console.log(
  JSON.stringify({
    evaluated: result.evaluated,
    claimed: result.claimed,
    dryRun,
  }),
);
