// The Terset mark, drawn from the one geometry source in brand/mark.ts.
// Colors come from CSS tokens, so the tile reads in both themes.
import { FAINT, FAINT_OPACITY, GRID, HEADER, LIT, TILE_RADIUS } from '../brand/mark.ts';
import type { Box } from '../brand/mark.ts';

function Rect({ box }: { readonly box: Box }) {
  return <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={box.r} />;
}

function Shapes({ className }: { readonly className?: string }) {
  return (
    <g className={className}>
      {[HEADER, ...LIT].map((box) => (
        <Rect key={`${String(box.x)}-${String(box.y)}`} box={box} />
      ))}
      <g opacity={FAINT_OPACITY}>
        {FAINT.map((box) => (
          <Rect key={`${String(box.x)}-${String(box.y)}`} box={box} />
        ))}
      </g>
    </g>
  );
}

export type MarkVariant = 'tile' | 'bare';

/** tile: the mark on its tile, colored by --mark-tile and --mark-fg. bare: the mark alone in currentColor. Size in CSS pixels. */
export function BrandMark({ size, variant = 'tile' }: { readonly size: number; readonly variant?: MarkVariant }) {
  return (
    <svg className="mark" width={size} height={size} viewBox={`0 0 ${String(GRID)} ${String(GRID)}`} aria-hidden="true" focusable="false">
      {variant === 'tile' ? (
        <>
          <rect className="mark-t" width={GRID} height={GRID} rx={TILE_RADIUS} />
          <Shapes className="mark-m" />
        </>
      ) : (
        <Shapes className="mark-bare" />
      )}
    </svg>
  );
}

/** Mark plus wordmark. The gap and weight match the lockup files in public/brand. */
export function BrandLockup({ size = 28 }: { readonly size?: number }) {
  return (
    <>
      <BrandMark size={size} />
      <span className="brand-word">terset</span>
    </>
  );
}
