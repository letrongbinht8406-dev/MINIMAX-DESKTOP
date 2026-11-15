
<script>
  var P = window.INSP || { cats: [], items: [] };
  var C = window.INSP_CARDS || { total: 0, groups: [] };
  var CARDS = [];
  C.groups.forEach(function (g) { g.items.forEach(function (it) { it.g = g.n; CARDS.push(it); }); });

  var grid = document.getElementById('grid');
  var empty = document.getElementById('empty');
  var chips = document.getElementById('chips');
  var stat = document.getElementById('stat');
  var tabsEl = document.getElementById('tabs');
  var q = document.getElementById('q');
  var q2 = document.getElementById('q2');
  var tab = 'photos', cur = '全部', kw = '';

  document.getElementById('footN').textContent = P.items.length;

  function chipEl(name, count) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (name === cur ? ' is-on' : '');
    b.textContent = name === '全部' ? '全部 ' + count : name + ' ' + count;
    b.addEventListener('click', function () { cur = name; renderChips(); render(); });
    return b;
  }
  function renderChips() {
    chips.innerHTML = '';
    if (tab === 'photos') {
      chips.appendChild(chipEl('全部', P.items.length));
      P.cats.forEach(function (c) { chips.appendChild(chipEl(c.n, c.c)); });
    } else {
      chips.appendChild(chipEl('全部', CARDS.length));
      C.groups.forEach(function (g) { chips.appendChild(chipEl(g.n, g.count)); });
    }
  }
  function tabEl(id, label, count) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', tab === id ? 'true' : 'false');
    b.className = 'insp-tab' + (tab === id ? ' is-on' : '');
    b.textContent = label;
    b.addEventListener('click', function () { tab = id; cur = '全部'; renderTabs(); renderChips(); render(); });
    return b;
  }
  function renderTabs() {
    tabsEl.innerHTML = '';
    tabsEl.appendChild(tabEl('photos', '美学收集', P.items.length));
    tabsEl.appendChild(tabEl('cards', '拆解卡片', CARDS.length));
  }

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function render() {
    if (tab === 'photos') renderPhotos(); else renderCards();
  }
  function renderPhotos() {
    var list = P.items.filter(function (it) {
      if (cur !== '全部' && it.c !== cur) return false;
      if (kw && (it.t + ' ' + it.c).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    var frag = document.createDocumentFragment();
    list.forEach(function (it) {
      var d = document.createElement('article');
      d.className = 'insp-card';
      d.tabIndex = 0;
      d.innerHTML = '<figure><img loading="lazy" decoding="async" src="' + it.s + '" alt="' + esc(it.t) + '"><figcaption><span class="t">' + esc(it.t) + '</span><span class="c">' + esc(it.c) + '</span></figcaption></figure>';
      d.addEventListener('click', function () { openLb(it.s, it.c + ' · ' + it.t); });
      d.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLb(it.s, it.c + ' · ' + it.t); } });
      frag.appendChild(d);
    });
    grid.innerHTML = '';
    grid.appendChild(frag);
    empty.hidden = list.length > 0;
    stat.innerHTML = (cur === '全部' ? '全部分类' : cur) + ' · 显示 <b>' + list.length + '</b> / ' + P.items.length + ' 张';
  }
  function renderCards() {
    var list = CARDS.filter(function (c) {
      if (cur !== '全部' && c.g !== cur) return false;
      if (kw && (c.title + ' ' + c.category + ' ' + c.oneline + ' ' + c.g).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    var frag = document.createDocumentFragment();
    list.forEach(function (c) {
      var d = document.createElement('article');
      d.className = 'insp-cardcard';
      d.tabIndex = 0;
      var sw = '';
      if (c.bg) sw += '<span class="sw" style="background:' + esc(c.bg) + '" title="底色 ' + esc(c.bg) + '"></span>';
      if (c.accent) sw += '<span class="sw" style="background:' + esc(c.accent) + '" title="强调色 ' + esc(c.accent) + '"></span>';
      var rows = '';
      ['主标', '底色', '强调色', '信任暗示'].forEach(function (k) {
        if (c.recipe && c.recipe[k]) rows += '<div class="cc-row"><span class="k">' + k + '</span><span class="v"><b>' + esc(c.recipe[k].done) + '</b></span></div>';
      });
      var thumb = c.thumb ? '<div class="cc-thumb"><img loading="lazy" decoding="async" src="' + c.thumb + '" alt="' + esc(c.title) + ' 切片首屏"></div>' : '';
      d.innerHTML = '<div class="cc-head">' + sw + '<span class="cc-title">' + esc(c.title) + '</span><span class="cc-cat">' + esc(c.g) + '</span></div>'
        + '<div class="cc-one">' + esc(c.oneline) + '</div>'
        + '<div class="cc-rows">' + rows + '</div>' + thumb;
      if (c.thumb) {
        var open = function () { openLb(c.thumb, c.category + ' · ' + c.title); };
        d.addEventListener('click', open);
        d.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      }
      frag.appendChild(d);
    });
    grid.innerHTML = '';
    grid.appendChild(frag);
    empty.hidden = list.length > 0;
    stat.innerHTML = '拆解卡片 · ' + (cur === '全部' ? '全部品类' : cur) + ' · 显示 <b>' + list.length + '</b> / ' + CARDS.length + ' 张';
  }

  var lb = document.getElementById('lb'), lbImg = document.getElementById('lbImg'),
      lbMeta = document.getElementById('lbMeta'), lbOpen = document.getElementById('lbOpen');
  function openLb(src, meta) {
    lbImg.src = src; lbImg.alt = meta;
    lbMeta.textContent = meta;
    lbOpen.href = src;
    lb.classList.add('is-open');
    document.body.classList.add('is-locked');
  }
  function closeLb() {
    lb.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    lbImg.removeAttribute('src');
  }
  document.getElementById('lbClose').addEventListener('click', closeLb);
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLb();
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); q.focus(); }
  });

  function onKw(v) {
    kw = (v || '').trim().toLowerCase();
    if (q.value !== v) q.value = v;
    if (q2.value !== v) q2.value = v;
    render();
  }
  q.addEventListener('input', function () { onKw(q.value); });
  q2.addEventListener('input', function () { onKw(q2.value); });

  renderTabs();
  renderChips();
  render();

