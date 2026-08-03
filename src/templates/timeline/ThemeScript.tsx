/**
 * Sets `data-theme` before first paint.
 *
 * A blocking inline script rather than an effect: resolving the theme in React
 * means the browser paints the default and then repaints the other one, which
 * on a near-black site is a full-screen white flash.
 *
 * Precedence, highest first:
 *   1. `?theme=` in the URL, so a shared link carries its mode.
 *   2. The `theme` cookie — the toggle's stored choice.
 *   3. A legacy `localStorage` choice, migrated to the cookie on the spot, so a
 *      visitor who chose a theme before this moved to cookies keeps it.
 *   4. Light.
 *
 * The choice lives in a cookie rather than `localStorage` so it is a first-class
 * stored preference the server could also read; the script still resolves it
 * client-side before first paint, which is what keeps the page static and the
 * switch flash-free.
 *
 * `four-color` and `noir` are accepted and mapped across — they are the ids this
 * site shipped under while it was a comic, and a stored choice should survive
 * the rename rather than appearing to be forgotten. The mapping is duplicated
 * from `normalizeTheme` in tokens.ts because this is a string that runs before
 * any module has loaded.
 *
 * Light is the default rather than following `prefers-color-scheme`: the theme
 * is a design choice, not an OS preference, and someone whose OS is dark should
 * still open on the site as drawn. The toggle is one click away.
 */
const SCRIPT = `(function(){
  var d = document.documentElement;
  var theme;
  try {
    var q = new URLSearchParams(location.search).get('theme');
    var m = document.cookie.match(/(?:^|; )theme=([^;]+)/);
    var cookie = m ? decodeURIComponent(m[1]) : null;
    var legacy = cookie ? null : localStorage.getItem('comic-portfolio:theme');
    theme = q || cookie || legacy;
    if (theme === 'four-color') theme = 'light';
    if (theme === 'noir') theme = 'dark';
    if (theme !== 'light' && theme !== 'dark') theme = 'light';
    // Carry a legacy localStorage choice forward into the cookie once.
    if (!cookie && legacy) {
      document.cookie = 'theme=' + theme + '; path=/; max-age=31536000; samesite=lax';
    }
  } catch (e) {
    theme = 'light';
  }
  d.dataset.theme = theme;
})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
