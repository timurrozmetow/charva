import { type Lang, type Video } from '@charva/contracts';
import { Icon } from '@charva/ui';
import { useState } from 'react';

import { copyFor } from '../i18n';

export interface VideoPlayerProps {
  video: Video;
  lang: Lang;
  className?: string;
}

/**
 * A video, played where it is.
 *
 * The handoff has no player at all: the round play button is decoration with
 * `pointer-events: none` on it, over a poster that never becomes anything. This is that
 * interaction.
 *
 * Nothing loads until it is asked for. The poster is an image and the `<video>` element is
 * created on the first press with `preload="none"` — a page of six clips that each fetched
 * metadata would spend several megabytes of somebody's mobile data before they had chosen to
 * watch anything.
 *
 * The file is served by the API with byte ranges, so scrubbing works; the browser's own
 * controls are used rather than rebuilt, because a hand-made scrubber is a keyboard trap and
 * a caption track nobody wires up.
 */
export function VideoPlayer({ video, lang, className }: VideoPlayerProps) {
  const copy = copyFor(lang);
  const [playing, setPlaying] = useState(false);

  if (playing && video.url !== null) {
    /*
     * No caption track, and the rule is disabled deliberately for it.
     *
     * Subtitles are content: somebody has to write them, in three languages, for footage that
     * does not exist yet — question Q-3 covers the copy and `BACKLOG.md` carries the track as
     * deferred. An empty `<track>` element satisfies the linter and helps nobody, which is
     * worse than an honest gap: it makes the page claim captions it does not have.
     */
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={video.url}
        {...(video.poster === null ? {} : { poster: video.poster.url })}
        controls
        autoPlay
        preload="metadata"
        className={className}
      >
        {copy.video.noPlayer}
      </video>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setPlaying(true);
      }}
      disabled={video.url === null}
      className={`group relative block overflow-hidden ${className ?? ''}`}
    >
      {video.poster === null ? (
        <span className="flex size-full items-center justify-center bg-dark-alt" />
      ) : (
        <img src={video.poster.url} alt={video.poster.alt} className="size-full object-cover" />
      )}

      <span aria-hidden="true" className="absolute inset-0 bg-scrim-soft" />

      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 flex size-[88px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent transition-transform duration-lift group-hover:scale-105"
      >
        {/* An icon, not the literal `▶` the prototype types: Stolzl has no such glyph and the
            browser substitutes a system font, so the triangle differs per platform (D-26). The
            optical centring the design does with `padding-left:6px` is in the icon itself. */}
        <Icon name="play" size={26} className="text-accent-on" />
      </span>

      <span className="sr-only">
        {copy.video.play}: {video.title}
      </span>
    </button>
  );
}
