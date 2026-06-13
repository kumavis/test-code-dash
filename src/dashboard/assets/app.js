'use strict';
/*
 * Code Analysis Dashboard renderer. Self-contained vanilla JS: reads
 * window.MODEL (inlined by the generator) and draws it through composable,
 * orthogonal controls — Structure (what the graph is) x Layout (how it is
 * positioned) x Node encoding (size/color) x Link encoding (label/width) —
 * plus a cross-linked detail panel. No external dependencies by design.
 */
(() => {
  const MODEL = window.MODEL;
  const SVGNS = 'http://www.w3.org/2000/svg';

  // ---------- model indexes ----------
  const symbolById = new Map(MODEL.symbols.map((s) => [s.id, s]));
  const fileByPath = new Map(MODEL.files.map((f) => [f.path, f]));
  const symbolsByFile = new Map();
  for (const s of MODEL.symbols) {
    if (!symbolsByFile.has(s.file)) symbolsByFile.set(s.file, []);
    symbolsByFile.get(s.file).push(s);
  }
  const apiByFile = new Map();
  for (const u of MODEL.apiUsage) {
    if (!apiByFile.has(u.file)) apiByFile.set(u.file, []);
    apiByFile.get(u.file).push(u);
  }
  const refsByTarget = new Map();
  for (const r of MODEL.references || []) {
    if (!refsByTarget.has(r.to)) refsByTarget.set(r.to, []);
    refsByTarget.get(r.to).push(r);
  }
  const cycleMembers = new Set(MODEL.moduleGraph.cycles.flat());
  const cyclePairs = new Set();
  for (const cycle of MODEL.moduleGraph.cycles) {
    for (const a of cycle) for (const b of cycle) cyclePairs.add(`${a}|${b}`);
  }
  const uncalledSet = new Set(MODEL.callGraph.uncalled);
  const maxComplexityByFile = new Map();
  for (const s of MODEL.symbols) {
    if (s.complexity != null) {
      maxComplexityByFile.set(s.file, Math.max(maxComplexityByFile.get(s.file) ?? 0, s.complexity));
    }
  }

  const KIND_COLORS = {
    class: '#4da3ff', interface: '#b18cff', typeAlias: '#5fd0a5', enum: '#ffb86b',
    function: '#4da3ff', method: '#7fb8f7', variable: '#5fd0a5',
    module: '#8a95a3', file: '#8a95a3', dir: '#5c6877', category: '#2ac3de',
  };
  const API_COLORS = {
    filesystem: '#ffb86b', network: '#4da3ff', process: '#5fd0a5', shell: '#ff5d5d',
    crypto: '#b18cff', dom: '#f7768e', storage: '#e0af68', database: '#2ac3de',
  };
  const SENSITIVITY = { high: '#ff5d5d', medium: '#ffb86b', low: '#5fd0a5', none: '#3a4654' };
  const SENSITIVITY_RANK = { shell: 3, crypto: 3, process: 2, network: 2, filesystem: 2, database: 2, dom: 1, storage: 1 };

  // ---------- helpers ----------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const heat = (t) => `hsl(${120 * (1 - clamp(t, 0, 1))} 70% 45%)`;
  const dirOf = (path) => path.split('/').slice(0, -1).join('/') || '.';
  const baseOf = (path) => path.split('/').pop();

  function hashHue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return ((h % 360) + 360) % 360;
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'onclick') node.addEventListener('click', v);
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const child of children) node.append(child);
    return node;
  }

  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  // ---------- node metadata ----------
  // Every structure emits nodes with a uniform meta bag so encoders work on
  // any structure without special-casing.
  function fileSensitivity(path) {
    const cats = (apiByFile.get(path) || []).map((u) => SENSITIVITY_RANK[u.category] ?? 0);
    const rank = Math.max(0, ...cats);
    return rank >= 3 ? 'high' : rank === 2 ? 'medium' : rank === 1 ? 'low' : 'none';
  }
  function fileMeta(path) {
    const f = fileByPath.get(path) || {};
    return {
      type: 'file', path, dir: dirOf(path),
      loc: f.loc ?? null, bytes: f.bytes ?? null, churn: f.churn ?? null,
      complexity: maxComplexityByFile.get(path) ?? null,
      docGap: f.docCoverage == null ? null : 1 - f.docCoverage,
      apiCount: (apiByFile.get(path) || []).length,
      sensitivity: fileSensitivity(path),
      cycle: cycleMembers.has(path),
    };
  }
  function symbolMeta(id) {
    const s = symbolById.get(id);
    if (!s) return { type: 'pseudo', dir: '', kind: 'module' };
    return {
      type: 'symbol', id, kind: s.kind, file: s.file, dir: dirOf(s.file),
      complexity: s.complexity, documented: s.documented,
      apiCount: MODEL.apiUsage.filter((u) => u.inSymbol === id).length,
      uncalled: uncalledSet.has(id),
    };
  }

  // ---------- structures (what the graph IS) ----------
  const STRUCTURES = {
    modules: {
      label: 'Module dependencies', onSelect: (n) => showFile(n.id),
      build() {
        const nodes = MODEL.moduleGraph.nodes.map((p) => ({
          id: p, label: baseOf(p), meta: fileMeta(p),
          stroke: cycleMembers.has(p) ? '#ff5d5d' : null,
        }));
        const edges = MODEL.moduleGraph.edges.map((e) => ({
          source: e.from, target: e.to, weight: e.weight, label: baseOf(e.to),
          color: cyclePairs.has(`${e.from}|${e.to}`) ? '#ff5d5d' : null,
        }));
        return { nodes, edges };
      },
    },
    types: {
      label: 'Type relationships', onSelect: (n) => showSymbol(n.id),
      emptyMessage: 'No type relationships found — no classes with extends/implements clauses and no type aliases (typical of plain-JS projects).',
      build() {
        const kinds = new Set(['class', 'interface', 'typeAlias', 'enum']);
        const used = new Set(MODEL.typeGraph.flatMap((e) => [e.from, e.to]));
        const nodes = MODEL.symbols.filter((s) => kinds.has(s.kind) && (used.has(s.id) || true))
          .map((s) => ({ id: s.id, label: s.name, meta: symbolMeta(s.id) }));
        const edges = MODEL.typeGraph.map((e) => ({
          source: e.from, target: e.to, weight: 1, relation: e.relation, label: e.relation,
          dash: e.relation === 'implements' ? '6 4' : e.relation === 'alias' ? '2 4' : null,
        }));
        return { nodes, edges };
      },
    },
    calls: {
      label: 'Call graph', onSelect: (n) => showSymbol(n.id),
      emptyMessage: 'No call graph — no function-like symbols were found.',
      build() {
        const pseudo = new Set();
        for (const e of MODEL.callGraph.edges) if (e.from.endsWith('#<module>')) pseudo.add(e.from);
        const nodes = [
          ...MODEL.symbols.filter((s) => s.complexity != null).map((s) => ({
            id: s.id, label: s.name, meta: symbolMeta(s.id),
            stroke: uncalledSet.has(s.id) ? '#ff5d5d' : null,
          })),
          ...[...pseudo].map((id) => ({ id, label: baseOf(id.split('#')[0]), meta: symbolMeta(id) })),
        ];
        const edges = MODEL.callGraph.edges.map((e) => ({ source: e.from, target: e.to, weight: 1, label: baseOf(e.to.split('#').pop()) }));
        return { nodes, edges };
      },
    },
    apis: {
      label: 'API usage', onSelect: (n) => (n.id.startsWith('cat:') ? showApiCategory(n.id.slice(4)) : showFile(n.id)),
      emptyMessage: 'No privileged API usage detected — no file system, network, shell, crypto, DOM, storage, or database access found.',
      build() {
        const categories = [...new Set(MODEL.apiUsage.map((u) => u.category))].sort();
        const files = [...new Set(MODEL.apiUsage.map((u) => u.file))].sort();
        const counts = new Map();
        for (const u of MODEL.apiUsage) {
          const key = `${u.category}|${u.file}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const nodes = [
          ...categories.map((c) => ({
            id: `cat:${c}`, label: c, fixedColor: API_COLORS[c] || '#8a95a3',
            meta: { type: 'category', dir: '', kind: 'category', apiCount: MODEL.apiUsage.filter((u) => u.category === c).length },
          })),
          ...files.map((f) => ({ id: f, label: baseOf(f), meta: fileMeta(f) })),
        ];
        const edges = [...counts.entries()].map(([key, n]) => {
          const [category, file] = key.split('|');
          return { source: `cat:${category}`, target: file, weight: n, color: API_COLORS[category], label: String(n), arrow: false };
        });
        return { nodes, edges };
      },
    },
  };

  // ---------- node encoders ----------
  const SIZE_METRICS = {
    fixed: { label: 'Uniform', value: () => null },
    lines: { label: 'Lines of code', value: (n) => n.meta.loc },
    bytes: { label: 'File size (bytes)', value: (n) => n.meta.bytes },
    complexity: { label: 'Complexity', value: (n) => n.meta.complexity },
    churn: { label: 'Change frequency', value: (n) => n.meta.churn },
    apis: { label: 'API hits', value: (n) => n.meta.apiCount },
    degree: { label: 'Connections', value: (n) => n.degree },
  };
  const COLOR_METRICS = {
    directory: { label: 'Directory', categorical: true, value: (n) => n.meta.dir, colorFor: (c) => `hsl(${hashHue(c)} 55% 55%)` },
    kind: { label: 'Symbol kind / type', categorical: true, value: (n) => n.meta.kind || n.meta.type, colorFor: (c) => KIND_COLORS[c] || '#8a95a3' },
    sensitivity: { label: 'API sensitivity', categorical: true, value: (n) => n.meta.sensitivity || 'none', colorFor: (c) => SENSITIVITY[c] || '#3a4654' },
    complexity: { label: 'Complexity', value: (n) => n.meta.complexity },
    churn: { label: 'Change frequency', value: (n) => n.meta.churn },
    size: { label: 'Lines of code', value: (n) => n.meta.loc },
    docgap: { label: 'Doc gaps', value: (n) => n.meta.docGap },
    apis: { label: 'API hits', value: (n) => n.meta.apiCount },
  };

  function computeDegrees(nodes, edges) {
    const deg = new Map(nodes.map((n) => [n.id, 0]));
    for (const e of edges) {
      if (deg.has(e.source)) deg.set(e.source, deg.get(e.source) + 1);
      if (deg.has(e.target)) deg.set(e.target, deg.get(e.target) + 1);
    }
    for (const n of nodes) n.degree = deg.get(n.id) ?? 0;
  }

  function applySize(nodes, key) {
    const metric = SIZE_METRICS[key];
    const raw = nodes.map((n) => metric.value(n));
    const max = Math.max(1e-9, ...raw.filter((v) => typeof v === 'number' && isFinite(v)));
    nodes.forEach((n, i) => {
      const v = raw[i];
      n.r = typeof v === 'number' && isFinite(v) ? clamp(5 + Math.sqrt(Math.max(0, v) / max) * 23, 5, 30) : 8;
    });
  }

  function applyColor(nodes, key) {
    const metric = COLOR_METRICS[key];
    if (metric.categorical) {
      nodes.forEach((n) => {
        if (n.fixedColor) { n.color = n.fixedColor; return; }
        const cat = metric.value(n);
        n.color = cat == null || cat === '' ? '#3a4654' : metric.colorFor(cat);
      });
    } else {
      const raw = nodes.map((n) => metric.value(n));
      const max = Math.max(1e-9, ...raw.filter((v) => typeof v === 'number' && isFinite(v)));
      nodes.forEach((n, i) => {
        if (n.fixedColor) { n.color = n.fixedColor; return; }
        const v = raw[i];
        n.color = typeof v === 'number' && isFinite(v) ? heat(v / max) : '#3a4654';
      });
    }
  }

  // ---------- force simulation ----------
  function simulate(nodes, links, width, height) {
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const L = links.filter((l) => idx.has(l.source) && idx.has(l.target))
      .map((l) => ({ a: idx.get(l.source), b: idx.get(l.target) }));
    for (const n of nodes) {
      n.x = width / 2 + (Math.random() - 0.5) * width * 0.6;
      n.y = height / 2 + (Math.random() - 0.5) * height * 0.6;
      n.vx = 0; n.vy = 0;
    }
    const k = Math.sqrt((width * height) / Math.max(1, nodes.length)) * 0.7;
    function tick(alpha) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
          const d = Math.sqrt(d2);
          const force = ((k * k) / d2) * alpha * 14;
          const fx = (dx / d) * force, fy = (dy / d) * force;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      for (const { a, b } of L) {
        const na = nodes[a], nb = nodes[b];
        const dx = nb.x - na.x, dy = nb.y - na.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = ((d - k * 1.1) / d) * alpha * 0.35;
        na.vx += dx * force; na.vy += dy * force; nb.vx -= dx * force; nb.vy -= dy * force;
      }
      for (const n of nodes) {
        n.vx += (width / 2 - n.x) * alpha * 0.012;
        n.vy += (height / 2 - n.y) * alpha * 0.012;
        if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
        n.vx *= 0.6; n.vy *= 0.6;
        n.x += clamp(n.vx, -18, 18);
        n.y += clamp(n.vy, -18, 18);
      }
    }
    return { tick };
  }

  // ---------- force-graph renderer ----------
  function renderForceGraph(container, built, opts) {
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;
    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}` });
    const defs = svgEl('defs');
    const marker = svgEl('marker', {
      id: 'arrow', viewBox: '0 0 10 10', refX: 9.5, refY: 5,
      markerWidth: 6.5, markerHeight: 6.5, orient: 'auto-start-reverse',
    });
    marker.append(svgEl('path', { d: 'M 0 1 L 9 5 L 0 9 z', fill: '#5c6877' }));
    defs.append(marker);
    svg.append(defs);
    const world = svgEl('g');
    svg.append(world);
    container.append(svg);
    container.append(el('div', { class: 'hint', text: 'drag background to pan · wheel to zoom · drag nodes · click for details' }));

    const view = { x: 0, y: 0, scale: 1 };
    const applyView = () => world.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.scale})`);

    const nodes = built.nodes;
    const links = built.edges;
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const sim = simulate(nodes, links, width, height);
    const showLinkLabels = opts.linkLabel !== 'none' && links.length <= 90;

    const linkEls = links.filter((l) => nodeById.has(l.source) && nodeById.has(l.target)).map((l) => {
      const line = svgEl('line', {
        class: 'link', stroke: l.color || '#5c6877', 'stroke-width': l.width || 1.2,
        'marker-end': l.arrow === false ? '' : 'url(#arrow)',
      });
      if (l.dash) line.setAttribute('stroke-dasharray', l.dash);
      world.append(line);
      let label = null;
      if (showLinkLabels) {
        label = svgEl('text', { class: 'link-label', 'text-anchor': 'middle' });
        label.textContent = opts.linkText(l);
        world.append(label);
      }
      return { line, label, l };
    });

    const nodeEls = nodes.map((n) => {
      const circle = svgEl('circle', {
        class: 'node', r: n.r, fill: n.color,
        stroke: n.stroke || '#0f1419', 'stroke-width': n.stroke ? 2.5 : 1,
      });
      circle.append(svgEl('title'));
      circle.querySelector('title').textContent = opts.tooltip(n);
      const label = svgEl('text', { class: 'node-label', 'text-anchor': 'middle' });
      label.textContent = n.label;
      world.append(circle);
      if (nodes.length <= 160) world.append(label);
      circle.addEventListener('click', (ev) => { ev.stopPropagation(); selectNode(n.id); opts.onSelect(n); });
      return { circle, label, n };
    });

    function position() {
      for (const { line, label, l } of linkEls) {
        const a = nodeById.get(l.source), b = nodeById.get(l.target);
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        line.setAttribute('x1', a.x + (dx / d) * a.r);
        line.setAttribute('y1', a.y + (dy / d) * a.r);
        line.setAttribute('x2', b.x - (dx / d) * (b.r + 2));
        line.setAttribute('y2', b.y - (dy / d) * (b.r + 2));
        if (label) { label.setAttribute('x', (a.x + b.x) / 2); label.setAttribute('y', (a.y + b.y) / 2 - 2); }
      }
      for (const { circle, label, n } of nodeEls) {
        circle.setAttribute('cx', n.x); circle.setAttribute('cy', n.y);
        label.setAttribute('x', n.x); label.setAttribute('y', n.y - n.r - 4);
      }
    }

    let alpha = 1;
    function loop() {
      if (alpha < 0.004) return;
      alpha *= 0.97; sim.tick(alpha); position();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    const reheat = (a) => { const cold = alpha < 0.004; alpha = Math.max(alpha, a); if (cold) requestAnimationFrame(loop); };

    const toWorld = (ev) => {
      const rect = svg.getBoundingClientRect();
      const sx = ((ev.clientX - rect.left) / rect.width) * width;
      const sy = ((ev.clientY - rect.top) / rect.height) * height;
      return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale, sx, sy };
    };
    svg.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const { sx, sy } = toWorld(ev);
      const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      const next = clamp(view.scale * factor, 0.15, 8);
      view.x = sx - ((sx - view.x) / view.scale) * next;
      view.y = sy - ((sy - view.y) / view.scale) * next;
      view.scale = next; applyView();
    }, { passive: false });

    let drag = null;
    svg.addEventListener('mousedown', (ev) => {
      const hit = nodeEls.find(({ circle }) => circle === ev.target);
      if (hit) { drag = { node: hit.n }; hit.n.fixed = true; }
      else { drag = { panX: ev.clientX - view.x, panY: ev.clientY - view.y }; svg.classList.add('panning'); }
    });
    window.addEventListener('mousemove', (ev) => {
      if (!drag) return;
      if (drag.node) { const p = toWorld(ev); drag.node.x = p.x; drag.node.y = p.y; reheat(0.12); position(); }
      else { view.x = ev.clientX - drag.panX; view.y = ev.clientY - drag.panY; applyView(); }
    });
    window.addEventListener('mouseup', () => {
      if (drag && drag.node) drag.node.fixed = false;
      svg.classList.remove('panning'); drag = null;
    });

    function selectNode(id) {
      for (const { circle } of nodeEls) circle.classList.remove('selected');
      const hit = nodeEls.find(({ n }) => n.id === id);
      if (hit) hit.circle.classList.add('selected');
    }
    function applySearch(query) {
      const q = query.trim().toLowerCase();
      for (const { circle, label, n } of nodeEls) {
        const match = !q || n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q);
        circle.classList.toggle('dim', !match);
        label.classList.toggle('dim', !match);
      }
      for (const { line, l } of linkEls) {
        const am = !q || nodeById.get(l.source).id.toLowerCase().includes(q) || nodeById.get(l.target).id.toLowerCase().includes(q);
        line.classList.toggle('dim', q && !am);
      }
    }
    return { selectNode, applySearch };
  }

  const LAYOUTS = {
    force: { label: 'Force-directed', render: renderForceGraph },
  };

  // ---------- detail panel ----------
  const aside = el('aside');
  const link = (text, onclick) => el('a', { text, onclick });
  function panelEmpty() {
    aside.textContent = '';
    aside.append(el('h2', { text: 'Details' }));
    aside.append(el('p', { class: 'empty', text: 'Click a node to inspect it. Use the controls above to change what the graph shows, how it is laid out, and how nodes and links are encoded.' }));
  }
  function table(headers, rows) {
    const t = el('table');
    t.append(el('tr', {}, headers.map((h) => el('th', { text: h }))));
    for (const row of rows) t.append(el('tr', {}, row.map((c) => el('td', {}, [c]))));
    return t;
  }
  function csv(items, render) {
    return items.length
      ? el('p', {}, items.flatMap((x, i) => (i ? [', ', render(x)] : [render(x)])))
      : el('p', { class: 'empty', text: 'none' });
  }

  function showFile(path) {
    const file = fileByPath.get(path);
    if (!file) return;
    aside.textContent = '';
    aside.append(el('div', { class: 'kind', text: 'module' }));
    aside.append(el('h2', { text: path }));
    const facts = [
      `${file.loc} lines`, `${file.bytes} bytes`,
      file.churn != null ? `${file.churn} commits` : 'churn n/a',
      file.docCoverage != null ? `${Math.round(file.docCoverage * 100)}% documented` : 'no exports',
    ];
    aside.append(el('p', {}, facts.map((f) => el('span', { class: 'badge', text: f, style: 'margin-right:6px' }))));
    if (cycleMembers.has(path)) aside.append(el('p', {}, [el('span', { class: 'badge hot', text: 'in dependency cycle' })]));

    const imports = MODEL.moduleGraph.edges.filter((e) => e.from === path).map((e) => e.to);
    const importedBy = MODEL.moduleGraph.edges.filter((e) => e.to === path).map((e) => e.from);
    aside.append(el('h3', { text: `imports (${imports.length})` }));
    aside.append(csv(imports, (p) => link(p, () => showFile(p))));
    aside.append(el('h3', { text: `imported by (${importedBy.length})` }));
    aside.append(csv(importedBy, (p) => link(p, () => showFile(p))));

    const syms = symbolsByFile.get(path) || [];
    aside.append(el('h3', { text: `symbols (${syms.length})` }));
    if (syms.length) {
      aside.append(table(['name', 'kind', 'line', 'cx', 'used'], syms.map((s) => [
        link(s.name, () => showSymbol(s.id)),
        el('span', { text: s.kind }),
        el('span', { text: String(s.line) }),
        el('span', { text: s.complexity == null ? '—' : String(s.complexity) }),
        el('span', { text: String((refsByTarget.get(s.id) || []).length) }),
      ])));
    } else aside.append(el('p', { class: 'empty', text: 'none' }));
  }

  function showSymbol(id) {
    const s = symbolById.get(id);
    if (!s) { const path = id.split('#')[0]; if (fileByPath.has(path)) showFile(path); return; }
    aside.textContent = '';
    aside.append(el('div', { class: 'kind', text: s.kind + (s.exported ? ' · exported' : '') }));
    aside.append(el('h2', { text: s.name }));
    aside.append(el('p', {}, [link(s.file, () => showFile(s.file)), el('span', { text: ` :${s.line}–${s.endLine}` })]));

    const badges = [];
    if (s.complexity != null) badges.push(el('span', { class: 'badge' + (s.complexity >= 10 ? ' hot' : ''), text: `complexity ${s.complexity}`, style: 'margin-right:6px' }));
    badges.push(el('span', { class: 'badge', text: s.documented ? 'documented' : 'undocumented', style: 'margin-right:6px' }));
    if (uncalledSet.has(s.id)) badges.push(el('span', { class: 'badge hot', text: 'no incoming calls' }));
    aside.append(el('p', {}, badges));

    const calls = MODEL.callGraph.edges.filter((e) => e.from === id).map((e) => e.to);
    const calledBy = MODEL.callGraph.edges.filter((e) => e.to === id).map((e) => e.from);
    aside.append(el('h3', { text: `calls (${calls.length})` }));
    aside.append(csv(calls, (c) => link(c, () => showSymbol(c))));
    aside.append(el('h3', { text: `called by (${calledBy.length})` }));
    aside.append(csv(calledBy, (c) => link(c, () => showSymbol(c))));

    const typeEdges = MODEL.typeGraph.filter((e) => e.from === id || e.to === id);
    if (typeEdges.length) {
      aside.append(el('h3', { text: 'type relationships' }));
      aside.append(table(['from', 'relation', 'to'], typeEdges.map((e) => [
        link(symbolById.get(e.from)?.name || e.from, () => showSymbol(e.from)),
        el('span', { text: e.relation }),
        link(symbolById.get(e.to)?.name || e.to, () => showSymbol(e.to)),
      ])));
    }
    const apis = MODEL.apiUsage.filter((u) => u.inSymbol === id);
    if (apis.length) {
      aside.append(el('h3', { text: 'api usage' }));
      aside.append(table(['api', 'category', 'line'], apis.map((u) => [
        el('span', { text: u.api }),
        el('span', { class: 'badge', text: u.category, style: `color:${API_COLORS[u.category]}` }),
        el('span', { text: String(u.line) }),
      ])));
    }
  }

  function showApiCategory(category) {
    aside.textContent = '';
    aside.append(el('div', { class: 'kind', text: 'api category' }));
    aside.append(el('h2', { text: category }));
    const hits = MODEL.apiUsage.filter((u) => u.category === category);
    aside.append(el('h3', { text: `call sites (${hits.length})` }));
    aside.append(table(['api', 'where'], hits.map((u) => [
      el('span', { text: u.api }),
      el('p', {}, [u.inSymbol ? link(u.inSymbol, () => showSymbol(u.inSymbol)) : link(u.file, () => showFile(u.file)), el('span', { text: ` :${u.line}` })]),
    ])));
  }

  // ---------- chrome + control state ----------
  const graphHost = el('div', { id: 'graph' });
  const legend = el('div', { class: 'legend' });
  let active = null;

  const state = {
    structure: 'modules', layout: 'force',
    size: 'lines', color: 'directory', linkLabel: 'none', linkWidth: 'fixed', search: '',
  };

  function linkText(l) {
    if (state.linkLabel === 'weight') return String(l.weight ?? 1);
    if (state.linkLabel === 'relation') return l.relation || l.label || '';
    if (state.linkLabel === 'name') return l.label || '';
    return '';
  }
  function tooltip(n) {
    const m = n.meta;
    const bits = [n.id];
    if (m.loc != null) bits.push(`${m.loc} loc`);
    if (m.complexity != null) bits.push(`cx ${m.complexity}`);
    if (m.churn != null) bits.push(`churn ${m.churn}`);
    if (m.apiCount) bits.push(`${m.apiCount} api`);
    bits.push(`${n.degree} links`);
    return bits.join(' · ');
  }

  function applyLinkWidth(edges) {
    if (state.linkWidth === 'fixed') { edges.forEach((e) => (e.width = e.width || 1.2)); return; }
    const max = Math.max(1, ...edges.map((e) => e.weight || 1));
    edges.forEach((e) => (e.width = clamp(1 + ((e.weight || 1) / max) * 5, 1, 6)));
  }

  function updateLegend(structure, built) {
    legend.textContent = '';
    const metric = COLOR_METRICS[state.color];
    const chip = (color, text) => el('span', { class: 'chip' }, [el('span', { class: 'dot', style: `background:${color}` }), document.createTextNode(text)]);
    if (metric.categorical) {
      const cats = [...new Set(built.nodes.map((n) => metric.value(n)).filter((c) => c != null && c !== ''))].slice(0, 8);
      for (const c of cats) legend.append(chip(metric.colorFor(c), String(c).split('/').pop() || c));
    } else {
      legend.append(el('span', { class: 'chip' }, [el('span', { class: 'ramp' }), document.createTextNode(`${metric.label} (low→high)`)]));
    }
    if (structure === 'modules' && cycleMembers.size) legend.append(chip('#ff5d5d', 'cycle'));
    if (structure === 'calls' && uncalledSet.size) legend.append(chip('#ff5d5d', 'uncalled'));
    legend.append(el('span', { class: 'chip', text: `size: ${SIZE_METRICS[state.size].label}` }));
  }

  function rebuild() {
    const structure = STRUCTURES[state.structure];
    const built = structure.build();
    graphHost.textContent = '';
    if (built.nodes.length === 0) {
      graphHost.append(el('div', { class: 'view-empty', text: structure.emptyMessage || 'No data for this view.' }));
      legend.textContent = '';
      active = { applySearch() {}, selectNode() {} };
      return;
    }
    computeDegrees(built.nodes, built.edges);
    applySize(built.nodes, state.size);
    applyColor(built.nodes, state.color);
    applyLinkWidth(built.edges);
    const layout = LAYOUTS[state.layout];
    active = layout.render(graphHost, built, {
      onSelect: structure.onSelect, linkLabel: state.linkLabel, linkText, tooltip,
    });
    active.applySearch(state.search);
    updateLegend(structure, built);
  }

  // ---------- controls ----------
  function control(name, label, options, initial, onChange) {
    const select = el('select', { 'data-control': name });
    for (const [value, text] of options) {
      const opt = el('option', { value, text });
      if (value === initial) opt.setAttribute('selected', '');
      select.append(opt);
    }
    select.addEventListener('change', () => onChange(select.value));
    return el('label', { class: 'control' }, [el('span', { text: label }), select]);
  }

  const structureCtl = control('structure', 'Structure',
    Object.entries(STRUCTURES).map(([k, v]) => [k, v.label]), state.structure,
    (v) => { state.structure = v; rebuild(); });
  const layoutCtl = control('layout', 'Layout',
    Object.entries(LAYOUTS).map(([k, v]) => [k, v.label]), state.layout,
    (v) => { state.layout = v; rebuild(); });
  const sizeCtl = control('size', 'Size by',
    Object.entries(SIZE_METRICS).map(([k, v]) => [k, v.label]), state.size,
    (v) => { state.size = v; rebuild(); });
  const colorCtl = control('color', 'Color by',
    Object.entries(COLOR_METRICS).map(([k, v]) => [k, v.label]), state.color,
    (v) => { state.color = v; rebuild(); });
  const linkLabelCtl = control('link', 'Link label',
    [['none', 'None'], ['name', 'Target'], ['relation', 'Relation'], ['weight', 'Weight']], state.linkLabel,
    (v) => { state.linkLabel = v; rebuild(); });
  const linkWidthCtl = control('linkwidth', 'Link width',
    [['fixed', 'Uniform'], ['weight', 'By weight']], state.linkWidth,
    (v) => { state.linkWidth = v; rebuild(); });

  const searchInput = el('input', { type: 'search', placeholder: 'filter nodes…' });
  searchInput.addEventListener('input', () => { state.search = searchInput.value; if (active) active.applySearch(state.search); });

  // ---------- header ----------
  const projectName = MODEL.meta.projectRoot.split('/').filter(Boolean).pop() || MODEL.meta.projectRoot;
  const totalLoc = MODEL.files.reduce((sum, f) => sum + f.loc, 0);
  const stat = (n, label, warn) => el('span', { class: warn ? 'warn' : '' }, [el('b', { text: String(n) }), document.createTextNode(' ' + label)]);
  const stats = el('div', { class: 'stats' }, [
    stat(MODEL.meta.fileCount, 'files'),
    stat(totalLoc.toLocaleString(), 'lines'),
    stat(MODEL.symbols.length, 'symbols'),
    stat(MODEL.callGraph.edges.length, 'calls'),
    stat(MODEL.moduleGraph.cycles.length, 'cycles', MODEL.moduleGraph.cycles.length > 0),
    stat((MODEL.references || []).length, 'refs'),
  ]);

  document.body.append(
    el('header', {}, [el('h1', {}, [document.createTextNode('Code Analysis — '), el('span', { text: projectName })]), stats]),
    el('div', { class: 'toolbar' }, [structureCtl, layoutCtl, sizeCtl, colorCtl, linkLabelCtl, linkWidthCtl, searchInput]),
    el('div', { class: 'legendbar' }, [legend]),
    el('main', {}, [graphHost, aside]),
  );

  panelEmpty();
  rebuild();
})();
