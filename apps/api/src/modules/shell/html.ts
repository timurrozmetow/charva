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

  // `script` carries JSON-LD, already escaped for this context by `escapeJsonLd`; `title`
  // carries text, which still needs the ordinary treatment.
  const text = tag.tag === 'title' ? escapeHtml(tag.text ?? '') : (tag.text ?? '');
  return `<${tag.tag}${attributes}>${text}</${tag.tag}>`;
}

export function renderHead(tags: HeadTag[]): string {
  return tags.map((tag) => `    ${renderTag(tag)}`).join('\n');
}

/**
 * Puts the rendered head into the SPA's own `index.html`.
 *
 * The template is the built file, so the script and stylesheet links — with their content
 * hashes — are whatever Vite last emitted. Nothing here knows their names, which is what stops
 * the shell from having to be redeployed in step with the bundle.
 *
 * The existing `<title>` and description are removed rather than appended to: a page with two
 * titles gets whichever one the reader's parser prefers, and Telegram and Google do not agree
 * on which that is.
 */
export function injectHead(template: string, head: string): string {
  const stripped = template
    .replace(/\s*<title>[\s\S]*?<\/title>/i, '')
    .replace(/\s*<meta\s+name="description"[^>]*>/gi, '');

  const marker = stripped.indexOf('</head>');
  if (marker === -1) {
    throw new Error('The SPA template has no </head> to render into');
  }

  return `${stripped.slice(0, marker)}${head}\n  ${stripped.slice(marker)}`;
}
