# Stat Watch mascot

A football wearing glasses: the stat-watcher. Four directions were drawn so one can be picked; **no direction is chosen yet**. This page records the brief, the four options, what each costs, and how motion and size were designed in, so the pick can go straight into the app.

![The four directions on the dark and the light theme](mascot/overview.png)

Left to right: Studious, Scoreboard, Sticker, Monoline. Top row on the dark theme, bottom row on the light one.

## Brief

- It represents the site: a football that looks at the game through glasses, a stat nerd rather than a jock.
- It appears in several places, from tiny (header logo, a corner of a card, the browser tab) to big (empty states, an error or loading page, the red-zone alert).
- It must look right at both ends, so every direction has a reduced version for small sizes.
- It must animate well. Motion is not built yet, but every direction is drawn with the moving parts separate, and a first set of motions is already in the prototype to prove it.
- It stays inside the app's palette: forest green and mint (`#0B1810`, `#122319`, `#86EFAC`, `#14532D`), plus a leather brown that is not the orange of the pylon accent.

## How the options were made

Direction came from the frontend-design lens: one memorable thing (the glasses), everything else quiet, nothing borrowed from a generic mascot kit. The craft lens (Emil Kowalski) then critiqued it for motion: ease-out on everything that responds, transform and opacity only, nothing that restarts from zero when interrupted, reduced motion respected, and idle motion kept rare enough not to wear on a page people leave open all Sunday. The critique changed three things: the moving parts were separated into named groups, the first Scoreboard idea (a single wide visor, which read as a robot) became two lenses with temples, and the Monoline laces moved away from the lens.

## The four directions

| Direction | Axis | Wins when | Costs |
| --- | --- | --- | --- |
| [Studious](mascot/studious.svg) | Depth: shaded, full character with brows, cheeks and a smile | You want a mascot people grow fond of, mostly at medium and large sizes | The most detail to keep legible, so the smallest sizes lose the face and keep only eyes and shape |
| [Scoreboard](mascot/scoreboard.svg) | Face concept: flat, geometric, glasses as dark lenses with mint stat-line eyes | You want it to feel like part of the app, in its own colours | Least human of the four; the mint eyes tie it to the app and to nothing else |
| [Sticker](mascot/sticker.svg) | Body: a standing football with arms and cleats, thick ink outline, white sticker edge | You want poses (waving, cheering at a touchdown) and a character that can carry a page | The most to draw and animate; the white edge and shadow need a CSS filter, and at small sizes it is only the head |
| [Monoline](mascot/monoline.svg) ([light](mascot/monoline-light.svg)) | Theming: one stroke in one colour, follows the surface | You want an icon that sits in headers and buttons and recolours with the theme | Least personality; thin at the smallest sizes, so it should not go below 24 px |

## Size behaviour

Each direction has a full drawing and a reduced one. The reduced one is the same artwork with the elements marked `detail` hidden: the mouth, brows, cheeks, stripes, shading, legs and shadow. It is used at 32 px and below. Anything under 24 px reads as a brown or mint football with two eyes, which is the intended minimum recognition. The prototype shows each direction at 16, 24, 32, 48, 72, 112 and 260 px on both themes, in the header, in an empty state, and in a toast.

## Motion hooks

Every direction exposes the same class names, so one set of motion CSS serves whichever is chosen:

| Class | What moves | Used for |
| --- | --- | --- |
| `m-root` | The whole mascot | Entrance (a short rise and fade), a slow idle bob, the wiggle on a reaction |
| `m-look` and `m-glance` | The pupils or eyes | Following the pointer (the outer group), and an occasional glance when nothing moves (the inner group) |
| `m-lid` or `m-eye` | Eyelids, or the eyes themselves | Blinking about every five seconds |
| `m-pupil` | Each pupil | Widening when something exciting happens |
| `m-brow` | Eyebrows | Lifting on a reaction (Studious) |
| `m-arm-r` | The right arm (Sticker) | Waving |

The prototype's motion uses CSS only, animates transform and opacity only, uses one strong ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`) for everything that responds, and keeps each action under 700 ms. A reaction, shown by the "Red zone!" button, takes about 700 ms. Under `prefers-reduced-motion` the idle bob, blink, glance and reaction are all switched off, and pointer-following is skipped. The idle motion is deliberately small (a 3 px bob, a blink every few seconds) because the mascot sits on a page that stays open for hours.

## Try it

`docs/mascot/prototype.html` is a throwaway page with a picker for the four directions. It lives in `docs/`, so it is never built or deployed. Open the file in a browser, then:

- `1` to `4`, or the arrow keys, switch direction; `R` replays the entrance.
- Click the big mascot, or press `E`, for the red-zone reaction. The pupils follow the pointer.

The `.svg` files next to it are static poses with the hooks above kept as classes. They carry no motion; the sticker's white edge is a CSS filter set inline on the file.

## Not decided or not done

- Which direction to use. Once one is chosen the others and the prototype go.
- Where it goes first, and the real motion: the red-zone alert and the empty states are the natural first places, and the pose set for Sticker would be drawn then.
- A browser tab icon: at 16 px the Scoreboard and Studious shapes survive; Monoline and Sticker need a purpose-made simplified version.
