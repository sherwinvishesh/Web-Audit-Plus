/* Web Audit+ website. Progressive touches only: the page reads fine with this file blocked. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Mobile navigation.
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.getAttribute('data-open') === 'true';
      links.setAttribute('data-open', open ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    links.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        links.setAttribute('data-open', 'false');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Score rings draw themselves, and count up, when they scroll into view.
  var rings = document.querySelectorAll('.ring[data-score]');
  function light(ring) {
    if (!ring.classList.contains('is-off')) return;
    ring.classList.remove('is-off');
    var target = Number(ring.getAttribute('data-score')) || 0;
    var value = ring.querySelector('.value');
    if (!value) return;
    var start = null;
    var duration = 1100;
    function frame(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      value.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window && !reduceMotion) {
    // Rings start empty only when they will animate, so the page is complete without this file.
    rings.forEach(function (ring) {
      ring.classList.add('is-off');
      var value = ring.querySelector('.value');
      if (value) value.textContent = '0';
    });
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            light(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 },
    );
    rings.forEach(function (ring) {
      observer.observe(ring);
    });
  }

  // Copy buttons on code blocks.
  document.querySelectorAll('[data-copy]').forEach(function (button) {
    button.addEventListener('click', function () {
      var source = document.getElementById(button.getAttribute('data-copy'));
      if (!source || !navigator.clipboard) return;
      var label = button.textContent;
      navigator.clipboard.writeText(source.textContent || '').then(
        function () {
          button.textContent = 'Copied';
          setTimeout(function () {
            button.textContent = label;
          }, 1600);
        },
        function () {
          button.textContent = 'Copy failed';
          setTimeout(function () {
            button.textContent = label;
          }, 1600);
        },
      );
    });
  });

  // Table of contents: mark the section in view.
  var toc = document.querySelectorAll('.toc a[href^="#"]');
  if (toc.length && 'IntersectionObserver' in window) {
    var byId = {};
    toc.forEach(function (link) {
      byId[link.getAttribute('href').slice(1)] = link;
    });
    var current = null;
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var link = byId[entry.target.id];
          if (!link || link === current) return;
          if (current) current.removeAttribute('aria-current');
          link.setAttribute('aria-current', 'true');
          current = link;
        });
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    Object.keys(byId).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }
})();
