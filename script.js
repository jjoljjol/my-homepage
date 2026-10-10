(function () {
  'use strict';

  var BODY = document.body;
  var MODE = BODY.getAttribute('data-mode') || 'active'; // 'active' | 'archive'
  var BASE = BODY.getAttribute('data-base') || '';
  var ISSUES_URL = 'https://github.com/jjoljjol/my-homepage/issues/new';
  var URGENT_MAX_DAYS = 60; // dated deadlines further away than this are not "urgent"
  var STALE_DAYS = 30;      // keep in sync with scripts/dbtool.py
  var state = { items: [], region: '전체', category: '전체', q: '', verifiedOnly: false };
  var today = todayKST();

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Today's date in KST as a UTC-midnight timestamp, so day differences are exact.
  function todayKST() {
    var k = new Date(Date.now() + 9 * 3600000);
    return Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
  }

  // "deadline" is free text and everything is derived from it. A stored d_day
  // would go stale every day, so it is not used.
  function parseDeadline(raw) {
    var s = String(raw == null ? '' : raw);
    var m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      var diff = Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - today) / 86400000);
      return { kind: diff < 0 ? 'closed' : 'dated', diff: diff, date: m[0] };
    }
    if (/마감/.test(s)) return { kind: 'closed', diff: null, date: null };
    if (/상시/.test(s)) return { kind: 'ongoing', diff: null, date: null };
    return { kind: 'unknown', diff: null, date: null };
  }

  function badgeOf(dl) {
    if (dl.kind === 'closed') return ['마감', 'closed'];
    if (dl.kind === 'ongoing') return ['상시', 'green'];
    if (dl.kind === 'unknown') return ['확인 필요', ''];
    if (dl.diff > URGENT_MAX_DAYS) return ['~' + dl.date, ''];
    var tone = dl.diff <= 7 ? 'red' : dl.diff <= 14 ? 'yellow' : 'purple';
    return [dl.diff === 0 ? 'D-Day' : 'D-' + dl.diff, tone];
  }

  // Verification status. Only an item with a source URL and a recent
  // verified_at counts as verified; absence of data means "not checked".
  function trust(raw) {
    var m = String(raw.verified_at || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m || !safeUrl(raw.source_url)) return { key: 'unverified', icon: '⚠', label: '미확인', date: '', age: null };
    var age = Math.round((today - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000);
    if (age < 0) return { key: 'unverified', icon: '⚠', label: '미확인', date: '', age: null };
    if (age > STALE_DAYS) return { key: 'stale', icon: '🕒', label: '재확인 필요', date: m[0], age: age };
    return { key: 'verified', icon: '✔', label: '원문 확인', date: m[0], age: age };
  }

  var GROUP_ORDER = { dated: 0, ongoing: 1, unknown: 2, closed: 3 };
  function compare(a, b) {
    if (MODE === 'archive') { // most recently closed first
      var da = a.dl.date, db = b.dl.date;
      if (da && db && da !== db) return da < db ? 1 : -1;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return a.idx - b.idx;
    }
    var ga = GROUP_ORDER[a.dl.kind], gb = GROUP_ORDER[b.dl.kind];
    if (ga !== gb) return ga - gb;
    if (a.dl.kind === 'dated' && a.dl.diff !== b.dl.diff) return a.dl.diff - b.dl.diff;
    return a.idx - b.idx;
  }

  function regionGroup(r) { return String(r || '').split('-')[0] || '기타'; }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? u : null; }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return state.items.filter(function (it) {
      if (state.region !== '전체' && it.group !== state.region) return false;
      if (state.category !== '전체' && it.raw.category !== state.category) return false;
      if (state.verifiedOnly && it.trust.key !== 'verified') return false;
      if (q && it.hay.indexOf(q) === -1) return false;
      return true;
    });
  }

  function card(it, big) {
    var b = badgeOf(it.dl);
    var c = el('button', 'card' + (big ? ' big' : '') + (it.dl.kind === 'closed' ? ' closed' : ''));
    c.type = 'button';
    var row = el('span', 'row');
    row.appendChild(el('span', 'badge ' + b[1], b[0]));
    row.appendChild(el('span', 'tag', it.raw.region));
    row.appendChild(el('span', 'tag cat', it.raw.category));
    c.appendChild(row);
    c.appendChild(el('span', 'title', it.raw.title));
    c.appendChild(el('span', 'benefit', it.raw.benefit));
    var meta = el('span', 'meta');
    var who = [it.raw.organ, it.raw.type];
    if (MODE === 'archive') who.push('마감 ' + it.raw.deadline);
    meta.appendChild(el('span', 'organ', who.filter(Boolean).join(' · ')));
    meta.appendChild(el('span', 'trust ' + it.trust.key, it.trust.icon + ' ' + it.trust.label));
    c.appendChild(meta);
    c.addEventListener('click', function () { openModal(it); });
    return c;
  }

  function stat(num, label) {
    var s = el('div', 'stat');
    s.appendChild(el('b', null, String(num)));
    s.appendChild(el('i', null, label));
    return s;
  }

  function render() {
    var all = state.items;
    var st = $('stats');
    st.textContent = '';
    if (MODE === 'archive') {
      st.appendChild(stat(all.length, '보관된 사업'));
    } else {
      var soon = all.filter(function (i) { return i.dl.kind === 'dated' && i.dl.diff <= 7; });
      var ok = all.filter(function (i) { return i.trust.key === 'verified'; });
      st.appendChild(stat(all.length, '진행 중·상시'));
      st.appendChild(stat(soon.length, '7일 내 마감'));
      st.appendChild(stat(ok.length + '/' + all.length, '원문 확인'));
    }

    var list = filtered().sort(compare);
    var box = $('list');
    box.textContent = '';
    list.forEach(function (it) { box.appendChild(card(it, false)); });
    $('empty').hidden = list.length > 0;

    var us = $('urgent-sec');
    if (us) { // shown only when nothing is filtered, so it never duplicates the list
      var pristine = state.region === '전체' && state.category === '전체' && !state.q.trim() && !state.verifiedOnly;
      var urgent = all.filter(function (i) { return i.dl.kind === 'dated' && i.dl.diff <= URGENT_MAX_DAYS; })
        .sort(compare).slice(0, 3);
      var ub = $('urgent');
      ub.textContent = '';
      urgent.forEach(function (it) { ub.appendChild(card(it, true)); });
      us.hidden = !(pristine && urgent.length);
    }
  }

  function chips(containerId, values, key) {
    var box = $(containerId);
    box.textContent = '';
    ['전체'].concat(values).forEach(function (v) {
      var b = el('button', null, v);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(state[key] === v));
      b.addEventListener('click', function () {
        state[key] = v;
        Array.prototype.forEach.call(box.children, function (x) {
          x.setAttribute('aria-pressed', String(x.textContent === v));
        });
        render();
      });
      box.appendChild(b);
    });
  }

  function uniq(arr) { return arr.filter(function (v, i) { return v && arr.indexOf(v) === i; }); }

  function row(body, label, valueNode) {
    body.appendChild(el('dt', null, label));
    var dd = el('dd');
    dd.appendChild(valueNode);
    body.appendChild(dd);
  }
  function text(s) { return document.createTextNode(s); }

  function openModal(it) {
    var raw = it.raw, t = it.trust, b = badgeOf(it.dl);
    var mb = $('m-badge');
    mb.className = 'badge ' + b[1];
    mb.textContent = b[0];
    $('m-title').textContent = raw.title;

    var body = $('m-body');
    body.textContent = '';
    [['혜택', raw.benefit], ['대상·내용', raw.detail], ['마감', raw.deadline],
     ['기관', raw.organ], ['지역', raw.region], ['분류', [raw.category, raw.type].filter(Boolean).join(' / ')]]
      .forEach(function (p) { if (p[1]) row(body, p[0], text(p[1])); });

    var status = el('span', 'trust ' + t.key, t.icon + ' ' + t.label);
    var wrap = el('span');
    wrap.appendChild(status);
    var explain = t.key === 'verified' ? ' 공고 원문과 대조함 · ' + t.date
      : t.key === 'stale' ? ' 확인한 지 ' + t.age + '일 지났습니다 · ' + t.date
      : ' 아직 공고 원문과 대조하지 않았습니다. 신청 전 기관 공고를 직접 확인하세요.';
    wrap.appendChild(text(explain));
    row(body, '검증', wrap);

    var src = safeUrl(raw.source_url);
    if (src) {
      var a = el('a', null, '공고 원문 열기 ↗');
      a.href = src; a.target = '_blank'; a.rel = 'noopener noreferrer';
      row(body, '원문', a);
    } else {
      row(body, '원문', text('원문 주소 미등록'));
    }
    if (raw.verified_note) row(body, '검증 메모', text(raw.verified_note));

    var link = $('m-link'), site = safeUrl(raw.link);
    if (site) { link.href = site; link.hidden = false; } else { link.hidden = true; }

    var report = $('m-report');
    report.href = ISSUES_URL + '?title=' + encodeURIComponent('[정정 제보] ' + raw.title) +
      '&body=' + encodeURIComponent('사업: ' + raw.title + ' (id ' + raw.id + ')\n\n틀린 내용:\n\n올바른 내용:\n\n근거(공고 원문 링크):\n');

    var d = $('modal');
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }

  function getJSON(path) {
    return fetch(BASE + path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' ' + r.status);
      return r.json();
    });
  }

  function load() {
    if (MODE === 'archive') {
      // archive/ plus anything already past its deadline in data/ (not yet moved by dbtool.py)
      return Promise.all([getJSON('archive/startup_db.json').catch(function () { return []; }), getJSON('data/startup_db.json')])
        .then(function (r) {
          var seen = {};
          r[0].forEach(function (i) { seen[i.id] = true; });
          return r[0].concat(r[1].filter(function (i) { return !seen[i.id]; }));
        });
    }
    return getJSON('data/startup_db.json');
  }

  function init(data) {
    var items = data.map(function (raw, idx) {
      return { raw: raw, idx: idx, dl: parseDeadline(raw.deadline), group: regionGroup(raw.region), trust: trust(raw),
               hay: [raw.title, raw.region, raw.category, raw.benefit, raw.detail, raw.organ, raw.type].join(' ').toLowerCase() };
    });
    state.items = items.filter(function (i) { return (i.dl.kind === 'closed') === (MODE === 'archive'); });
    chips('chips-region', uniq(state.items.map(function (i) { return i.group; })), 'region');
    chips('chips-category', uniq(state.items.map(function (i) { return i.raw.category; })), 'category');
    render();
  }

  $('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  $('verified').addEventListener('change', function (e) { state.verifiedOnly = e.target.checked; render(); });
  $('m-close').addEventListener('click', function () { $('modal').close(); });
  $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) $('modal').close(); });

  load().then(init).catch(function () { $('error').hidden = false; });
})();
