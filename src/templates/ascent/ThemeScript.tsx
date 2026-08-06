/**
 * Sets `data-theme` before first paint, so a `?theme=` link and the toggle's
 * stored choice both resolve without a flash. A blocking inline script rather
 * than an effect: resolving the theme in React paints one theme then repaints
 * the other. Its own copy, not another template's — a lint rule forbids one
 * template importing another, which is the rule that keeps the designs distinct.
 *
 * Precedence: `?theme=` in the URL, then the `theme` cookie, then light.
 */
const SCRIPT = `(function(){
  var d = document.documentElement;
  var theme;
  try {
    var q = new URLSearchParams(location.search).get('theme');
    var m = document.cookie.match(/(?:^|; )theme=([^;]+)/);
    var cookie = m ? decodeURIComponent(m[1]) : null;
    theme = q || cookie;
    if (theme !== 'light' && theme !== 'dark') theme = 'light';
  } catch (e) {
    theme = 'light';
  }
  d.dataset.theme = theme;
})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
