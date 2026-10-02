import { createRng } from '../../../../src/harness-node/lab.ts';

export interface Contact { id: number; name: string; email: string }

// A Set answers "have I seen this?" in one hash lookup, however many rows came before.
export function importContacts(rows: Contact[]): Contact[] {
  const seen = new Set<string>();
  const imported: Contact[] = [];
  for (const row of rows) {
    const key = row.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    imported.push(row);
  }
  return imported;
}

function createRows(count: number, people: number): Contact[] {
  const next = createRng(42);
  const rows: Contact[] = [];
  for (let i = 0; i < count; i++) {
    const person = next(people);
    const email = `person${person}@example.com`;
    rows.push({ id: i + 1, name: `Person ${person}`, email: next(2) === 0 ? email : email.toUpperCase() });
  }
  return rows;
}

export function workload(): number {
  const imported = importContacts(createRows(20_000, 12_000));
  let checksum = 0;
  for (const c of imported) checksum = (checksum * 31 + c.id) % 1_000_000_007;
  return checksum * 1_000_003 + imported.length;
}
