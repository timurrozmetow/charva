export interface ProseProps {
  /** The editor's text. Blank lines separate paragraphs; nothing else is markup. */
  text: string;
  className?: string;
}

/**
 * A body of editor-written text.
 *
 * Rendered as paragraphs split on blank lines, and deliberately **not** as HTML. The three
 * detail pages are the first place in this project where a database column becomes prose on a
 * public page, and `dangerouslySetInnerHTML` there would mean every admin account is one stored
 * cross-site script away from every visitor's session — for the sake of markup nobody has asked
 * for yet. If the admin ever grows a rich-text editor (phase 7), this is where sanitising goes,
 * once, rather than at three call sites that mostly agree.
 */
export function Prose({ text, className }: ProseProps) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');

  if (paragraphs.length === 0) return null;

  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        <p
          key={`${String(index)}-${paragraph.slice(0, 24)}`}
          className="mt-5 text-body font-light leading-relaxed text-body first:mt-0"
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}
