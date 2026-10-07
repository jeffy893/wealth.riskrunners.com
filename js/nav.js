/* ============================================================================
   Wealthcare — Proactive Wealthcare :: nav.js (FEAT-001)
   The only interactive JS on non-dashboard pages:
     (a) mobile hamburger toggle (<=640px)
     (b) active-link marking via aria-current="page"
   Defensive per design.md §10.1 — every DOM lookup is guarded; never throws.
   Invariant: zero-or-one nav link carries aria-current="page".
   Author: Jefferson Richards <Jefferson@richards.plus>

   Markup contract this script expects:
     <button class="nav-toggle" aria-expanded="false" aria-controls="primary-nav">…</button>
     <nav id="primary-nav" class="primary-nav" aria-label="Primary">
       <a href="index.html">…</a> … (one <a> per page)
     </nav>
   ========================================================================== */
(function () {
    'use strict';

    function init() {
        setupToggle();
        markActiveLink();
    }

    /* (a) Mobile hamburger toggle. If either element is missing, warn once and
       bail — the nav still renders as the default desktop layout and the plain
       <a> links keep working. Non-fatal. */
    function setupToggle() {
        var btn = document.querySelector('.nav-toggle');
        if (!btn) {
            console.warn('nav.js: ".nav-toggle" button not found; skipping mobile toggle.');
            return;
        }

        var menu = document.querySelector('#primary-nav');
        if (!menu) {
            console.warn('nav.js: "#primary-nav" menu not found; skipping mobile toggle.');
            return;
        }

        btn.addEventListener('click', function () {
            var isOpen = menu.classList.toggle('is-open');
            btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }

    /* (b) Active-link marking. Clear aria-current from all nav links first
       (enforces the zero-or-one invariant), then set it on the single link
       whose href filename matches the current page. If nothing matches, leave
       none set. Guarded throughout; never throws. */
    function markActiveLink() {
        var nav = document.querySelector('#primary-nav');
        if (!nav) {
            console.warn('nav.js: "#primary-nav" not found; skipping active-link marking.');
            return;
        }

        var links = nav.querySelectorAll('a[href]');
        if (!links || !links.length) {
            return;
        }

        // Always clear first so at most one link ends up marked.
        for (var i = 0; i < links.length; i++) {
            links[i].removeAttribute('aria-current');
        }

        var current = currentFile();

        for (var j = 0; j < links.length; j++) {
            var linkFile = fileFromHref(links[j].getAttribute('href'));
            if (linkFile === null) {
                continue;
            }
            if (linkFile === current) {
                links[j].setAttribute('aria-current', 'page');
                return; // zero-or-one invariant: stop at the first match
            }
        }
    }

    /* Normalize the current location's filename. A bare directory ('/' or a
       trailing slash) is treated as 'index.html'. */
    function currentFile() {
        var path = (window.location && window.location.pathname) || '';
        return normalizeFile(path);
    }

    /* Extract a comparable filename from an href. Returns null for links we
       should not treat as page nav (absolute http(s) URLs, pure anchors,
       mailto:, tel:, etc.) so they never win the active match. */
    function fileFromHref(href) {
        if (!href) {
            return null;
        }
        // Ignore external, protocol, and pure-anchor links.
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href) || href.charAt(0) === '#') {
            return null;
        }
        return normalizeFile(href);
    }

    /* Reduce a path or href to its final path segment, stripping any query or
       hash, and mapping an empty/slash-terminated value to 'index.html'. */
    function normalizeFile(value) {
        if (!value) {
            return 'index.html';
        }
        // Drop query string and hash.
        var clean = value.split('#')[0].split('?')[0];
        // Take the last path segment.
        var parts = clean.split('/');
        var last = parts[parts.length - 1];
        if (!last) {
            return 'index.html';
        }
        return last;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
