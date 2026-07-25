import { beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { assertDisposableDatabase } from '@/lib/assertDisposableDatabase';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Integration tests need a real Postgres database ' +
      '(see CLAUDE.md → Testing → Integration tests). Point it at a disposable ' +
      'local or CI database — never at production.'
  );
}

assertDisposableDatabase(process.env.DATABASE_URL);

// Full reset before every test so tests can't leak state into each other,
// regardless of execution order. CASCADE handles the FK chain
// (payments/bookings → players/drinks/billing_periods).
beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE payments, bookings, billing_periods, drinks, players CASCADE'
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
