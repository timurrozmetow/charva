import { cn } from '../cn';

import { Img, type ImgProps } from './Img';

export interface SlotMedia extends Pick<ImgProps, 'src' | 'alt' | 'lqip' | 'focalX' | 'focalY'> {
  width?: number;
  height?: number;
}

export interface ImageSlotProps {
  /**
   * `slot_key` from `content_slots` — «g-hero-1», «u-pack-cover».
   *
   * Emitted as a data attribute whether or not there is a photograph, so the admin's slot
   * checklist and anyone inspecting a page can see which row a rectangle belongs to.
   */
  slotKey: string;
  /**
   * The art direction from the handoff — «Газовый кратер Дарваза ночью — широкий кадр 21:9».
   *
   * Around 151 of these were transcribed into `docs/design/photo-brief.md` and become rows in
   * `content_slots`. This is the same text, in the place the photograph will go.
   */
  brief: string;
  /** The photograph, once one exists. `null` while the slot is unfilled. */
  media?: SlotMedia | null;
  /** CSS aspect ratio — `'21/9'`, `'4/5'`. Reserves the space so the page does not jump. */
  ratio?: string;
  sizes?: string;
  priority?: boolean;
  /**
   * Show the brief inside the placeholder.
   *
   * Off by default. The briefs are written in Russian, and a Russian art-direction note in the
   * middle of a Turkmen page is worse than a plain rectangle. Apps switch it on in development.
   */
  showBrief?: boolean;
  /** Recommended pixel size, shown alongside the brief. */
  recommended?: { width: number; height: number };
  className?: string;
}

/**
 * A photograph, or a branded rectangle standing in for one.
 *
 * The handoff contains no photographs at all — around 151 `<image-slot>` elements carrying a
 * sentence of Russian art direction each. That is the single largest thing blocking this
 * project, and this component plus the `content_slots` table is what stops it blocking
 * development: every page renders, every layout is real, and the gap is a row in a table with
 * a status rather than an undocumented absence. Decision D-21.
 *
 * The placeholder is deliberately branded rather than grey. A demo with grey boxes reads as
 * unfinished; a demo with sand-tinted panels in the right proportions reads as a site waiting
 * for its photographs, which is what it is.
 */
export function ImageSlot({
  slotKey,
  brief,
  media,
  ratio,
  sizes,
  priority = false,
  showBrief = false,
  recommended,
  className,
}: ImageSlotProps) {
  const style = ratio === undefined ? undefined : { aspectRatio: ratio };

  if (media != null) {
    return (
      <div data-slot={slotKey} style={style} className={cn('overflow-hidden', className)}>
        <Img
          src={media.src}
          alt={media.alt}
          {...(media.lqip === undefined ? {} : { lqip: media.lqip })}
          {...(media.focalX === undefined ? {} : { focalX: media.focalX })}
          {...(media.focalY === undefined ? {} : { focalY: media.focalY })}
          {...(media.width === undefined ? {} : { width: media.width })}
          {...(media.height === undefined ? {} : { height: media.height })}
          {...(sizes === undefined ? {} : { sizes })}
          priority={priority}
        />
      </div>
    );
  }

  return (
    <div
      data-slot={slotKey}
      // Not `role="img"`: there is no image here yet, and claiming one would put a rectangle
      // with no content into the accessibility tree. It is decoration until a photograph
      // arrives, and `alt` then comes from `media.alt`.
      aria-hidden="true"
      style={style}
      className={cn(
        'flex flex-col items-center justify-center gap-3 overflow-hidden p-6 text-center',
        'bg-tint-soft',
        // A hairline plus a diagonal wash, so it reads as a placeholder at a glance without
        // looking like a broken image.
        'border border-dashed border-tint-line',
        className,
      )}
    >
      <span className="font-black uppercase text-label text-accent-text">{slotKey}</span>

      {showBrief && (
        <>
          <span className="max-w-[36ch] text-bodySm font-light text-muted">{brief}</span>
          {recommended !== undefined && (
            <span className="font-bold uppercase text-label text-muted">
              {String(recommended.width)}×{String(recommended.height)}
            </span>
          )}
        </>
      )}
    </div>
  );
}
