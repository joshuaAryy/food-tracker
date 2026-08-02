import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(
  new URL('../prisma/schema.prisma', import.meta.url),
  'utf8',
);
const migration = readFileSync(
  new URL(
    '../prisma/migrations/20260726120000_add_firebase_identity_mapping/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('Firebase identity schema mapping', () => {
  it('preserves the application UUID and adds nullable Firebase identity metadata', () => {
    expect(schema).toMatch(
      /model User \{[\s\S]*id\s+String\s+@id[\s\S]*firebaseUid\s+String\?\s+@unique/,
    );
    expect(schema).toMatch(/firebaseDisplayName\s+String\?/);
    expect(schema).toMatch(/firebasePhotoUrl\s+String\?/);
    expect(schema).toMatch(
      /firebaseProviderIds\s+String\[\]\s+@default\(\[\]\)/,
    );
    expect(schema).not.toMatch(/firebaseUid\s+String\s+@id/);
  });

  it('uses an additive migration with a unique Firebase UID index', () => {
    expect(migration).toMatch(/ADD COLUMN "firebaseUid" TEXT/);
    expect(migration).toMatch(/ADD COLUMN "firebaseDisplayName" TEXT/);
    expect(migration).toMatch(/ADD COLUMN "firebasePhotoUrl" TEXT/);
    expect(migration).toMatch(/ADD COLUMN "firebaseProviderIds" TEXT\[\]/);
    expect(migration).toMatch(/DEFAULT ARRAY\[\]::TEXT\[\]/);
    expect(migration).toMatch(/CREATE UNIQUE INDEX "User_firebaseUid_key"/);
    expect(migration).not.toMatch(/DROP COLUMN|DROP TABLE|ALTER COLUMN "id"/i);
  });
});
