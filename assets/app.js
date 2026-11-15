/* =========================================================
   作品集交互
   1. 渲染瀑布流（绝对定位，横向顺序排布）
   2. 四层筛选：工具 / 排序 / 类型 / 关键词
   3. 详情浮层，带 ?work=id 深链
   ========================================================= */

(function () {
  'use strict';

  var WORKS = window.WORKS || [];
  var TOOLS = ['全部', 'Midjourney', 'ComfyUI', 'Stable Diffusion', 'Photoshop', 'ChatGPT'];
  var TYPES = ['全部', '游戏KV', '角色立绘', '电商主图', '详情页', '小红书封面', '海报', 'UI'];

  var state = { tool: '全部', type: '全部', sort: 'featured', q: '', openId: null };

  var grid = document.getElementById('grid');
  var emptyBox = document.getElementById('empty');
  var toolTabs = document.getElementById('toolTabs');
  var typeChips = document.getElementById('typeChips');
  var searchInput = document.getElementById('q');
  var detail = document.getElementById('detail');

  /* ---------- 工具函数 ---------- */

  function parseRatio(r) {
    var p = String(r).split('/');
    return [parseFloat(p[0]) || 1, parseFloat(p[1]) || 1];
  }

  function imgSrc(item) {
    var seed = String(item.seed || '');
    if (/^(https?:|\/|\.\/|\.\.\/|assets\/)/.test(seed)) return seed;
    var d = parseRatio(item.ratio);
    var w = 900;
    var h = Math.round(w * d[1] / d[0]);
    return 'https://picsum.photos/seed/' + encodeURIComponent(seed) + '/' + w + '/' + h;
  }

  function bySort(a, b) {
    if (state.sort === 'latest') return String(b.year).localeCompare(String(a.year));
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  }

  function matches(item) {
    if (state.tool !== '全部' && item.tool !== state.tool) return false;
    if (state.type !== '全部' && item.type !== state.type) return false;
    if (!state.q) return true;
    var q = state.q.toLowerCase();
    var hay = [item.title, item.project, item.tool, item.type, item.prompt, item.note].join(' ').toLowerCase();
    return hay.indexOf(q) > -1;
  }

  /* ---------- 筛选器构建 ---------- */

  function buildFilters() {
    toolTabs.innerHTML = '';
    TOOLS.forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab' + (name === state.tool ? ' is-on' : '');
      b.textContent = name;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', name === state.tool ? 'true' : 'false');
      b.addEventListener('click', function () {
        state.tool = name;
        toolTabs.querySelectorAll('.tab').forEach(function (el) {
          var on = el === b;
          el.classList.toggle('is-on', on);
          el.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        render();
      });
      toolTabs.appendChild(b);
    });

    typeChips.innerHTML = '';
    TYPES.forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (name === state.type ? ' is-on' : '');
      b.textContent = name;
      b.addEventListener('click', function () {
        state.type = name;
        typeChips.querySelectorAll('.chip').forEach(function (el) {
          el.classList.toggle('is-on', el === b);
        });
        render();
      });
      typeChips.appendChild(b);
    });

    document.querySelectorAll('.sort-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.sort = b.dataset.sort;
        document.querySelectorAll('.sort-btn').forEach(function (el) {
          el.classList.toggle('is-on', el === b);
        });
        render();
      });
    });

    document.getElementById('resetFilters').addEventListener('click', function () {
      state.tool = '全部';
      state.type = '全部';
      state.q = '';
      searchInput.value = '';
      buildFilters();
      render();
    });
  }

  /* ---------- 渲染 ---------- */

  function createCard(item) {
    var card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = item.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', item.title + ' ' + item.project);

    var d = parseRatio(item.ratio);

    var media = document.createElement('div');
    media.className = 'card-media';
    media.style.aspectRatio = d[0] + ' / ' + d[1];

    var img = document.createElement('img');
    img.src = imgSrc(item);
    img.alt = item.project + ' ' + item.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.addEventListener('load', function () { media.classList.add('is-loaded'); });
    img.addEventListener('error', function () {
      media.classList.add('is-loaded');
      img.style.visibility = 'hidden';
    });

    var scrim = document.createElement('div');
    scrim.className = 'card-scrim';

    var foot = document.createElement('div');
    foot.className = 'card-foot';
    foot.innerHTML =
      '<p class="card-title"></p>' +
      '<p class="card-meta"><span></span><i class="dot"></i><span></span></p>' +
      '<span class="card-badge"></span>';
    foot.querySelector('.card-title').textContent = item.title;
    var metaSpans = foot.querySelectorAll('.card-meta span');
    metaSpans[0].textContent = item.project;
    metaSpans[1].textContent = item.type;
    foot.querySelector('.card-badge').textContent = item.tool;

    media.appendChild(img);
    media.appendChild(scrim);
    media.appendChild(foot);
    card.appendChild(media);

    card.addEventListener('click', function () { openDetail(item.id); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail(item.id);
      }
    });

    return card;
  }

  function render() {
    var list = WORKS.filter(matches).slice().sort(bySort);

    grid.innerHTML = '';
    list.forEach(function (item) { grid.appendChild(createCard(item)); });

    emptyBox.hidden = list.length > 0;
    grid.style.display = list.length ? '' : 'none';

    requestAnimationFrame(layout);
  }

  /* ---------- 瀑布流布局 ---------- */

  var GAP = 14;

  function columnsFor(width) {
    if (width > 1400) return 6;
    if (width > 1120) return 5;
    if (width > 860) return 4;
    if (width > 620) return 3;
    if (width > 440) return 2;
    return 1;
  }

  function layout() {
    var cards = Array.prototype.slice.call(grid.children);
    if (!cards.length) return;

    var w = grid.clientWidth;
    if (!w) return;

    var gap = w < 760 ? 10 : GAP;
    var cols = columnsFor(w);
    var colW = (w - gap * (cols - 1)) / cols;
    var heights = [];
    var i;

    for (i = 0; i < cols; i++) heights.push(0);

    cards.forEach(function (card) {
      var media = card.querySelector('.card-media');
      var ratio = media ? media.style.aspectRatio : '1 / 1';
      var d = parseRatio(ratio.replace(/\s/g, ''));
      var h = colW * d[1] / d[0];

      var target = 0;
      for (i = 1; i < cols; i++) {
        if (heights[i] < heights[target] - 0.5) target = i;
      }

      card.style.width = colW + 'px';
      card.style.left = Math.round(target * (colW + gap)) + 'px';
      card.style.top = Math.round(heights[target]) + 'px';

      heights[target] += h + gap;
    });

    grid.style.height = Math.round(Math.max.apply(null, heights)) + 'px';
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  });

  /* ---------- 详情浮层 ---------- */

  var lastFocus = null;

  function openDetail(id) {
    var item = WORKS.filter(function (w) { return w.id === id; })[0];
    if (!item) return;

    lastFocus = document.activeElement;
    state.openId = id;

    document.getElementById('detailImg').src = imgSrc(item);
    document.getElementById('detailImg').alt = item.project + ' ' + item.title;
    document.getElementById('detailKicker').textContent = item.year + ' · ' + item.type;
    document.getElementById('detailTitle').textContent = item.title;
    document.getElementById('detailSub').textContent = item.project;
    document.getElementById('metaProject').textContent = item.project;
    document.getElementById('metaTool').textContent = item.tool;
    document.getElementById('metaType').textContent = item.type;
    document.getElementById('metaYear').textContent = item.year;
    document.getElementById('detailPrompt').textContent = item.prompt;
    document.getElementById('detailNote').textContent = item.note;

    detail.hidden = false;
    document.body.classList.add('is-locked');
    document.getElementById('detailClose').focus();

    history.pushState({ work: id }, '', '?work=' + id);
  }

  function closeDetail(pushBack) {
    if (detail.hidden) return;
    detail.hidden = true;
    document.body.classList.remove('is-locked');
    state.openId = null;

    if (pushBack !== false) {
      history.pushState({}, '', location.pathname + location.hash);
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.getElementById('detailClose').addEventListener('click', function () { closeDetail(); });

  detail.addEventListener('click', function (e) {
    if (e.target === detail || e.target.classList.contains('detail-stage')) closeDetail();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDetail();

    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }

    if (e.key === 'Tab' && !detail.hidden) {
      var focusables = detail.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener('popstate', function () {
    var id = new URLSearchParams(location.search).get('work');
    if (id) openDetail(id);
    else closeDetail(false);
  });

  /* ---------- 复制 ---------- */

  function copyText(text, btn) {
    function done() {
      var old = btn.textContent;
      btn.textContent = '已复制';
      setTimeout(function () { btn.textContent = old; }, 1400);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (err) { /* 忽略 */ }
      document.body.removeChild(ta);
    }
  }

  document.getElementById('copyPrompt').addEventListener('click', function () {
    copyText(document.getElementById('detailPrompt').textContent, this);
  });

  document.getElementById('copyMail').addEventListener('click', function () {
    copyText('your@email.com', this);
  });

  /* ---------- 搜索 ---------- */

  var searchTimer;
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    var val = searchInput.value;
    searchTimer = setTimeout(function () {
      state.q = val.trim();
      render();
    }, 220);
  });

  /* ---------- 侧栏高亮 ---------- */

  var sections = ['hero', 'works', 'tools', 'workflow', 'projects', 'method', 'about'];

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        document.querySelectorAll('.rail-link').forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  /* ---------- 启动 ---------- */

  buildFilters();
  render();

  var deepLink = new URLSearchParams(location.search).get('work');
  if (deepLink) {
    setTimeout(function () { openDetail(deepLink); }, 60);
  }
})();
