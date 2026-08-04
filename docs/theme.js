/**
 * Shared light/dark theme for waiair.app docs pages.
 * Default: light. Preference stored in localStorage.
 */
(function () {
  var KEY = 'waiair.site.theme';

  function safeGet() {
    try {
      var t = localStorage.getItem(KEY);
      return t === 'dark' || t === 'light' ? t : null;
    } catch (e) {
      return null;
    }
  }

  function apply(theme) {
    var next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#0f1117' : '#ffffff');
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      var isDark = next === 'dark';
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', isDark ? 'Light mode' : 'Dark mode');
      var label = btn.querySelector('[data-theme-label]');
      if (label) label.textContent = isDark ? 'Light' : 'Dark';
      var icon = btn.querySelector('[data-theme-icon]');
      if (icon) icon.textContent = isDark ? '☀' : '☾';
    });
    document.dispatchEvent(new CustomEvent('waiair-theme', { detail: { theme: next } }));
  }

  function current() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark');
  }

  // Apply early if not already set by inline head script
  if (!document.documentElement.getAttribute('data-theme')) {
    apply(safeGet() || 'light');
  } else {
    apply(current());
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        toggle();
      });
    });
    apply(current());
  });

  window.WaiAirTheme = { apply: apply, toggle: toggle, current: current };
})();
