'use strict';
/*
 * Code Analysis Dashboard renderer. Self-contained vanilla JS: reads
 * window.MODEL (inlined by the generator), renders four linked views —
 * Modules, Types, Calls, APIs — with overlay heat-maps, search, and a
 * cross-linked detail panel. No external dependencies by design.
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
  const cycleMembers = new Set(MODEL.moduleGraph.cycles.flat());
  const uncalledSet = new Set(MODEL.callGraph.uncalled);

  const KIND_COLORS = {
    class: '#4da3ff',
    interface: '#b18cff',
    typeAlias: '#5fd0a5',
    enum: '#ffb86b',
    function: '#4da3ff',
    method: '#7fb8f7',
    variable: '#5fd0a5',
    module: '#8a95a3',
  };
  const API_COLORS = {
    filesystem: '#ffb86b',
    network: '#4da3ff',
    process: '#5fd0a5',
    shell: '#ff5d5d',
    crypto: '#b18cff',
    dom: '#f7768e',
    storage: '#e0af68',
    database: '#2ac3de',
  };

  // ---------- small helpers ----------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const heat = (t) => `hsl(${120 * (1 - clamp(t, 0, 1))} 70% 45%)`;

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

  const dirHue = (() => {
    const dirs = [...new Set(MODEL.files.map((f) => f.path.split('/').slice(0, -1).join('/')))].sort();
    const map = new Map(dirs.map((d, i) => [d, (i * 360) / Math.max(1, dirs.length)]));
    return (path) => map.get(path.split('/').slice(0, -1).join('/')) ?? 0;
  })();

  // ---------- force simulation ----------
  function simulate(nodes, links, width, height) {
    const idx = new Map(nodes.map((n, i) => [n.id, i]));
    const L = links
      .filter((l) => idx.has(l.source) && idx.has(l.target))
      .map((l) => ({ a: idx.get(l.source), b: idx.get(l.target) }));
    for (const n of nodes) {
      n.x = width / 2 + (Math.random() - 0.5) * width * 0.6;
      n.y = height / 2 + (Math.random() - 0.5) * height * 0.6;
      n.vx = 0;
      n.vy = 0;
    }
    const k = Math.sqrt((width * height) / Math.max(1, nodes.length)) * 0.7;

    function tick(alpha) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = 1;
          }
          const d = Math.sqrt(d2);
          const force = ((k * k) / d2) * alpha * 14;
          const fx = (dx / d) * force;
          const fy = (dy / d) * force;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }
      for (const { a, b } of L) {
        const na = nodes[a];
        const nb = nodes[b];
        const dx = nb.x - na.x;
        const dy = nb.y - na.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = ((d - k * 1.1) / d) * alpha * 0.35;
        na.vx += dx * force; na.vy += dy * force;
        nb.vx -= dx * force; nb.vy -= dy * force;
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

  // ---------- generic graph view ----------
  function renderGraph(container, spec) {
    container.textContent = '';
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
    const applyView = () =>
      world.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.scale})`);

    const nodes = spec.nodes;
    const links = spec.links;
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const sim = simulate(nodes, links, width, height);

    const linkEls = links
      .filter((l) => nodeById.has(l.source) && nodeById.has(l.target))
      .map((l) => {
        const line = svgEl('line', {
          class: 'link',
          stroke: l.color || '#5c6877',
          'stroke-width': l.width || 1.2,
          'marker-end': l.arrow === false ? '' : 'url(#arrow)',
        });
        if (l.dash) line.setAttribute('stroke-dasharray', l.dash);
        world.append(line);
        return { line, l };
      });

    const nodeEls = nodes.map((n) => {
      const circle = svgEl('circle', {
        class: 'node',
        r: n.r,
        fill: n.color,
        stroke: n.stroke || '#0f1419',
        'stroke-width': n.strokeWidth || 1,
      });
      circle.append(svgEl('title'));
      circle.querySelector('title').textContent = n.title || n.label;
      const label = svgEl('text', { class: 'node-label', 'text-anchor': 'middle' });
      label.textContent = n.label;
      world.append(circle);
      if (nodes.length <= 140) world.append(label);
      circle.addEventListener('click', (ev) => {
        ev.stopPropagation();
        selectNode(n.id);
        if (spec.onSelect) spec.onSelect(n);
      });
      return { circle, label, n };
    });

    function position() {
      for (const { line, l } of linkEls) {
        const a = nodeById.get(l.source);
        const b = nodeById.get(l.target);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        // stop the line at the target's radius so arrowheads stay visible
        line.setAttribute('x1', a.x + (dx / d) * a.r);
        line.setAttribute('y1', a.y + (dy / d) * a.r);
        line.setAttribute('x2', b.x - (dx / d) * (b.r + 2));
        line.setAttribute('y2', b.y - (dy / d) * (b.r + 2));
      }
      for (const { circle, label, n } of nodeEls) {
        circle.setAttribute('cx', n.x);
        circle.setAttribute('cy', n.y);
        label.setAttribute('x', n.x);
        label.setAttribute('y', n.y - n.r - 4);
      }
    }

    let alpha = 1;
    function loop() {
      if (alpha < 0.004) return;
      alpha *= 0.97;
      sim.tick(alpha);
      position();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    const reheat = (a) => {
      const wasCold = alpha < 0.004;
      alpha = Math.max(alpha, a);
      if (wasCold) requestAnimationFrame(loop);
    };

    // pan / zoom / drag
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
      view.scale = next;
      applyView();
    }, { passive: false });

    let drag = null;
    svg.addEventListener('mousedown', (ev) => {
      const hit = nodeEls.find(({ circle }) => circle === ev.target);
      if (hit) {
        drag = { node: hit.n };
        hit.n.fixed = true;
      } else {
        drag = { panX: ev.clientX - view.x, panY: ev.clientY - view.y };
        svg.classList.add('panning');
      }
    });
    window.addEventListener('mousemove', (ev) => {
      if (!drag) return;
      if (drag.node) {
        const p = toWorld(ev);
        drag.node.x = p.x;
        drag.node.y = p.y;
        reheat(0.12);
        position();
      } else {
        view.x = ev.clientX - drag.panX;
        view.y = ev.clientY - drag.panY;
        applyView();
      }
    });
    window.addEventListener('mouseup', () => {
      if (drag && drag.node) drag.node.fixed = false;
      svg.classList.remove('panning');
      drag = null;
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
        const am = !q || nodeById.get(l.source).id.toLowerCase().includes(q) ||
          nodeById.get(l.target).id.toLowerCase().includes(q);
        line.classList.toggle('dim', q && !am);
      }
    }

    return { selectNode, applySearch };
  }

  // ---------- detail panel ----------
  const aside = el('aside');

  function link(text, onclick) {
    return el('a', { text, onclick });
  }

  function panelEmpty() {
    aside.textContent = '';
    aside.append(el('h2', { text: 'Details' }));
    aside.append(el('p', {
      class: 'empty',
      text: 'Click a node to inspect it. Use the tabs to switch analysis layers and the overlay to recolor the map.',
    }));
  }

  function table(headers, rows) {
    const t = el('table');
    t.append(el('tr', {}, headers.map((h) => el('th', { text: h }))));
    for (const row of rows) t.append(el('tr', {}, row.map((c) => el('td', {}, [c]))));
    return t;
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
    if (cycleMembers.has(path)) {
      aside.append(el('p', {}, [el('span', { class: 'badge hot', text: 'in dependency cycle' })]));
    }

    const imports = MODEL.moduleGraph.edges.filter((e) => e.from === path).map((e) => e.to);
    const importedBy = MODEL.moduleGraph.edges.filter((e) => e.to === path).map((e) => e.from);
    aside.append(el('h3', { text: `imports (${imports.length})` }));
    aside.append(imports.length
      ? el('p', {}, imports.flatMap((p, i) => (i ? [', ', link(p, () => showFile(p))] : [link(p, () => showFile(p))])))
      : el('p', { class: 'empty', text: 'none' }));
    aside.append(el('h3', { text: `imported by (${importedBy.length})` }));
    aside.append(importedBy.length
      ? el('p', {}, importedBy.flatMap((p, i) => (i ? [', ', link(p, () => showFile(p))] : [link(p, () => showFile(p))])))
      : el('p', { class: 'empty', text: 'none' }));

    const syms = (symbolsByFile.get(path) || []);
    aside.append(el('h3', { text: `symbols (${syms.length})` }));
    if (syms.length) {
      aside.append(table(
        ['name', 'kind', 'line', 'cx', 'doc'],
        syms.map((s) => [
          link(s.name, () => showSymbol(s.id)),
          el('span', { text: s.kind }),
          el('span', { text: String(s.line) }),
          el('span', { text: s.complexity == null ? '—' : String(s.complexity) }),
          el('span', { text: s.documented ? '✓' : s.exported ? '✗' : '—' }),
        ]),
      ));
    } else {
      aside.append(el('p', { class: 'empty', text: 'none' }));
    }

    const apis = apiByFile.get(path) || [];
    aside.append(el('h3', { text: `api usage (${apis.length})` }));
    if (apis.length) {
      aside.append(table(
        ['api', 'category', 'line'],
        apis.map((u) => [
          el('span', { text: u.api }),
          el('span', { class: 'badge', text: u.category, style: `color:${API_COLORS[u.category]}` }),
          el('span', { text: String(u.line) }),
        ]),
      ));
    } else {
      aside.append(el('p', { class: 'empty', text: 'none' }));
    }
  }

  function showSymbol(id) {
    const s = symbolById.get(id);
    if (!s) {
      // module pseudo-node from the call graph
      const path = id.split('#')[0];
      if (fileByPath.has(path)) showFile(path);
      return;
    }
    aside.textContent = '';
    aside.append(el('div', { class: 'kind', text: s.kind + (s.exported ? ' · exported' : '') }));
    aside.append(el('h2', { text: s.name }));
    aside.append(el('p', {}, [link(s.file, () => showFile(s.file)), el('span', { text: ` :${s.line}–${s.endLine}` })]));

    const badges = [];
    if (s.complexity != null) {
      badges.push(el('span', {
        class: 'badge' + (s.complexity >= 10 ? ' hot' : ''),
        text: `complexity ${s.complexity}`,
        style: 'margin-right:6px',
      }));
    }
    badges.push(el('span', { class: 'badge', text: s.documented ? 'documented' : 'undocumented', style: 'margin-right:6px' }));
    if (uncalledSet.has(s.id)) badges.push(el('span', { class: 'badge hot', text: 'no incoming calls' }));
    aside.append(el('p', {}, badges));

    const calls = MODEL.callGraph.edges.filter((e) => e.from === id).map((e) => e.to);
    const calledBy = MODEL.callGraph.edges.filter((e) => e.to === id).map((e) => e.from);
    aside.append(el('h3', { text: `calls (${calls.length})` }));
    aside.append(calls.length
      ? el('p', {}, calls.flatMap((c, i) => (i ? [', ', link(c, () => showSymbol(c))] : [link(c, () => showSymbol(c))])))
      : el('p', { class: 'empty', text: 'none detected' }));
    aside.append(el('h3', { text: `called by (${calledBy.length})` }));
    aside.append(calledBy.length
      ? el('p', {}, calledBy.flatMap((c, i) => (i ? [', ', link(c, () => showSymbol(c))] : [link(c, () => showSymbol(c))])))
      : el('p', { class: 'empty', text: 'none detected' }));

    const typeEdges = MODEL.typeGraph.filter((e) => e.from === id || e.to === id);
    if (typeEdges.length) {
      aside.append(el('h3', { text: 'type relationships' }));
      aside.append(table(
        ['from', 'relation', 'to'],
        typeEdges.map((e) => [
          link(symbolById.get(e.from)?.name || e.from, () => showSymbol(e.from)),
          el('span', { text: e.relation }),
          link(symbolById.get(e.to)?.name || e.to, () => showSymbol(e.to)),
        ]),
      ));
    }

    const apis = MODEL.apiUsage.filter((u) => u.inSymbol === id);
    if (apis.length) {
      aside.append(el('h3', { text: 'api usage' }));
      aside.append(table(
        ['api', 'category', 'line'],
        apis.map((u) => [
          el('span', { text: u.api }),
          el('span', { class: 'badge', text: u.category, style: `color:${API_COLORS[u.category]}` }),
          el('span', { text: String(u.line) }),
        ]),
      ));
    }
  }

  function showApiCategory(category) {
    aside.textContent = '';
    aside.append(el('div', { class: 'kind', text: 'api category' }));
    aside.append(el('h2', { text: category }));
    const hits = MODEL.apiUsage.filter((u) => u.category === category);
    aside.append(el('h3', { text: `call sites (${hits.length})` }));
    aside.append(table(
      ['api', 'where'],
      hits.map((u) => [
        el('span', { text: u.api }),
        el('p', {}, [
          u.inSymbol
            ? link(u.inSymbol, () => showSymbol(u.inSymbol))
            : link(u.file, () => showFile(u.file)),
          el('span', { text: ` :${u.line}` }),
        ]),
      ]),
    ));
  }

  // ---------- overlays (Modules view) ----------
  const fileComplexity = new Map(MODEL.files.map((f) => {
    const syms = symbolsByFile.get(f.path) || [];
    return [f.path, Math.max(0, ...syms.map((s) => s.complexity ?? 0))];
  }));
  const OVERLAYS = {
    structure: { label: 'Structure (by directory)' },
    complexity: { label: 'Max complexity', value: (f) => fileComplexity.get(f.path) },
    churn: { label: 'Change frequency', value: (f) => f.churn ?? 0 },
    size: { label: 'File size (loc)', value: (f) => f.loc },
    docs: { label: 'Doc gaps', value: (f) => (f.docCoverage == null ? 0 : 1 - f.docCoverage) },
    api: { label: 'API sensitivity', value: (f) => (apiByFile.get(f.path) || []).length },
  };

  function moduleNodeColor(file, overlayKey) {
    if (overlayKey === 'structure') return `hsl(${dirHue(file.path)} 55% 55%)`;
    const overlay = OVERLAYS[overlayKey];
    const values = MODEL.files.map(overlay.value);
    const max = Math.max(1e-9, ...values);
    return heat(overlay.value(file) / max);
  }

  // ---------- views ----------
  const graphHost = el('div', { id: 'graph' });
  let active;

  function viewModules(overlayKey) {
    const nodes = MODEL.moduleGraph.nodes.map((path) => {
      const file = fileByPath.get(path) || { loc: 1, path };
      return {
        id: path,
        label: path.split('/').pop(),
        r: clamp(4 + Math.sqrt(file.loc) * 0.9, 5, 26),
        color: moduleNodeColor(file, overlayKey),
        stroke: cycleMembers.has(path) ? '#ff5d5d' : '#0f1419',
        strokeWidth: cycleMembers.has(path) ? 2.5 : 1,
        title: `${path}\n${file.loc} loc · churn ${file.churn ?? 'n/a'} · max cx ${fileComplexity.get(path) ?? 0}`,
      };
    });
    const cyclePairs = new Set();
    for (const cycle of MODEL.moduleGraph.cycles) {
      for (const a of cycle) for (const b of cycle) cyclePairs.add(`${a}|${b}`);
    }
    const links = MODEL.moduleGraph.edges.map((e) => ({
      source: e.from,
      target: e.to,
      color: cyclePairs.has(`${e.from}|${e.to}`) ? '#ff5d5d' : '#5c6877',
      width: cyclePairs.has(`${e.from}|${e.to}`) ? 2 : 1.2,
    }));
    return renderGraph(graphHost, { nodes, links, onSelect: (n) => showFile(n.id) });
  }

  function viewTypes() {
    const typeKinds = new Set(['class', 'interface', 'typeAlias', 'enum']);
    const inEdges = new Set(MODEL.typeGraph.flatMap((e) => [e.from, e.to]));
    const nodes = MODEL.symbols
      .filter((s) => typeKinds.has(s.kind))
      .map((s) => ({
        id: s.id,
        label: s.name,
        r: inEdges.has(s.id) ? 10 : 7,
        color: KIND_COLORS[s.kind],
        title: `${s.id}\n${s.kind}${s.documented ? ' · documented' : ''}`,
      }));
    const relStyle = {
      extends: {},
      implements: { dash: '6 4' },
      alias: { dash: '2 4' },
    };
    const links = MODEL.typeGraph.map((e) => ({
      source: e.from, target: e.to, ...relStyle[e.relation],
    }));
    return renderGraph(graphHost, { nodes, links, onSelect: (n) => showSymbol(n.id) });
  }

  function viewCalls() {
    const callable = MODEL.symbols.filter((s) => s.complexity != null);
    const pseudo = new Set();
    for (const e of MODEL.callGraph.edges) {
      if (e.from.endsWith('#<module>')) pseudo.add(e.from);
    }
    const nodes = [
      ...callable.map((s) => ({
        id: s.id,
        label: s.name,
        r: clamp(4 + (s.complexity ?? 1) * 0.9, 5, 22),
        color: uncalledSet.has(s.id) ? '#ff5d5d' : heat((s.complexity ?? 1) / 15),
        title: `${s.id}\ncomplexity ${s.complexity}${uncalledSet.has(s.id) ? ' · no incoming calls' : ''}`,
      })),
      ...[...pseudo].map((id) => ({
        id,
        label: id.split('#')[0].split('/').pop(),
        r: 6,
        color: KIND_COLORS.module,
        title: `${id}\nmodule top-level code`,
      })),
    ];
    const links = MODEL.callGraph.edges.map((e) => ({ source: e.from, target: e.to }));
    return renderGraph(graphHost, { nodes, links, onSelect: (n) => showSymbol(n.id) });
  }

  function viewApis() {
    const categories = [...new Set(MODEL.apiUsage.map((u) => u.category))].sort();
    const files = [...new Set(MODEL.apiUsage.map((u) => u.file))].sort();
    const counts = new Map();
    for (const u of MODEL.apiUsage) {
      const key = `${u.category}|${u.file}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const nodes = [
      ...categories.map((c) => ({
        id: `cat:${c}`,
        label: c,
        r: 14,
        color: API_COLORS[c] || '#8a95a3',
        title: `${c}\n${MODEL.apiUsage.filter((u) => u.category === c).length} call sites`,
      })),
      ...files.map((f) => ({
        id: f,
        label: f.split('/').pop(),
        r: 8,
        color: '#3a4654',
        title: f,
      })),
    ];
    const links = [...counts.entries()].map(([key, n]) => {
      const [category, file] = key.split('|');
      return {
        source: `cat:${category}`, target: file,
        color: API_COLORS[category], width: Math.min(1 + n, 6), arrow: false,
      };
    });
    return renderGraph(graphHost, {
      nodes,
      links,
      onSelect: (n) => (n.id.startsWith('cat:') ? showApiCategory(n.id.slice(4)) : showFile(n.id)),
    });
  }

  // ---------- chrome ----------
  const projectName = MODEL.meta.projectRoot.split('/').filter(Boolean).pop() || MODEL.meta.projectRoot;
  const totalLoc = MODEL.files.reduce((sum, f) => sum + f.loc, 0);

  const stats = el('div', { class: 'stats' }, [
    el('span', {}, [el('b', { text: String(MODEL.meta.fileCount) }), document.createTextNode(' files')]),
    el('span', {}, [el('b', { text: totalLoc.toLocaleString() }), document.createTextNode(' lines')]),
    el('span', {}, [el('b', { text: String(MODEL.symbols.length) }), document.createTextNode(' symbols')]),
    el('span', {}, [el('b', { text: String(MODEL.callGraph.edges.length) }), document.createTextNode(' call edges')]),
    el('span', { class: MODEL.moduleGraph.cycles.length ? 'warn' : '' }, [
      el('b', { text: String(MODEL.moduleGraph.cycles.length) }),
      document.createTextNode(' cycles'),
    ]),
    el('span', {}, [el('b', { text: String(MODEL.apiUsage.length) }), document.createTextNode(' API hits')]),
  ]);

  const overlaySelect = el('select');
  for (const [key, o] of Object.entries(OVERLAYS)) {
    overlaySelect.append(el('option', { value: key, text: o.label }));
  }
  const overlayLabel = el('label', { text: 'Overlay: ' });

  const searchInput = el('input', { type: 'search', placeholder: 'filter nodes…' });
  searchInput.addEventListener('input', () => active && active.applySearch(searchInput.value));

  const legend = el('div', { class: 'legend' });

  const VIEWS = {
    modules: {
      label: 'Modules',
      render: () => viewModules(overlaySelect.value),
      legend: () => overlaySelect.value === 'structure'
        ? [chipDot('#ff5d5d', 'cycle member (red ring/edges)'), chipText('node size = lines of code')]
        : [chipRamp('low → high'), chipDot('#ff5d5d', 'cycle member')],
    },
    types: {
      label: 'Types',
      render: viewTypes,
      legend: () => [
        chipDot(KIND_COLORS.class, 'class'), chipDot(KIND_COLORS.interface, 'interface'),
        chipDot(KIND_COLORS.typeAlias, 'type alias'), chipDot(KIND_COLORS.enum, 'enum'),
        chipLine('', 'extends'), chipLine('dashed', 'implements'), chipLine('dotted', 'alias'),
      ],
    },
    calls: {
      label: 'Calls',
      render: viewCalls,
      legend: () => [
        chipRamp('complexity'), chipDot('#ff5d5d', 'no incoming calls'),
        chipDot(KIND_COLORS.module, 'module top-level'),
      ],
    },
    apis: {
      label: 'APIs',
      render: viewApis,
      legend: () => Object.entries(API_COLORS)
        .filter(([c]) => MODEL.apiUsage.some((u) => u.category === c))
        .map(([c, color]) => chipDot(color, c)),
    },
  };

  function chipDot(color, text) {
    return el('span', { class: 'chip' }, [el('span', { class: 'dot', style: `background:${color}` }), document.createTextNode(text)]);
  }
  function chipLine(style, text) {
    return el('span', { class: 'chip' }, [el('span', { class: `line ${style}` }), document.createTextNode(text)]);
  }
  function chipRamp(text) {
    return el('span', { class: 'chip' }, [el('span', { class: 'ramp' }), document.createTextNode(text)]);
  }
  function chipText(text) {
    return el('span', { class: 'chip', text });
  }

  const nav = el('nav');
  let activeKey = 'modules';

  function switchView(key) {
    activeKey = key;
    for (const button of nav.children) button.classList.toggle('active', button.dataset.key === key);
    overlayLabel.style.display = key === 'modules' ? '' : 'none';
    overlaySelect.style.display = key === 'modules' ? '' : 'none';
    legend.textContent = '';
    for (const chip of VIEWS[key].legend()) legend.append(chip);
    active = VIEWS[key].render();
    active.applySearch(searchInput.value);
  }

  for (const [key, v] of Object.entries(VIEWS)) {
    const button = el('button', { text: v.label, 'data-key': key, onclick: () => switchView(key) });
    nav.append(button);
  }

  overlaySelect.addEventListener('change', () => switchView('modules'));

  document.body.append(
    el('header', {}, [
      el('h1', {}, [document.createTextNode('Code Analysis — '), el('span', { text: projectName })]),
      stats,
      nav,
    ]),
    el('div', { class: 'toolbar' }, [overlayLabel, overlaySelect, searchInput, legend]),
    el('main', {}, [graphHost, aside]),
  );

  panelEmpty();
  switchView('modules');
})();
