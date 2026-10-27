export function statusWidgetUrl(widget) {
  if (widget?.provider !== 'livesklad' || widget.embedUrl !== 'https://my.livesklad.com/static/widget.html' || !/^[A-Za-z0-9_-]+$/.test(widget.publicEmbedId || '')) throw new Error('Invalid public status widget.');
  const url = new URL(widget.embedUrl);
  url.searchParams.set('key', widget.publicEmbedId);
  for (const [key, value] of Object.entries(widget.options || {})) {
    if (!['title','placeholder','name_placeholder','button_text','width','height','color','currency','hide_given','columns'].includes(key)) throw new Error('Unexpected public widget option.');
    url.searchParams.set(key, typeof value === 'string' ? value.replace('#', '') : String(value));
  }
  // The provider decodes with decodeURIComponent, which leaves form-style '+' intact.
  return url.href.replace(/\+/g, '%20');
}
