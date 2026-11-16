// Every text a slot can show, stacked in one grid cell. Only the current one is
// visible, so the slot always has the size of the largest text and a state
// change never moves anything around it. Hidden texts are also hidden from
// screen readers (visibility: hidden).
import type { ReactNode } from 'react';

export interface StackItem<K extends string> {
  readonly key: K;
  readonly node: ReactNode;
}

export interface StackProps<K extends string> {
  readonly items: readonly StackItem<K>[];
  readonly current: K;
  readonly className?: string;
}

export function Stack<K extends string>({ items, current, className }: StackProps<K>) {
  return (
    <span className={className === undefined ? 'stack' : `stack ${className}`}>
      {items.map((item) => (
        <span key={item.key} data-on={item.key === current ? '' : undefined}>
          {item.node}
        </span>
      ))}
    </span>
  );
}
