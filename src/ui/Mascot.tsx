import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { registerPageMascot } from './mascotPresence';
import { TypedText } from './TypedText';

const INK = '#14231A';
const CREAM = '#F6EBDD';
const MINT = '#86EFAC';
const LEATHER = '#A85A2E';
const BALL = 'M10 100C38 36 162 36 190 100C162 164 38 164 10 100Z'; // a football lying down, pointed at both ends

/** A limb is ink underneath and cream on top, so it reads on the dark theme and on the light one. */
function Limb({ d, width }: { d: string; width: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={width + 5} strokeLinecap="round" />
      <path d={d} fill="none" stroke={CREAM} strokeWidth={width} strokeLinecap="round" />
    </>
  );
}

const Glove = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r="9" fill={MINT} stroke={INK} strokeWidth="4.5" />;

/** `drop` makes the leg longer, for a mascot sitting on an edge with its legs hanging. */
function Leg({ x, dir, className, drop }: { x: number; dir: 1 | -1; className: string; drop: number }) {
  const c = x - 4 * dir; // the cleat sits a little outside the leg
  const y = (n: number) => n + drop;
  return (
    // Every limb turns about its own joint, which is what walking and pointing will use.
    <g className={`rig ${className}`} style={{ transformOrigin: `${x}px 124px` }}>
      <Limb d={`M${x} 122V${y(148)}`} width={10} />
      <path className="detail" d={`M${x - 5} ${y(136)}H${x + 5}M${x - 5} ${y(142)}H${x + 5}`} stroke={MINT} strokeWidth="3.5" strokeLinecap="round" />
      <path d={`M${c - 12 * dir} ${y(160)}Q${c - 13 * dir} ${y(150)} ${c} ${y(150)}H${c + 4 * dir}Q${c + 17 * dir} ${y(152)} ${c + 17 * dir} ${y(158)}Q${c + 17 * dir} ${y(162)} ${c + 13 * dir} ${y(162)}H${c - 10 * dir}Z`} fill={INK} stroke={CREAM} strokeWidth="3" strokeLinejoin="round" />
    </g>
  );
}

/** Where the bottom of the body is in the 200-unit drawing: the line a seated mascot sits on. */
export const SEAT_Y = 150;

interface Props {
  /** Width and height in px. */
  size?: number;
  className?: string;
  /** Points one arm at the menu on that side (on narrow screens, where the menu is above, it points up) and looks the same way. */
  pointAt?: 'left';
  /** Rises into place when it appears (the default). The header's mascot turns it off: it is rebuilt on every page. */
  entrance?: boolean;
  /** Sits on an edge with its legs hanging and swinging gently: no shadow underneath, and no bobbing. */
  seated?: boolean;
}

/**
 * The Stat Watch mascot: a football in glasses, in kit (the Gridiron design in docs/mascot.md). Purely decorative, so it is
 * hidden from assistive technology; whatever it "says" is real text next to it. Its eyes follow the pointer, and it blinks,
 * glances and bobs on its own. Every motion is CSS transform and opacity, and all of it stops under reduced motion.
 */
