/**
 * Sets `data-theme` before first paint, so a `?theme=` link and the toggle's
 * stored choice both resolve without a flash.
 *
 * A blocking inline script rather than an effect: resolving the theme in React
 * paints the default first and then repaints the other, which on a full-bleed
 * paper or near-black page is a full-screen flash. Its own copy, not
 * `timeline`'s — a lint rule forbids one template importing another, which is
 * the rule that keeps the designs from converging.
 *
 * Precedence: `?theme=` in the URL, then the `theme` cookie, then light. Light
 * is the default rather than the OS preference: the theme is a design choice,
 * and the toggle is one click away.
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
