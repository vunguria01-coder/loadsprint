/**
 * Animated logistics backdrop for the premium login screen.
 *
 * A stylized US map: glowing hub cities connected by shipping routes, with a
 * lit "truck" dot travelling along each route and a slow flowing dash on the
 * lanes. Pure SVG + CSS — no JS, no external image. All motion lives in
 * globals.css (scoped to `.logi-bg`) and is disabled under
 * `prefers-reduced-motion: reduce`.
 *
 * Every route path uses `pathLength={100}` so the dash math is identical
 * regardless of the path's real length.
 */

// Hub cities, positioned to read as the continental US on a 1000×600 canvas.
const HUBS: { x: number; y: number }[] = [
  { x: 120, y: 90 }, // Seattle
  { x: 110, y: 340 }, // Los Angeles
  { x: 390, y: 260 }, // Denver
  { x: 500, y: 400 }, // Dallas
  { x: 640, y: 220 }, // Chicago
  { x: 720, y: 360 }, // Atlanta
  { x: 800, y: 500 }, // Miami
  { x: 870, y: 190 }, // New York
];

// Shipping lanes between hubs (quadratic curves for a great-circle feel).
const ROUTES: string[] = [
  "M120,90 Q380,60 640,220", // Seattle → Chicago
  "M110,340 Q240,240 390,260", // LA → Denver
  "M390,260 Q510,180 640,220", // Denver → Chicago
  "M110,340 Q300,470 500,400", // LA → Dallas
  "M500,400 Q610,430 720,360", // Dallas → Atlanta
  "M640,220 Q760,150 870,190", // Chicago → NY
  "M720,360 Q840,300 870,190", // Atlanta → NY
  "M720,360 Q790,420 800,500", // Atlanta → Miami
  "M390,260 Q400,340 500,400", // Denver → Dallas
  "M500,400 Q600,300 640,220", // Dallas → Chicago
];

export function LogisticsBackdrop() {
  return (
    <svg
      className="logi-bg"
      viewBox="0 0 1000 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {/* Faint base network */}
      {ROUTES.map((d, i) => (
        <path key={`b${i}`} className="route-base" d={d} pathLength={100} />
      ))}

      {/* Flowing lanes */}
      {ROUTES.map((d, i) => (
        <path
          key={`f${i}`}
          className="route-flow"
          d={d}
          pathLength={100}
          style={{ animationDelay: `${(i % 5) * -1.3}s` }}
        />
      ))}

      {/* Trucks travelling the lanes */}
      {ROUTES.map((d, i) => (
        <path
          key={`t${i}`}
          className="route-truck"
          d={d}
          pathLength={100}
          style={{ animationDelay: `${-i * 0.9}s` }}
        />
      ))}

      {/* Hub cities */}
      {HUBS.map((h, i) => (
        <g key={`h${i}`}>
          <circle
            className="hub-pulse"
            cx={h.x}
            cy={h.y}
            r={6}
            style={{ animationDelay: `${-i * 0.5}s` }}
          />
          <circle className="hub-core" cx={h.x} cy={h.y} r={4} />
        </g>
      ))}
    </svg>
  );
}
