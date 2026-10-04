import { useState } from 'react';

/** Renders a value and briefly highlights it when it changes. */
export function Bump({ value }: { value: string }) {
  const [previous, setPrevious] = useState(value);
  const [changes, setChanges] = useState(0);
  // Adjust state during render so the changed value commits once, already keyed.
  if (previous !== value) {
    setPrevious(value);
    setChanges(changes + 1);
  }
  return (
    <b key={changes} className={changes > 0 ? 'bump' : undefined}>
      {value}
    </b>
  );
}
