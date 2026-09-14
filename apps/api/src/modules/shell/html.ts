/**
 * Turning a head into HTML.
 *
 * Deliberately string building and not a template engine. The whole job is a dozen tags with
 * one escaping rule, and the alternative is a dependency, a template file that has to stay in
 * step with the SPA's own `index.html`, and a second place for the shell to be wrong.
 */

/**
 * Escaping for text that lands inside an attribute or between tags.
 *
 * Everything here comes from the database — a tour title an editor typed — so it is not
 * trusted markup. `'` and `"` matter because every value below is inside an attribute; `<`
 * and `&` because the description is also written into a `<title>`.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * JSON-LD, escaped for a `<script>` block.
 *
 * The one place where HTML escaping would be wrong — the content is JSON, and `&quot;` inside
 * it is a parse error. What actually has to be neutralised is the sequence that would close
 * the script element early, which is the whole attack: a tour summary containing `</script>`
 * followed by anything at all.
 */
export function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export interface HeadTag {
  tag: 'title' | 'meta' | 'link' | 'script';
  attributes?: Record<string, string>;
  /** Only for `title` and `script`. */
  text?: string;
}

export function renderTag(tag: HeadTag): string {
  const attributes = Object.entries(tag.attributes ?? {})
    .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
    .join('');

  if (tag.tag === 'meta' || tag.tag === 'link') return `<${tag.tag}${attributes}>`;

  // `script` carries JSON-LD, already escaped for this context by `escapeJsonLd`, or a counter
  // snippet built from ids that were pattern-checked before they got here — either way it is
  // JavaScript and HTML-escaping it would break it. `title` carries text, which still needs the
  // ordinary treatment.
  const text = tag.tag === 'title' ? escapeHtml(tag.text ?? '') : (tag.text ?? '');
  return `<${tag.tag}${attributes}>${text}</${tag.tag}>`;
}

export function renderHead(tags: HeadTag[]): string {
  return tags.map((tag) => `    ${renderTag(tag)}`).join('\n');
}

/** `<!-- … -->`, including the unterminated tail of a malformed one. */
const COMMENT = /<!--[\s\S]*?(?:-->|$)/g;

/** What a set-aside comment is replaced by while the strip runs. */
const PLACEHOLDER = (index: number) => `@@charva-comment-${String(index)}@@`;
const PLACEHOLDER_PATTERN = /@@charva-comment-(\d+)@@/g;

/**
 * Removes the template's own title and description — but only where they are markup.
 *
 * The title pattern has to span lines, because it matches a pair of tags with text between
 * them, and that is what makes it dangerous on a file it does not parse: a `<title>` written
 * inside an HTML comment matches as the opening tag, and `[\s\S]*?` then runs from there to the
 * *real* closing tag further down, deleting everything in between.
 *
 * That is not hypothetical. A comment in the SPA templates explaining this very rule named the
 * tag, and the live chooser shipped with the comment cut off mid-sentence and the
 * Google verification tag that sat between them simply gone. No error, valid HTML, and nothing
 * to notice except a tag that was in the file on disk and not in the response.
 *
 * So comments are set aside, the strip runs on the markup between them, and they go back. A
 * parser would be the thorough answer; these are files we author, the only construct they have
 * that can hide a tag is a comment, and two regexes are cheaper than a DOM on every request.
 *
 * The placeholder is spelled out rather than being some unprintable sentinel, because this
 * string can reach a reader: if the restore ever failed, `@@charva-comment-3@@` in the page
 * source says what happened, and a stray control character says nothing at all.
 */
function stripOwnHead(template: string): string {
  const comments: string[] = [];

  const masked = template.replace(COMMENT, (comment) => {
    comments.push(comment);
    return PLACEHOLDER(comments.length - 1);
  });

  const stripped = masked
    .replace(/\s*<title>[\s\S]*?<\/title>/i, '')
    .replace(/\s*<meta\s+name="description"[^>]*>/gi, '');

  return stripped.replace(PLACEHOLDER_PATTERN, (_match, index: string) => {
    const comment = comments[Number(index)];
    // Unreachable unless the strip above learns to eat a placeholder. Loud rather than silent:
    // a swallowed comment is how this whole function came to exist.
    if (comment === undefined) throw new Error(`Lost HTML comment ${index} while stripping head`);
    return comment;
  });
}

/**
 * Puts the rendered head into the SPA's own `index.html`.
 *
 * The template is the built file, so the script and stylesheet links — with their content
 * hashes — are whatever Vite last emitted. Nothing here knows their names, which is what stops
 * the shell from having to be redeployed in step with the bundle.
 *
 * The existing title and description are removed rather than appended to: a page with two
 * titles gets whichever one the reader's parser prefers, and Telegram and Google do not agree
 * on which that is.
 */
export function injectHead(template: string, head: string): string {
  const stripped = stripOwnHead(template);

  const marker = stripped.indexOf('</head>');
  if (marker === -1) {
    throw new Error('The SPA template has no </head> to render into');
  }

  return `${stripped.slice(0, marker)}${head}\n  ${stripped.slice(marker)}`;
}
