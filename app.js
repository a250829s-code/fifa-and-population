(() => {
  const D = window.APP_DATA;       // data.js:FIFAランキングと人口のデータ
  const E = D.entities;            // ISO3コードごとのデータ { n, c2, p:[人口...], t:[[順位,チーム名,ポイント,前回順位,連盟]] }
  const $ = id => document.getElementById(id);

  // ===== 日本語の名前 =====
  let regionJa = null;
  try { regionJa = new Intl.DisplayNames(['ja'], { type: 'region' }); } catch (e) { /* 古いブラウザ用 */ }
  const NAME_OVERRIDE = { XKX: 'コソボ' };
  function jaName(iso) {
    if (NAME_OVERRIDE[iso]) return NAME_OVERRIDE[iso];
    const e = E[iso];
    if (!e) return iso;
    if (regionJa && e.c2) {
      try { const r = regionJa.of(e.c2); if (r && r !== e.c2) return r; } catch (_) {}
    }
    return e.n;
  }
  // 国名と違うチーム名(イギリスの4協会など)
  const TEAM_JA = {
    'England': 'イングランド', 'Scotland': 'スコットランド', 'Wales': 'ウェールズ',
    'Northern Ireland': '北アイルランド', 'Tahiti': 'タヒチ', 'Chinese Taipei': 'チャイニーズ・タイペイ'
  };
  const teamJa = (t, iso) => TEAM_JA[t[1]] || jaName(iso);
  const CONFED = {
    UEFA: 'UEFA(ヨーロッパ)', CONMEBOL: 'CONMEBOL(南米)', CAF: 'CAF(アフリカ)',
    AFC: 'AFC(アジア)', CONCACAF: 'CONCACAF(北中米カリブ海)', OFC: 'OFC(オセアニア)'
  };

  // ===== 数字の表示 =====
  function fmtPop(n) {
    if (n < 1e5) return n.toLocaleString('ja-JP') + '人';
    const m = Math.round(n / 1e4);            // 万人単位に丸める
    const oku = Math.floor(m / 1e4), man = m % 1e4;
    if (oku > 0) return `${oku}億${man ? man.toLocaleString('ja-JP') + '万' : ''}人`;
    return `${m.toLocaleString('ja-JP')}万人`;
  }
  function fmtAxis(v) {
    if (v === 0) return '0';
    if (v >= 1e8) return `${+(v / 1e8).toFixed(1)}億`;
    if (v >= 1e4) return `${+(v / 1e4).toFixed(1)}万`;
    return String(v);
  }
  function fmtDate(s) { const [y, m, d] = s.split('-').map(Number); return `${y}年${m}月${d}日`; }
  const lastValue = p => { for (let i = p.length - 1; i >= 0; i--) if (p[i] != null) return p[i]; return null; };
  const bestRank = e => (e && e.t.length ? Math.min(...e.t.map(t => t[0])) : null);

  // ===== 色(FIFAランキングの順位帯) =====
  const BINS = [
    { max: 10,  color: '#08306b', label: '1〜10位' },
    { max: 30,  color: '#2171b5', label: '11〜30位' },
    { max: 60,  color: '#4292c6', label: '31〜60位' },
    { max: 100, color: '#6baed6', label: '61〜100位' },
    { max: 150, color: '#9ecae1', label: '101〜150位' },
    { max: 999, color: '#c6dbef', label: '151位〜' }
  ];
  const NO_RANK = '#d9d3c7';
  const colorOfRank = r => (r == null ? NO_RANK : BINS.find(b => r <= b.max).color);

  // ===== 地図 =====
  const W = 960, H = 500;
  const svg = d3.select('#map');
  const topo = window.WORLD_TOPO;
  const features = topojson.feature(topo, topo.objects.countries).features.filter(f => f.id !== '010'); // 南極は除く
  const projection = d3.geoNaturalEarth1().fitSize([W, H], { type: 'FeatureCollection', features });
  const geoPath = d3.geoPath(projection);
  const gMap = svg.append('g');

  function isoOf(f) {
    if (f.id && D.numToIso[f.id]) return D.numToIso[f.id];
    if (f.properties && f.properties.name === 'Kosovo') return 'XKX';
    return null;   // ソマリランド・北キプロスなど(コードがない地域)
  }
  const featureByIso = {};
  features.forEach(f => { const i = isoOf(f); if (i) featureByIso[i] = f; });

  const tip = $('tip');
  function showTip(ev, f) {
    const iso = isoOf(f);
    const name = iso ? jaName(iso) : (f.properties.name || '');
    const e = iso ? E[iso] : null;
    let html = `<b>${name}</b>`;
    if (e && e.t.length) html += `<br>FIFA ${e.t.length > 1 ? '最上位 ' : ''}${bestRank(e)}位`;
    else if (iso) html += '<br>FIFAランキングなし';
    if (e && e.p) { const v = lastValue(e.p); if (v != null) html += `<br>人口 ${fmtPop(v)}`; }
    tip.innerHTML = html;
    tip.style.display = 'block';
    const x = Math.min(ev.clientX + 14, window.innerWidth - 270);
    tip.style.left = x + 'px';
    tip.style.top = (ev.clientY + 14) + 'px';
  }
  const hideTip = () => { tip.style.display = 'none'; };

  const paths = gMap.selectAll('path').data(features).join('path')
    .attr('class', f => 'country' + (isoOf(f) ? '' : ' nodata'))
    .attr('d', geoPath)
    .attr('fill', f => colorOfRank(bestRank(E[isoOf(f)])))
    .on('mousemove', showTip)
    .on('mouseleave', hideTip)
    .on('click', (ev, f) => { const iso = isoOf(f); if (iso) select(iso, { zoom: true }); });

  // ズーム(ドラッグで移動、ホイール/ボタンで拡大縮小)
  const zoom = d3.zoom()
    .scaleExtent([1, 16])
    .extent([[0, 0], [W, H]])
    .translateExtent([[0, 0], [W, H]])
    .on('zoom', ev => gMap.attr('transform', ev.transform));
  svg.call(zoom).on('dblclick.zoom', null);
  $('zoomIn').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1.6);
  $('zoomOut').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6);
  $('zoomReset').onclick = () => svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);

  function zoomToIso(iso) {
    const f = featureByIso[iso];
    if (!f) return;
    const [[x0, y0], [x1, y1]] = geoPath.bounds(f);
    const k = Math.max(1, Math.min(10, 0.7 / Math.max((x1 - x0) / W, (y1 - y0) / H)));
    const t = d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    svg.transition().duration(600).call(zoom.transform, t);
  }

  // 凡例
  $('legend').innerHTML =
    BINS.map(b => `<span><i class="sw" style="background:${b.color}"></i>${b.label}</span>`).join('') +
    `<span><i class="sw" style="background:${NO_RANK}"></i>ランキングなし</span>`;

  // ===== 国を選ぶプルダウン(小さい国は地図で押しにくいので) =====
  const select$ = $('countrySelect');
  const options = Object.keys(E)
    .filter(iso => E[iso].t.length || E[iso].p)
    .map(iso => ({ iso, name: jaName(iso) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  select$.innerHTML = '<option value="">国を選ぶ…</option>' +
    options.map(o => `<option value="${o.iso}">${o.name}</option>`).join('');
  select$.onchange = () => { if (select$.value) select(select$.value, { zoom: true }); };

  // ===== 左:FIFAランキングの推移 =====
  const HIST = D.history;                                // { dates:[...], teams:{ チームコード:[順位 or null ...] } }
  const histDates = HIST.dates.map(s => new Date(s + 'T00:00:00'));
  const SERIES_COLORS = ['#1f63a8', '#d6336c', '#1a8f4a', '#e8890c'];
  const fmtMonth = dt => `${dt.getFullYear()}年${dt.getMonth() + 1}月`;
  const GAP_DAYS = 150;     // これ以上あいている期間は点線でつなぐ

  function renderFifa(iso) {
    const e = E[iso];
    const body = $('fifaBody');
    if (!e.t.length) {
      body.innerHTML = `<div class="team"><div class="name">${jaName(iso)}</div>
        <p class="hint">この国・地域は、FIFA男子ランキング(${D.teamCount}チーム)に掲載されていません。</p></div>`;
      return;
    }
    const teams = e.t.slice().sort((a, b) => a[0] - b[0]);
    const multi = teams.length > 1;
    const series = teams.map((t, i) => ({
      team: t, name: teamJa(t, iso),
      color: multi ? SERIES_COLORS[i % SERIES_COLORS.length] : SERIES_COLORS[0],
      ranks: HIST.teams[t[5]] || []
    }));

    const head = `<div class="name" style="font-size:18px;font-weight:700;margin-bottom:2px">${jaName(iso)}</div>` +
      (multi ? `<p class="hint" style="margin:0 0 6px">${teams.length}つの代表チームがあります。</p>` : '');

    const cards = series.map(s => {
      const [rank, en, pts, prev, confed] = s.team;
      const diff = prev - rank;
      const change = diff > 0 ? `<span class="up">▲ ${diff}</span>` :
                     diff < 0 ? `<span class="down">▼ ${-diff}</span>` : `<span class="same">変化なし</span>`;
      const valid = s.ranks.map((r, k) => ({ r, k })).filter(o => o.r != null);
      const best = valid.reduce((a, b) => (b.r < a.r ? b : a), valid[0]);
      const worst = valid.reduce((a, b) => (b.r > a.r ? b : a), valid[0]);
      return `<div class="team ${multi ? 'compact' : ''}">
        ${multi ? `<div class="name"><i class="sw" style="background:${s.color}"></i>${s.name}</div>` : ''}
        <div class="en">${en}</div>
        <div class="rank"><span class="num">${rank}</span><span class="unit">位</span><span class="of">${fmtMonth(histDates[histDates.length - 1])}(最新)</span></div>
        <dl>
          <dt>前回の順位</dt><dd>${prev}位 ${change}</dd>
          <dt>最高順位</dt><dd>${best.r}位(${fmtMonth(histDates[best.k])})</dd>
          <dt>最低順位</dt><dd>${worst.r}位(${fmtMonth(histDates[worst.k])})</dd>
          <dt>ポイント</dt><dd>${pts.toFixed(2)}</dd>
          <dt>所属連盟</dt><dd>${CONFED[confed] || confed}</dd>
        </dl>
      </div>`;
    }).join('');

    body.innerHTML = head +
      `<div id="fifaHover" class="hint">グラフにカーソルを合わせると、その時期の順位が出ます。</div>
       <svg id="fifaChart" viewBox="0 0 330 250"></svg>
       <p class="chartnote">上にあるほど上位です。点線は、データのない期間(2024年9月〜2026年10月など)をつないだものです。</p>` + cards;
    drawRankChart(series);
  }

  function drawRankChart(series) {
    const cw = 330, ch = 250, m = { l: 34, r: 10, t: 10, b: 24 };
    const s = d3.select('#fifaChart');
    const all = series.flatMap(sr => sr.ranks.filter(r => r != null));
    if (!all.length) return;
    const dMin = d3.min(series, sr => histDates[sr.ranks.findIndex(r => r != null)]);
    const x = d3.scaleTime().domain([dMin, histDates[histDates.length - 1]]).range([m.l, cw - m.r]);
    const yMax = Math.max(10, Math.ceil(d3.max(all) / 10) * 10);
    const y = d3.scaleLinear().domain([1, yMax]).range([m.t, ch - m.b]);       // 1位が一番上

    const yTicks = [1, ...d3.ticks(1, yMax, 5).filter(v => v > 1)];
    s.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).tickValues(yTicks).tickSize(-(cw - m.l - m.r)).tickFormat(''));
    s.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(d3.format('d')));
    s.append('g').attr('class', 'axis').attr('transform', `translate(0,${ch - m.b})`)
      .call(d3.axisBottom(x).ticks(d3.timeYear.every(5)).tickFormat(d3.timeFormat('%Y')));

    const line = d3.line().x(o => x(histDates[o.k])).y(o => y(o.r));
    series.forEach(sr => {
      const pts = sr.ranks.map((r, k) => ({ r, k })).filter(o => o.r != null);
      let run = [];
      const flush = () => {
        if (run.length > 1) s.append('path').datum(run).attr('d', line)
          .attr('fill', 'none').attr('stroke', sr.color).attr('stroke-width', 2).attr('stroke-linejoin', 'round');
        run = [];
      };
      pts.forEach((o, i) => {
        if (i > 0) {
          const days = (histDates[o.k] - histDates[pts[i - 1].k]) / 864e5;
          if (days > GAP_DAYS) {                      // 間があいた区間は点線で結ぶ
            flush();
            s.append('path').datum([pts[i - 1], o]).attr('d', line)
              .attr('fill', 'none').attr('stroke', sr.color).attr('stroke-width', 1.6)
              .attr('stroke-dasharray', '4 4').attr('opacity', 0.7);
          }
        }
        run.push(o);
      });
      flush();
      const lastPt = pts[pts.length - 1];             // 最新の点
      s.append('circle').attr('cx', x(histDates[lastPt.k])).attr('cy', y(lastPt.r)).attr('r', 4)
        .attr('fill', sr.color).attr('stroke', '#fff').attr('stroke-width', 1.5);
    });

    // カーソルを合わせたときの表示
    const focus = s.append('g').style('display', 'none');
    focus.append('line').attr('y1', m.t).attr('y2', ch - m.b).attr('stroke', '#999').attr('stroke-dasharray', '3 3');
    const dots = series.map(sr => focus.append('circle').attr('r', 4).attr('fill', sr.color)
      .attr('stroke', '#fff').attr('stroke-width', 1.5));
    const bis = d3.bisector(dt => dt).center;
    const label = $('fifaHover');
    s.append('rect').attr('x', m.l).attr('y', m.t).attr('width', cw - m.l - m.r).attr('height', ch - m.t - m.b)
      .attr('fill', 'transparent')
      .on('pointermove', ev => {
        const [mx] = d3.pointer(ev);
        const k = bis(histDates, x.invert(mx));
        focus.style('display', null);
        focus.select('line').attr('x1', x(histDates[k])).attr('x2', x(histDates[k]));
        const parts = [];
        series.forEach((sr, i) => {
          const r = sr.ranks[k];
          if (r == null) { dots[i].style('display', 'none'); parts.push(series.length > 1 ? `${sr.name} —` : '順位なし'); }
          else { dots[i].style('display', null).attr('cx', x(histDates[k])).attr('cy', y(r)); parts.push(series.length > 1 ? `${sr.name} ${r}位` : `${r}位`); }
        });
        label.innerHTML = `<b>${fmtMonth(histDates[k])}</b>:${parts.join(' / ')}`;
        label.classList.remove('hint');
      })
      .on('pointerleave', () => focus.style('display', 'none'));
  }

  // ===== 右:人口の推移 =====
  function renderPop(iso) {
    const e = E[iso];
    const body = $('popBody');
    const pts = e.p ? D.years.map((y, i) => ({ y, v: e.p[i] })).filter(d => d.v != null) : [];
    if (!pts.length) {
      body.innerHTML = `<div id="popTitle">${jaName(iso)}</div>
        <p class="hint">人口のデータがありません(元にした人口データに含まれていない国・地域です)。</p>`;
      return;
    }
    const first = pts[0], last = pts[pts.length - 1];
    const growth = (last.v / first.v - 1) * 100;
    body.innerHTML = `
      <div id="popTitle">${jaName(iso)}</div>
      <div id="popNow">${fmtPop(last.v)}<small>(${last.y}年)</small></div>
      <div id="popSub">${first.y}年(${fmtPop(first.v)})から ${growth >= 0 ? '+' : ''}${growth.toFixed(0)}%</div>
      <div id="popHover" class="hint" style="min-height:1.6em">グラフの上にカーソルを合わせると、その年の人口が出ます。</div>
      <svg id="popChart" viewBox="0 0 380 250"></svg>`;
    drawChart(pts);
  }

  function drawChart(pts) {
    const cw = 380, ch = 250, m = { l: 52, r: 12, t: 10, b: 26 };
    const s = d3.select('#popChart');
    const x = d3.scaleLinear().domain(d3.extent(pts, d => d.y)).range([m.l, cw - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(pts, d => d.v) * 1.05]).nice().range([ch - m.b, m.t]);

    s.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-(cw - m.l - m.r)).tickFormat(''));
    const xt = d3.range(1960, 2026, 10);
    s.append('g').attr('class', 'axis').attr('transform', `translate(0,${ch - m.b})`)
      .call(d3.axisBottom(x).tickValues(xt).tickFormat(d3.format('d')));
    s.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat(fmtAxis));

    s.append('path').datum(pts)
      .attr('fill', 'rgba(31,99,168,0.15)')
      .attr('d', d3.area().x(d => x(d.y)).y0(y(0)).y1(d => y(d.v)));
    s.append('path').datum(pts)
      .attr('fill', 'none').attr('stroke', '#1f63a8').attr('stroke-width', 2.2)
      .attr('d', d3.line().x(d => x(d.y)).y(d => y(d.v)));

    const focus = s.append('g').style('display', 'none');
    focus.append('line').attr('y1', m.t).attr('y2', ch - m.b).attr('stroke', '#999').attr('stroke-dasharray', '3 3');
    focus.append('circle').attr('r', 4.5).attr('fill', '#e8590c').attr('stroke', '#fff').attr('stroke-width', 1.5);
    const bis = d3.bisector(d => d.y).center;
    const label = $('popHover');
    s.append('rect').attr('x', m.l).attr('y', m.t).attr('width', cw - m.l - m.r).attr('height', ch - m.t - m.b)
      .attr('fill', 'transparent')
      .on('pointermove', ev => {
        const [mx] = d3.pointer(ev);
        const d = pts[bis(pts, x.invert(mx))];
        focus.style('display', null);
        focus.select('line').attr('x1', x(d.y)).attr('x2', x(d.y));
        focus.select('circle').attr('cx', x(d.y)).attr('cy', y(d.v));
        label.innerHTML = `<b>${d.y}年</b>:${fmtPop(d.v)}`;
        label.classList.remove('hint');
      })
      .on('pointerleave', () => focus.style('display', 'none'));
  }

  // ===== 選択と、もどるボタン =====
  const main$ = document.querySelector('main');
  let current = null;

  function select(iso, opts = {}) {
    if (!E[iso]) E[iso] = { n: iso, c2: '', p: null, t: [] };
    current = iso;
    main$.classList.add('has-selection');             // 左右のパネルを出す
    select$.value = E[iso].t.length || E[iso].p ? iso : '';
    paths.classed('selected', f => isoOf(f) === iso);
    paths.filter(f => isoOf(f) === iso).raise();
    renderFifa(iso);
    renderPop(iso);
    if (opts.zoom) zoomToIso(iso);
  }

  // 選択をリセットして、はじめの状態(地図だけ)にもどる
  function reset() {
    current = null;
    main$.classList.remove('has-selection');
    select$.value = '';
    paths.classed('selected', false);
    $('fifaBody').innerHTML = '';
    $('popBody').innerHTML = '';
    svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
    hideTip();
  }
  $('backBtn').onclick = reset;
  window.addEventListener('keydown', ev => { if (ev.key === 'Escape' && current) reset(); });

  // ===== 全体の相関(参考) =====
  function pearson(a, b) {
    const n = a.length, ma = d3.mean(a), mb = d3.mean(b);
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
    return sab / Math.sqrt(saa * sbb);
  }
  function ranks(a) {   // 同じ値は平均順位
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  }
  (function showCorrelation() {
    const pairs = [];
    for (const e of Object.values(E)) {
      if (e.t.length !== 1 || !e.p) continue;      // イギリス(4チーム)と人口データなしは除く
      const v = lastValue(e.p);
      if (v != null) pairs.push({ pop: v, pts: e.t[0][2] });
    }
    const pop = pairs.map(d => d.pop), pts = pairs.map(d => d.pts);
    const rLog = pearson(pop.map(Math.log10), pts);
    const rho = pearson(ranks(pop), ranks(pts));
    const rRaw = pearson(pop, pts);
    const f = v => v.toFixed(2);
    $('corr').innerHTML =
      `全体の傾向(参考・${pairs.length}か国・地域):` +
      `人口(対数)とFIFAポイントの相関係数 <b>r = ${f(rLog)}</b> ／ 人口の大小とFIFAポイントの順位相関 <b>ρ = ${f(rho)}</b> ／ ` +
      `人口をそのまま使うと r = ${f(rRaw)} <span class="note">(人口は国による差が極端に大きいため弱くなります。相関は原因と結果を示すものではありません)</span>`;
  })();

  $('fDate').textContent = fmtDate(D.rankingDate);
  $('fNext').textContent = fmtDate(D.nextUpdate);
})();
