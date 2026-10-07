import { useRef, useState, type PointerEvent } from 'react';
import type { PositionGroup } from '../stats/positionOrder';

const label = (position: PositionGroup) => position === 'D/ST' ? 'Team defenses' : position;
type Drag = { position: PositionGroup; pointerId: number; startY: number };

/** Pointer capture lets the same handle support mouse, pen and touch without preventing page scrolling elsewhere. */
export function PositionOrderInput({ positions, onChange }: { positions: PositionGroup[]; onChange: (positions: PositionGroup[]) => void }) {
  const list = useRef<HTMLOListElement>(null);
  const active = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<{ position: PositionGroup; slot: number } | null>(null);

  function destination(event: PointerEvent): number | null {
    const drag = active.current;
    if (!drag || drag.pointerId !== event.pointerId || Math.abs(event.clientY - drag.startY) < 6 || !list.current) return null;
    const bounds = list.current.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return null;
    const rows = [...list.current.children];
    const slot = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    return slot === -1 ? positions.length : slot;
  }

  function endDrag(event: PointerEvent) {
    const drag = active.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const slot = destination(event);
    active.current = null;
    setPreview(null);
    if (slot === null) return;
    const from = positions.indexOf(drag.position);
    const to = slot > from ? slot - 1 : slot;
    if (from === to) return;
    const next = positions.filter((position) => position !== drag.position);
    next.splice(to, 0, drag.position);
    onChange(next);
  }

  function cancelDrag() {
    active.current = null;
    setPreview(null);
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...positions];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  }

  return (
    <ol ref={list} className="position-order" aria-label="Position order" aria-describedby="position-order-help position-drag-help"
      onPointerMove={(event) => {
        if (!active.current || active.current.pointerId !== event.pointerId) return;
        const slot = destination(event);
        setPreview(slot === null ? null : { position: active.current.position, slot });
      }}
      onPointerUp={endDrag} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
      onKeyDown={(event) => { if (event.key === 'Escape') cancelDrag(); }}>
      {positions.map((position, index) => (
        <li key={position} className={[
          preview?.position === position ? 'is-dragging' : '',
          preview?.slot === index ? 'drop-before' : '',
          preview?.slot === positions.length && index === positions.length - 1 ? 'drop-after' : '',
        ].filter(Boolean).join(' ')}>
          <span>{label(position)}</span>
          <button type="button" className="btn position-drag-handle" aria-label={`Drag ${label(position)} to reorder`} aria-describedby="position-drag-help"
            onPointerDown={(event) => {
              if (event.button !== 0 || event.isPrimary === false) return;
              active.current = { position, pointerId: event.pointerId, startY: event.clientY };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}>⠿</button>
          <div className="position-order-actions">
            <button type="button" className="btn" aria-label={`Move ${label(position)} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
            <button type="button" className="btn" aria-label={`Move ${label(position)} down`} disabled={index === positions.length - 1} onClick={() => move(index, 1)}>↓</button>
          </div>
        </li>
      ))}
    </ol>
  );
}