export function Mascot({ size = 160, className, pointAt, entrance = true, seated = false }: Props) {
  const uid = useId().replace(/:/g, ''); // gradient and clip ids must be unique per instance, and colons break url(#...)
  const ref = useRef<SVGSVGElement>(null);

  // The eyes look towards the pointer. The glance is set on --lx and --ly, which the CSS turns into a small shift of the pupils.
  useEffect(() => {
    const calm = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (pointAt) return; // it is looking at what it points to, not at the pointer
    const look = (event: PointerEvent) => {
      const svg = ref.current;
      if (!svg || calm?.matches) return;
      const box = svg.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      const distance = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, distance / 260) * 6;
      svg.style.setProperty('--lx', ((dx / distance) * reach).toFixed(2));
      svg.style.setProperty('--ly', ((dy / distance) * reach * 0.7).toFixed(2));
    };
    window.addEventListener('pointermove', look);
    return () => window.removeEventListener('pointermove', look);
  }, [pointAt]);

  const eye = (cx: number, id: string): ReactNode => (
    <>
      <g className="m-pupil"><circle cx={cx + 2} cy="106" r="8.5" fill={INK} /><circle cx={cx + 5} cy="103" r="2.6" fill="#fff" /></g>
      <clipPath id={`${uid}-${id}`}><circle cx={cx} cy="104" r="19" /></clipPath>
    </>
  );

  return (
    <svg ref={ref} className={`mascot${size <= 48 ? ' sm' : ''}${entrance ? '' : ' no-entrance'}${seated ? ' seated' : ''}${pointAt ? ` pointing-${pointAt}` : ''}${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${uid}-leather`} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#D98A4E" /><stop offset=".55" stopColor="#A9582B" /><stop offset="1" stopColor="#6A3114" />
        </radialGradient>
      </defs>
      <g className="m-root">
        {!seated && <ellipse className="detail" cx="100" cy="191" rx="52" ry="5" fill="#000" opacity=".25" />}
        <g transform="translate(0 14)">
          <Leg x={86} dir={1} className="m-leg-l" drop={seated ? 14 : 0} />
          <Leg x={114} dir={-1} className="m-leg-r" drop={seated ? 14 : 0} />
          <g className="rig m-arm-l" style={{ transformOrigin: '36px 98px' }}><Limb d="M36 98Q14 106 18 128" width={9} /><Glove x={18} y={134} /></g>
          <g transform="translate(20 4) scale(.8)">
            <g transform="rotate(-12 100 100)">
              <path d={BALL} fill={`url(#${uid}-leather)`} stroke="#E9A66B" strokeOpacity=".5" strokeWidth="3" />
              <g className="detail" fill="none" stroke={CREAM} strokeWidth="8" strokeLinecap="round"><path d="M44 66Q55 100 44 134" /><path d="M156 66Q145 100 156 134" /></g>
              <g fill="none" stroke={CREAM} strokeWidth="5" strokeLinecap="round"><path d="M78 61H122" /><path d="M88 55V67M100 54V68M112 55V67" /></g>
              <g className="detail" fill="none" stroke="#3A1B0A" strokeWidth="5" strokeLinecap="round"><path className="m-brow" d="M58 77Q73 69 90 75" /><path className="m-brow" d="M110 75Q127 69 142 77" /></g>
              <g fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round">
                <path d="M55 101L33 96M145 101L167 96" />
                <circle cx="76" cy="104" r="21" fill="#fff" fillOpacity=".96" /><circle cx="124" cy="104" r="21" fill="#fff" fillOpacity=".96" />
                <path d="M97 101Q100 95 103 101" />
              </g>
              <g className="m-look"><g className="m-glance">{eye(76, 'l')}{eye(124, 'r')}</g></g>
              <g clipPath={`url(#${uid}-l)`}><rect className="m-lid" x="55" y="83" width="42" height="42" fill={LEATHER} /></g>
              <g clipPath={`url(#${uid}-r)`}><rect className="m-lid" x="103" y="83" width="42" height="42" fill={LEATHER} /></g>
              <g className="detail"><circle cx="64" cy="132" r="6" fill="#E58A5A" opacity=".45" /><circle cx="136" cy="132" r="6" fill="#E58A5A" opacity=".45" />
                <path d="M90 138Q100 148 110 138" fill="none" stroke="#3A1B0A" strokeWidth="4.5" strokeLinecap="round" /></g>
            </g>
          </g>
          <g className="rig m-arm-r" style={{ transformOrigin: '162px 88px' }}><Limb d="M162 88Q186 96 183 120" width={9} /><Glove x={183} y={128} /></g>
        </g>
      </g>
    </svg>
  );
}

/** The mascot telling the user something in a speech bubble. The text types itself out, while assistive technology reads it whole; `minLines` keeps room for a longer text that may replace it. */
export function MascotSays({ text, pointAt, minLines, children }: { text: string; pointAt?: 'left'; minLines?: number; children?: ReactNode }) {
  useLayoutEffect(() => registerPageMascot(), []); // before paint, so the header's mascot never shows beside this one
  return (
    <div className="empty mascot-says">
      <Mascot size={168} pointAt={pointAt} />
      <div className="bubble">
        {/* A polite live region: a changed text is announced once, whole, however it is typed on screen. */}
        <p aria-live="polite" style={minLines ? { minHeight: `${minLines * 1.45}em` } : undefined}><TypedText text={text} delay={350} /></p>
        {children}
      </div>
    </div>
  );
}
