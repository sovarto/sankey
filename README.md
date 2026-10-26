# @sovarto/sankey

Framework-independent Sankey diagram engine: layout, SVG geometry, and label collision handling, following [SankeyMATIC](https://sankeymatic.com)'s visual style and layout algorithms. It has no DOM or UI-framework dependency, so it runs on the server and in the browser; wrap it in React, Remix, or plain DOM code.

```sh
npm install @sovarto/sankey
```

```ts
import { computeSankeyLayout, generateFlowPaths, generateLabels, generateNodeRects } from '@sovarto/sankey'

const layout = computeSankeyLayout(
  [
    { source: 'Income', target: 'Budget', value: 300 },
    { source: 'Budget', target: 'Rent', value: 200 },
    { source: 'Budget', target: 'Food', value: 100 },
  ],
  { width: 800, height: 400, flowColorMode: 'source', labels: { showValues: true } },
)

const paths = generateFlowPaths(layout) // [{ d, color, opacity, flow, ... }] → <path d=… />
const rects = generateNodeRects(layout) // [{ x, y, width, height, color, ... }] → <rect … />
const labels = generateLabels(layout) // positions and text pieces → <text>/<tspan>
```

## Label collisions

Labels have a full and a compact form. Measure both in the browser, for example with `SVGTextElement.getBBox()` padded by `padLabelBox`, then let `resolveLabelCollisions` decide which labels to show compact. Labels with higher values keep their full form.

```ts
import { padLabelBox, resolveLabelCollisions } from '@sovarto/sankey'

const { compact, suggestedHeightIncrease } = resolveLabelCollisions(labels, measurements)
```

## Development

```sh
npm install
npm test
npm run build
```

## License

MIT. Parts are derived from SankeyMATIC (ISC) and d3-sankey (BSD-3-Clause); their notices are included in [LICENSE](./LICENSE).
