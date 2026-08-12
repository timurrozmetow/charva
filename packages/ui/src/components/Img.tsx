import { IMAGE_WIDTHS } from '@charva/contracts';
import { type ImgHTMLAttributes, useCallback, useState } from 'react';

import { cn } from '../cn';

/**
 * Widths the API is willing to resize to.
 *
 * Declared in `@charva/contracts` and re-exported here, so the list `srcSet` asks for and the
 * list `/img` will produce are one list. Two copies would drift the day somebody adds a
 * breakpoint, and the symptom is a 400 on one image size at one viewport width.
 */
export { IMAGE_WIDTHS };

const RESIZABLE = /\.(webp|jpe?g|png|avif)$/i;

/**
 * Turns a stored image URL into a `srcSet` against the resize endpoint.
 *
 * The API serves originals from `/uploads/…` and derivatives from `/img/…?w=`, so the two
 * differ by one path segment. Returns undefined for anything that is not a resizable upload —
 * an external URL, an SVG, a video poster already sized — and the `<img>` then just uses `src`.
 */
export function buildSrcSet(src: string): string | undefined {
  const marker = '/uploads/';
  const at = src.indexOf(marker);
  if (at < 0) return undefined;

  const prefix = src.slice(0, at);
  const name = src.slice(at + marker.length);
  if (!RESIZABLE.test(name)) return undefined;

  return IMAGE_WIDTHS.map(
    (width) => `${prefix}/img/${name}?w=${String(width)} ${String(width)}w`,
  ).join(', ');
}

export interface ImgProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'alt' | 'width' | 'height'
> {
  src: string;
  /**
   * Required, with no default.
   *
   * An empty string is a legitimate answer for a decorative image, but it has to be typed
   * deliberately. A default of `''` — which is what the component this is ported from does —
   * means every photograph on the site is silently decorative until somebody notices.
   */
  alt: string;
  /** Intrinsic size. Both together reserve the space and stop the page jumping as it loads. */
  width?: number;
  height?: number;
  sizes?: string;
  /**
   * Above-the-fold hero. Loads eagerly at high priority and skips the fade, because fading in
   * the largest element on the page is exactly how a Largest Contentful Paint score is lost.
   */
  priority?: boolean;
  /** Tiny inline preview from `media.lqip`, shown blurred until the real pixels arrive. */
  lqip?: string;
  /** Subject position, 0–1 from the top left. From `media.focal_x` / `focal_y`. */
  focalX?: number;
  focalY?: number;
}

/**
 * A photograph.
 *
 * The handoff has none, and `<image-slot>` is a design-tool element with no browser behaviour
 * at all: no `srcset`, no lazy loading, no dimensions and no alternative text. All of that has
 * to exist here, because this audience reaches the site from phones on mobile data and the
 * pages are mostly photographs.
 */
export function Img({
  src,
  alt,
  width,
  height,
  sizes = '100vw',
  priority = false,
  lqip,
  focalX,
  focalY,
  className,
  style,
  ...rest
}: ImgProps) {
  const [loaded, setLoaded] = useState(priority);

  // A cached image can finish decoding before React binds `onLoad`, which would strand it at
  // zero opacity forever. The ref callback catches that case on mount.
  const ref = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete === true) setLoaded(true);
  }, []);

  const objectPosition =
    focalX === undefined && focalY === undefined
      ? undefined
      : `${String((focalX ?? 0.5) * 100)}% ${String((focalY ?? 0.5) * 100)}%`;

  return (
    <img
      ref={priority ? undefined : ref}
      src={src}
      srcSet={buildSrcSet(src)}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      // Lowercase, and spread. React 18 does not know `fetchPriority` and warns about it on
      // every render; it reaches the DOM either way, but the console fills up. React 19 adds
      // the camelCase prop, at which point this can become one.
      {...(priority ? ({ fetchpriority: 'high' } as Record<string, string>) : {})}
      decoding="async"
      onLoad={() => {
        setLoaded(true);
      }}
      // A broken image must never sit at zero opacity: the alternative text has to be readable.
      onError={() => {
        setLoaded(true);
      }}
      style={{
        ...style,
        ...(objectPosition === undefined ? {} : { objectPosition }),
        ...(lqip !== undefined && !loaded
          ? { backgroundImage: `url("${lqip}")`, backgroundSize: 'cover' }
          : {}),
      }}
      className={cn(
        'h-full w-full object-cover',
        !priority && 'transition-opacity duration-lift',
        !priority && (loaded ? 'opacity-100' : 'opacity-0'),
        className,
      )}
      {...rest}
    />
  );
}
