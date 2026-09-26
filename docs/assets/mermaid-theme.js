// Material themes Mermaid diagrams with CSS passed to mermaid.initialize (themeCSS), but that CSS doesn't cover
// xychart-beta, which paints a white background and near-black text into the SVG. Material only loads Mermaid
// itself when `mermaid` is undefined, so mkdocs.yml loads it first and this appends the missing rules.
// Mermaid prefixes every rule with the diagram's own id and escapes '>', so each rule is scoped to xy charts with
// :where(...) (which adds no specificity) instead of nesting or child combinators.
(() => {
  const xy = ':where([aria-roledescription="xychart"] *)';
  const series = [1, 2, 3, 4, 5].map(n => `
    .line-plot-${n - 1} path${xy}, .legend .markers :nth-child(${n})${xy} { stroke: var(--perflab-series-${n}); }
    .bar-plot-${n - 1} rect${xy} { fill: var(--perflab-series-${n}); stroke: var(--perflab-series-${n}); }`).join('');
  const xychart = `
    .background${xy} { fill: transparent; }
    text${xy} { fill: var(--md-default-fg-color); }
    .axis-line path${xy}, .axisl-line path${xy}, .ticks path${xy} { stroke: var(--md-default-fg-color--light); }
    ${series}`;
  const initialize = mermaid.initialize.bind(mermaid);
  mermaid.initialize = config => initialize({ ...config, themeCSS: (config.themeCSS ?? '') + xychart });
})();
