import { useSyncExternalStore } from 'react';

type Totals = { units: number; cases: number; subtotal: number };

let totals: Totals = { units: 0, cases: 0, subtotal: 0 };
const listeners = new Set<() => void>();

function emit() { for (const l of Array.from(listeners)) l(); }

export function addUnits(units: number, unitPrice: number, caseSize: number) {
  const u = Math.max(0, Math.floor(units));
  const csize = Math.max(1, Math.floor(caseSize));
  totals = {
    units: totals.units + u,
    cases: totals.cases + Math.floor(u / csize),
    subtotal: totals.subtotal + u * unitPrice,
  };
  emit();
}

export function resetCart() { totals = { units: 0, cases: 0, subtotal: 0 }; emit(); }

export function useTotals(): Totals {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => totals,
    () => totals
  );
}
