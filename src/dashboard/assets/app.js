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
    filesystem: {
      label: 'File system', hierarchical: true,
      onSelect: (n) => (n.meta.type === 'file' ? showFile(n.id) : showDir(n.meta.dir)),
      build() {
        const nodes = [];
        const seen = new Set();
        const edgeSet = new Set();
        const edges = [];
        const ensure = (id, label, meta) => { if (!seen.has(id)) { seen.add(id); nodes.push({ id, label, meta }); } };
        const linkChild = (parent, child) => { const k = `${parent}|${child}`; if (!edgeSet.has(k)) { edgeSet.add(k); edges.push({ source: parent, target: child, arrow: false }); } };
        ensure('fs:.', projectName, { type: 'dir', dir: '' });
        for (const f of MODEL.files) {
          const segs = f.path.split('/');
          let parent = 'fs:.', acc = '';
          for (let i = 0; i < segs.length - 1; i++) {
            acc = acc ? `${acc}/${segs[i]}` : segs[i];
            ensure(`fs:${acc}`, segs[i], { type: 'dir', dir: acc });
            linkChild(parent, `fs:${acc}`);
            parent = `fs:${acc}`;
          }
          ensure(f.path, baseOf(f.path), fileMeta(f.path));
          linkChild(parent, f.path);
        }
        return { nodes, edges, hierarchical: true };
      },
    },
    symbols: {
      label: 'Symbols (AST)', hierarchical: true,
      onSelect: (n) => (n.meta.type === 'file' ? showFile(n.id) : showSymbol(n.id)),
      build() {
        const nodes = [];
        const seen = new Set();
        const edges = [];
        const ensure = (id, label, meta) => { if (!seen.has(id)) { seen.add(id); nodes.push({ id, label, meta }); } };
        for (const [file, syms] of symbolsByFile) {
          ensure(file, baseOf(file), fileMeta(file));
          for (const s of syms) ensure(s.id, s.name, symbolMeta(s.id));
          for (const s of syms) {
            const local = s.id.split('#')[1] || '';
            const parentId = local.includes('.') ? `${file}#${local.split('.').slice(0, -1).join('.')}` : file;
            edges.push({ source: seen.has(parentId) ? parentId : file, target: s.id, arrow: false });
          }
        }
        return { nodes, edges, hierarchical: true };
      },
    },
    references: {
      label: 'References (usage)', onSelect: (n) => (symbolById.has(n.id) ? showSymbol(n.id) : showFile(n.id)),
      emptyMessage: 'No references recorded.',
      build() {
        // referencer (enclosing symbol, or file for module-level uses) -> referenced symbol.
        const nodes = new Map();
        const weights = new Map();
        const addNode = (id) => {
          if (nodes.has(id)) return true;
          if (symbolById.has(id)) { nodes.set(id, { id, label: symbolById.get(id).name, meta: symbolMeta(id) }); return true; }
          if (fileByPath.has(id)) { nodes.set(id, { id, label: baseOf(id), meta: fileMeta(id) }); return true; }
          return false;
        };
        for (const r of MODEL.references || []) {
          const from = r.inSymbol || r.file;
          if (from === r.to || !addNode(from) || !addNode(r.to)) continue;
          const key = `${from}|${r.to}`;
          weights.set(key, (weights.get(key) ?? 0) + 1);
        }
        const edges = [...weights.entries()].map(([key, w]) => {
          const [source, target] = key.split('|');
          return { source, target, weight: w, label: String(w) };
        });
        return { nodes: [...nodes.values()], edges };
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

  // ---------- graph renderer (force-animated or static positions) ----------
  // opts.animate === false expects nodes to already carry x/y (set by a
  // positional layout such as the tree); otherwise a force sim places them.
  function mountGraph(container, built, opts) {
    const animate = opts.animate !== false;
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
    const sim = animate ? simulate(nodes, links, width, height) : null;
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
    let reheat = () => {};
    if (animate) {
      requestAnimationFrame(loop);
      reheat = (a) => { const cold = alpha < 0.004; alpha = Math.max(alpha, a); if (cold) requestAnimationFrame(loop); };
    } else {
      position(); // static layout already assigned x/y
    }

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
    // Usage focus: emphasize a node and the set of related ids; dim the rest.
    function focus(ids) {
      for (const { circle, label, n } of nodeEls) {
        const on = !ids || ids.has(n.id);
        circle.classList.toggle('faded', !on);
        label.classList.toggle('faded', !on);
      }
      for (const { line, l } of linkEls) {
        const on = !ids || (ids.has(l.source) && ids.has(l.target));
        line.classList.toggle('faded', !on);
      }
    }
    return { selectNode, applySearch, focus };
  }

  // ---------- hierarchy (containment for hierarchical structures, else
  // synthesized by directory so tree/treemap always have something) ----------
  function toHierarchy(built) {
    const nodeMap = new Map(built.nodes.map((n) => [n.id, n]));
    const childMap = new Map();
    if (built.hierarchical) {
      const indeg = new Map(built.nodes.map((n) => [n.id, 0]));
      for (const e of built.edges) {
        if (!childMap.has(e.source)) childMap.set(e.source, []);
        childMap.get(e.source).push(e.target);
        indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
      }
      const roots = built.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
      return { nodeMap, childMap, roots, edges: built.edges };
    }
    // synthesize: ROOT -> directory segments -> leaf nodes
    const edges = [];
    const ROOT = '∑root';
    const ensure = (id, label, meta) => {
      if (!nodeMap.has(id)) { nodeMap.set(id, { id, label, meta, synthetic: true }); childMap.set(id, []); }
      return id;
    };
    ensure(ROOT, projectName, { type: 'group', dir: '' });
    const linkChild = (parent, child) => {
      if (!childMap.has(parent)) childMap.set(parent, []);
      if (!childMap.get(parent).includes(child)) { childMap.get(parent).push(child); edges.push({ source: parent, target: child, arrow: false }); }
    };
    for (const n of built.nodes) {
      const dir = n.meta.dir && n.meta.dir !== '.' ? n.meta.dir : '';
      let parent = ROOT, acc = '';
      for (const seg of dir ? dir.split('/') : []) {
        acc = acc ? `${acc}/${seg}` : seg;
        ensure(`dir:${acc}`, seg, { type: 'group', dir: acc });
        linkChild(parent, `dir:${acc}`);
        parent = `dir:${acc}`;
      }
      linkChild(parent, n.id);
    }
    return { nodeMap, childMap, roots: [ROOT], edges };
  }

  // ---------- tree layout (tidy horizontal hierarchy) ----------
  function layoutTree(container, built, opts) {
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;
    const { nodeMap, childMap, roots, edges } = built.hierarchy;
    let leaf = 0;
    let maxDepth = 0;
    const placed = new Map();
    const walk = (id, depth) => {
      maxDepth = Math.max(maxDepth, depth);
      const kids = childMap.get(id) || [];
      let order;
      if (!kids.length) order = leaf++;
      else { const os = kids.map((k) => walk(k, depth + 1)); order = (os[0] + os[os.length - 1]) / 2; }
      placed.set(id, { depth, order });
      return order;
    };
    for (const r of roots) walk(r, 0);
    const leaves = Math.max(1, leaf);
    const xGap = Math.max(110, (width - 120) / (maxDepth + 1));
    const allNodes = [...nodeMap.values()];
    for (const n of allNodes) {
      const p = placed.get(n.id) || { depth: 0, order: 0 };
      n.x = 70 + p.depth * xGap;
      n.y = 40 + (p.order / leaves) * (height - 80) + (height - 80) / (leaves * 2);
    }
    return mountGraph(container, { nodes: allNodes, edges }, { ...opts, animate: false });
  }

  // ---------- treemap (nested squares) ----------
  // Squarified treemap (Bruls et al.): rows of tiles chosen to keep aspect
  // ratios near 1. Each level lays out its own children inside its rectangle.
  function squarify(items, x, y, w, h, valueOf, place) {
    if (w <= 0 || h <= 0 || !items.length) return;
    const total = items.reduce((s, it) => s + valueOf(it), 0) || 1;
    const scale = (w * h) / total;
    const areas = items.map((it) => ({ it, area: Math.max(0, valueOf(it) * scale) })).filter((a) => a.area > 0);
    const worst = (row, len) => {
      if (!row.length) return Infinity;
      const s = row.reduce((a, r) => a + r.area, 0);
      const mx = Math.max(...row.map((r) => r.area)), mn = Math.min(...row.map((r) => r.area));
      return Math.max((len * len * mx) / (s * s), (s * s) / (len * len * mn));
    };
    const placeRow = (row, rect) => {
      const sum = row.reduce((a, r) => a + r.area, 0);
      if (rect.w >= rect.h) {
        const sw = sum / rect.h; let yy = rect.y;
        for (const r of row) { const hh = r.area / sw; place(r.it, rect.x, yy, sw, hh); yy += hh; }
        return { x: rect.x + sw, y: rect.y, w: rect.w - sw, h: rect.h };
      }
      const sh = sum / rect.w; let xx = rect.x;
      for (const r of row) { const ww = r.area / sh; place(r.it, xx, rect.y, ww, sh); xx += ww; }
      return { x: rect.x, y: rect.y + sh, w: rect.w, h: rect.h - sh };
    };
    let rect = { x, y, w, h }, row = [], i = 0;
    while (i < areas.length) {
      const len = Math.min(rect.w, rect.h);
      const next = [...row, areas[i]];
      if (!row.length || worst(row, len) >= worst(next, len)) { row = next; i++; }
      else { rect = placeRow(row, rect); row = []; }
    }
    if (row.length) placeRow(row, rect);
  }

  function layoutTreemap(container, built, opts) {
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;
    const { nodeMap, childMap, roots } = built.hierarchy;
    const sizeMetric = SIZE_METRICS[state.size];
    const valCache = new Map();
    const valueOf = (id) => {
      if (valCache.has(id)) return valCache.get(id);
      const kids = childMap.get(id) || [];
      let v;
      if (!kids.length) { const raw = sizeMetric.value(nodeMap.get(id)); v = typeof raw === 'number' && isFinite(raw) && raw > 0 ? raw : 1; }
      else v = kids.reduce((s, k) => s + valueOf(k), 0) || 1;
      valCache.set(id, v); return v;
    };
    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}` });
    container.append(svg);
    container.append(el('div', { class: 'hint', text: `nested squares sized by ${sizeMetric.label.toLowerCase()} · click a tile for details` }));
    const rectEls = [];
    const draw = (id, x, y, w, h, depth) => {
      const n = nodeMap.get(id);
      const kids = childMap.get(id) || [];
      const leaf = !kids.length;
      const rect = svgEl('rect', {
        x, y, width: Math.max(0, w), height: Math.max(0, h),
        class: 'tm' + (leaf ? ' leaf' : ''), fill: leaf ? n.color : 'none',
        stroke: leaf ? '#0f1419' : '#2a3340', 'stroke-width': leaf ? 0.5 : depth ? 1 : 0,
      });
      rect.append(svgEl('title'));
      rect.querySelector('title').textContent = opts.tooltip(n);
      svg.append(rect);
      rectEls.push({ rect, n, leaf });
      if (leaf) {
        rect.addEventListener('click', (e) => { e.stopPropagation(); selectNode(id); opts.onSelect(n); });
        if (w > 34 && h > 14) { const t = svgEl('text', { x: x + 3, y: y + 12, class: 'tm-label' }); t.textContent = n.label; svg.append(t); }
        return;
      }
      const pad = 2, header = depth && h > 24 && w > 44 ? 13 : 0;
      if (header) { const t = svgEl('text', { x: x + 3, y: y + 10, class: 'tm-group' }); t.textContent = n.label; svg.append(t); }
      const sorted = [...kids].sort((a, b) => valueOf(b) - valueOf(a));
      squarify(sorted, x + pad, y + pad + header, w - 2 * pad, h - 2 * pad - header, valueOf,
        (cid, cx, cy, cw, ch) => draw(cid, cx, cy, cw, ch, depth + 1));
    };
    for (const r of roots) draw(r, 0, 0, width, height, 0);

    function selectNode(id) {
      for (const { rect } of rectEls) rect.classList.remove('selected');
      const hit = rectEls.find((r) => r.n.id === id);
      if (hit) hit.rect.classList.add('selected');
    }
    function applySearch(query) {
      const q = query.trim().toLowerCase();
      for (const { rect, n, leaf } of rectEls) {
        if (!leaf) continue;
        const m = !q || n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q);
        rect.classList.toggle('dim', !m);
      }
    }
    function focus(ids) {
      for (const { rect, n, leaf } of rectEls) {
        if (!leaf) continue;
        rect.classList.toggle('faded', ids && !ids.has(n.id));
      }
    }
    return { selectNode, applySearch, focus };
  }

  const LAYOUTS = {
    force: { label: 'Force-directed', render: (c, b, o) => mountGraph(c, b, { ...o, animate: true }) },
    tree: { label: 'Tree (hierarchy)', render: layoutTree },
    treemap: { label: 'Treemap (nested squares)', render: layoutTreemap },
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

    // Usage exploration: where this symbol (type/function/value) is used.
    const refs = refsByTarget.get(id) || [];
    const head = el('h3', {}, [
      document.createTextNode(`used at (${refs.length}) `),
      refs.length ? el('a', { class: 'focus-link', text: '◎ focus usages', onclick: () => focusUsages(id) }) : document.createTextNode(''),
    ]);
    aside.append(head);
    if (refs.length) {
      aside.append(table(['where', 'line'], refs.slice(0, 60).map((r) => [
        r.inSymbol ? link(r.inSymbol, () => showSymbol(r.inSymbol)) : link(r.file, () => showFile(r.file)),
        el('span', { text: String(r.line) }),
      ])));
    } else {
      aside.append(el('p', { class: 'empty', text: 'no references found' }));
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

  function showDir(dir) {
    aside.textContent = '';
    aside.append(el('div', { class: 'kind', text: 'directory' }));
    aside.append(el('h2', { text: dir || projectName }));
    const here = MODEL.files.filter((f) => dirOf(f.path) === (dir || '.') || (dir && f.path.startsWith(`${dir}/`)));
    const loc = here.reduce((n, f) => n + f.loc, 0);
    aside.append(el('p', {}, [el('span', { class: 'badge', text: `${here.length} files`, style: 'margin-right:6px' }), el('span', { class: 'badge', text: `${loc} lines` })]));
    aside.append(el('h3', { text: 'files' }));
    aside.append(table(['file', 'loc', 'cx'], here.slice(0, 60).map((f) => [
      link(f.path, () => showFile(f.path)),
      el('span', { text: String(f.loc) }),
      el('span', { text: String(maxComplexityByFile.get(f.path) ?? '—') }),
    ])));
  }

  // ---------- chrome + control state ----------
  const graphHost = el('div', { id: 'graph' });
  const legend = el('div', { class: 'legend' });
  const focusChip = el('div', { class: 'focuschip' });
  let active = null;

  const state = {
    structure: 'modules', layout: 'force', focus: null,
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
    // Positional layouts (tree, treemap) need a hierarchy: containment for
    // hierarchical structures, otherwise synthesized by directory.
    const needsHierarchy = state.layout === 'tree' || state.layout === 'treemap';
    if (needsHierarchy) built.hierarchy = toHierarchy(built);
    const renderNodes = needsHierarchy ? [...built.hierarchy.nodeMap.values()] : built.nodes;
    const renderEdges = needsHierarchy ? built.hierarchy.edges : built.edges;
    computeDegrees(renderNodes, renderEdges);
    applySize(renderNodes, state.size);
    applyColor(renderNodes, state.color);
    applyLinkWidth(renderEdges);
    const layout = LAYOUTS[state.layout];
    active = layout.render(graphHost, built, {
      onSelect: structure.onSelect, linkLabel: state.linkLabel, linkText, tooltip,
    });
    active.applySearch(state.search);
    if (state.focus && active.focus) { active.focus(state.focus.ids); if (active.selectNode) active.selectNode(state.focus.center); }
    updateLegend(structure, built);
    updateFocusChip();
  }

  // Switch to the usage structure and highlight a symbol's use sites.
  function focusUsages(id) {
    const refs = refsByTarget.get(id) || [];
    const ids = new Set([id]);
    for (const r of refs) ids.add(r.inSymbol || r.file);
    state.focus = { center: id, ids };
    state.structure = 'references';
    structureCtl.querySelector('select').value = 'references';
    rebuild();
  }
  function clearFocus() {
    state.focus = null;
    if (active && active.focus) active.focus(null);
    updateFocusChip();
  }
  function updateFocusChip() {
    focusChip.textContent = '';
    if (!state.focus) return;
    const name = symbolById.get(state.focus.center)?.name || state.focus.center;
    focusChip.append(
      el('span', { class: 'badge', text: `focused: ${name} (${state.focus.ids.size - 1} use sites)` }),
      el('a', { class: 'clear', text: '✕ clear', onclick: clearFocus }),
    );
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
    (v) => { state.structure = v; state.focus = null; rebuild(); });
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
    el('div', { class: 'legendbar' }, [legend, focusChip]),
    el('main', {}, [graphHost, aside]),
  );

  panelEmpty();
  rebuild();
})();
