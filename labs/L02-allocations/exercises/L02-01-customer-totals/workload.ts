import { createRng } from '../../../../src/harness-node/lab.ts';

export interface Order { id: number; customer: string; quantity: number; unitPriceCents: number }

// Rolls the orders up into a total (in cents) per customer.
export function totalsByCustomer(orders: Order[]): Record<string, number> {
  return orders.reduce<Record<string, number>>(
    (totals, o) => ({ ...totals, [o.customer]: (totals[o.customer] ?? 0) + o.quantity * o.unitPriceCents }),
    {},
  );
}

function createOrders(count: number): Order[] {
  const next = createRng(42);
  const orders: Order[] = [];
  for (let i = 0; i < count; i++)
    orders.push({ id: i + 1, customer: `Customer-${next(300) + 1}`, quantity: next(39) + 1, unitPriceCents: next(19_900) + 100 });
  return orders;
}

export function workload(): number {
  const totals = totalsByCustomer(createOrders(5_000));
  let checksum = 0;
  let count = 0;
  for (const cents of Object.values(totals)) { // insertion order: first order seen per customer
    checksum = (checksum * 31 + cents) % 1_000_000_007;
    count++;
  }
  return checksum * 1_000_003 + count;
}
