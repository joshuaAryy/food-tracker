import { runNotificationWorker } from '../modules/notifications/worker.js';
import { prisma } from '../lib/prisma.js';

const environment = process.env.APP_ENV ?? 'development';
const override =
  process.env.NOTIFICATION_ACCEPTANCE_TIME_OVERRIDE_ENABLED === 'true';
const args = process.argv.slice(2);
const atIndex = args.indexOf('--at');
const userIndex = args.indexOf('--acceptance-user-firebase-uid');
const hasExplicitTime = args.includes('--at');
if (hasExplicitTime && environment === 'production') {
  throw new Error('Notification clock override is unavailable in production.');
}
const dryRun = !args.includes('--send');
const now =
  atIndex >= 0 && args[atIndex + 1] !== undefined
    ? new Date(args[atIndex + 1] as string)
    : new Date();

if (override && environment !== 'staging' && environment !== 'test') {
  throw new Error(
    'Notification acceptance override requires APP_ENV=staging or test.',
  );
}
if (hasExplicitTime && !override) {
  throw new Error(
    'An explicit notification time requires the acceptance override flag.',
  );
}
if (override && (userIndex < 0 || args[userIndex + 1] === undefined)) {
  throw new Error(
    'A single acceptance Firebase UID is required when clock override is enabled.',
  );
}
if (override && !Number.isFinite(now.getTime())) {
  throw new Error('The acceptance clock must be a valid ISO timestamp.');
}

const acceptanceFirebaseUid = userIndex >= 0 ? args[userIndex + 1] : undefined;
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
