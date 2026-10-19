(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;

  // Footer year
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Header state on scroll
  var header = document.querySelector('header.site');
  function onScroll() { header && header.classList.toggle('scrolled', window.scrollY > 10); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile menu
  var menuBtn = document.querySelector('.menu-btn');
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = document.body.classList.toggle('menu-open');
      menuBtn.setAttribute('aria-expanded', open);
    });
    document.querySelectorAll('nav.main a').forEach(function (a) {
      a.addEventListener('click', function () { document.body.classList.remove('menu-open'); });
    });
  }

  // Split headings into words for a staggered reveal
  document.querySelectorAll('[data-split]').forEach(function (el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var s = document.createElement('span');
            s.className = 'w'; s.style.setProperty('--i', i++); s.textContent = part;
            frag.appendChild(s);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    })(el);
    el.classList.add('split');
    requestAnimationFrame(function () { setTimeout(function () { el.classList.add('in'); }, 120); });
  });

  // Reveal on scroll + counters
  function countUp(el) {
    var target = parseFloat(el.dataset.count), dec = (el.dataset.count.split('.')[1] || '').length;
    if (reduce) { el.textContent = target.toFixed(dec); return; }
    var start = null, dur = 1600;
    function step(t) {
      if (!start) start = t;
      var p = Math.min((t - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      en.target.querySelectorAll('[data-count]').forEach(countUp);
      io.unobserve(en.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal, .reveal-scale').forEach(function (el) { io.observe(el); });

  // Cursor spotlight in hero + card glow + button sheen
  if (fine && !reduce) {
    document.querySelectorAll('.hero, .page-hero').forEach(function (h) {
      h.addEventListener('pointermove', function (e) {
        var r = h.getBoundingClientRect();
        h.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        h.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
    document.querySelectorAll('.card, .btn-primary').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--x', (e.clientX - r.left) + 'px');
        c.style.setProperty('--y', (e.clientY - r.top) + 'px');
      });
    });
    // 3D tilt on hero mockup
    var stage = document.querySelector('.stage'), tilt = document.querySelector('.tilt');
    if (stage && tilt) {
      stage.addEventListener('pointermove', function (e) {
        var r = stage.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.transform = 'rotateY(' + (px * 10) + 'deg) rotateX(' + (-py * 8) + 'deg)';
      });
      stage.addEventListener('pointerleave', function () { tilt.style.transform = ''; });
    }
  }

  // Cycle demo screens in the hero mockup
  document.querySelectorAll('[data-cycle]').forEach(function (wrap) {
    var screens = wrap.querySelectorAll('.screen'), urlEl = document.querySelector(wrap.dataset.cycle), i = 0;
    if (screens.length < 2 || reduce) return;
    setInterval(function () {
      screens[i].classList.remove('on');
      i = (i + 1) % screens.length;
      screens[i].classList.add('on');
      if (urlEl) urlEl.textContent = screens[i].dataset.url;
    }, 3800);
  });

  // Before / after slider
  document.querySelectorAll('.ba').forEach(function (ba) {
    var input = ba.querySelector('input[type=range]');
    function set(v) { ba.style.setProperty('--pos', v + '%'); }
    input.addEventListener('input', function () { set(input.value); });
    set(input.value);
    // Gentle nudge the first time it scrolls into view so people know it moves
    if (!reduce) {
      var nudged = false;
      new IntersectionObserver(function (en, obs) {
        if (!en[0].isIntersecting || nudged) return;
        nudged = true; obs.disconnect();
        var frames = [64, 36, 50], k = 0;
        ba.classList.add('nudging');
        (function next() {
          if (k >= frames.length) { setTimeout(function () { ba.classList.remove('nudging'); }, 500); return; }
          set(frames[k]); input.value = frames[k]; k++; setTimeout(next, 550);
        })();
      }, { threshold: 0.6 }).observe(ba);
      input.addEventListener('pointerdown', function () { ba.classList.remove('nudging'); });
    }
  });
  document.querySelectorAll('.ba-tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.ba-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
      document.querySelectorAll('.ba-set').forEach(function (s) { s.classList.toggle('on', s.id === b.dataset.target); });
    });
  });

  // Timeline progress line
  var tl = document.querySelector('.timeline');
  if (tl) {
    var bar = tl.querySelector('.progress');
    function tlScroll() {
      var r = tl.getBoundingClientRect(), vh = window.innerHeight;
      var p = Math.min(Math.max((vh * 0.6 - r.top) / r.height, 0), 1);
      bar.style.height = (p * (r.height - 20)) + 'px';
    }
    tlScroll();
    window.addEventListener('scroll', tlScroll, { passive: true });
  }
})();
