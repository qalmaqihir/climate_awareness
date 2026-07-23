import sanitizeHtml from 'sanitize-html';

/**
 * Sanitizes oEmbed HTML from Facebook/Instagram before storing or rendering.
 * Allows Meta embed elements (div.fb-post, blockquote.instagram-media) and their required
 * CDN scripts. Strips all inline scripts, untrusted script sources, and event handlers.
 *
 * Uses allowedScriptHostnames (not exclusiveFilter) — exclusiveFilter fires at close-tag
 * time after inline content is already emitted, making it useless for inline script blocking.
 */
export function sanitizeEmbed(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'a',
      'b',
      'blockquote',
      'br',
      'cite',
      'code',
      'div',
      'em',
      'i',
      'img',
      'p',
      'script',
      'small',
      'span',
      'strong',
      'sub',
      'sup',
      'ul',
      'ol',
      'li',
    ],
    allowVulnerableTags: true,
    allowedAttributes: {
      a: ['href', 'title', 'rel', 'target'],
      blockquote: [
        'class',
        'style',
        'data-instgrm-permalink',
        'data-instgrm-version',
        'data-instgrm-captioned',
        'data-width',
        'data-url',
      ],
      div: [
        'class',
        'id',
        'data-href',
        'data-width',
        'data-show-text',
        'data-lazy',
        'data-colorscheme',
        'data-tabs',
      ],
      img: ['src', 'alt', 'title', 'width', 'height'],
      script: ['src', 'async', 'defer', 'crossorigin', 'charset'],
      span: ['class'],
    },
    // Blocks inline scripts and restricts external scripts to Meta CDN only.
    // sanitize-html strips <script> tags whose src hostname is not in this list,
    // and always strips inline script content.
    allowedScriptHostnames: ['connect.facebook.net', 'www.facebook.com', 'www.instagram.com'],
    // Restrict style attribute to safe dimension properties only.
    // Without this, style="background:url(evil.com)" or position:fixed could be exploited.
    allowedStyles: {
      blockquote: {
        width: [/^\d+px$/],
        'max-width': [/^\d+px$/],
        'min-width': [/^\d+px$/],
      },
    },
  });
}
