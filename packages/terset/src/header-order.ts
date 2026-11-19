import type { JsonObject } from "./terset.ts";

/** Removes and returns the smallest number in a binary min-heap. */
function popMin(heap: number[]): number {
  const top = heap[0]!;
  const last = heap.pop()!;
  if (heap.length) {
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let child = left;
      if (right < heap.length && heap[right]! < heap[left]!) child = right;
      if (child >= heap.length || heap[child]! >= last) break;
      heap[index] = heap[child]!;
      index = child;
    }
    heap[index] = last;
  }
  return top;
}

/** Adds a number to a binary min-heap. */
function pushMin(heap: number[], value: number): void {
  let index = heap.length;
  heap.push(value);
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (heap[parent]! <= value) break;
    heap[index] = heap[parent]!;
    index = parent;
  }
  heap[index] = value;
}

/**
 * One header that every row's own key order fits, or null when none does.
 * When several fields may come next, the one seen first wins, so a list whose
 * first-seen field order already fits every row keeps exactly that order.
 */
export function headerOrder(rows: readonly JsonObject[]): string[] | null {
  if (rows.length < 2) return null;
  const fields: string[] = [];
  const positions = new Map<string, number>();
  // A field's followers in some row, and how many fields must come before it.
  const followers: number[][] = [];
  const waiting: number[] = [];
  for (const row of rows) {
    let previous = -1;
    for (const key of Object.keys(row)) {
      let index = positions.get(key);
      if (index === undefined) {
        index = fields.length;
        fields.push(key);
        positions.set(key, index);
        followers.push([]);
        waiting.push(0);
      }
      if (previous >= 0) {
        followers[previous]!.push(index);
        waiting[index]! += 1;
      }
      previous = index;
    }
  }
  if (!fields.length) return null;
  const ready: number[] = [];
  for (let index = 0; index < fields.length; index++) if (waiting[index] === 0) pushMin(ready, index);
  const order: string[] = [];
  while (ready.length) {
    const index = popMin(ready);
    order.push(fields[index]!);
    for (const next of followers[index]!) {
      waiting[next]! -= 1;
      if (waiting[next] === 0) pushMin(ready, next);
    }
  }
  // Fields left over sit on a cycle: two rows order the same pair both ways.
  return order.length === fields.length ? order : null;
}
