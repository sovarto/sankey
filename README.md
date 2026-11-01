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

## Using it with React

The engine returns plain geometry; rendering it is a few lines of SVG. Labels have a full form (name and value) and a compact one (name only): the component renders both invisibly, measures them, and shows the labels that would overlap others in their compact form.

```tsx
import { useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
import {
  computeSankeyLayout,
  generateFlowPaths,
  generateLabels,
  generateNodeRects,
  padLabelBox,
  resolveLabelCollisions,
  type LabelElement,
  type LabelMeasurement,
  type SankeyConfig,
  type SankeyFlow,
} from '@sovarto/sankey'

interface SankeyProps {
  /** Keep `flows` and `config` stable (state or useMemo): a new object lays the diagram out again. */
  flows: SankeyFlow[]
  config: SankeyConfig
  onNodeClick?: (node: string) => void
  onFlowClick?: (source: string, target: string) => void
}

export function Sankey({ flows, config, onNodeClick, onFlowClick }: SankeyProps) {
  const layout = useMemo(() => computeSankeyLayout(flows, config), [flows, config])
  const paths = useMemo(() => generateFlowPaths(layout), [layout])
  const rects = useMemo(() => generateNodeRects(layout), [layout])
  const labels = useMemo(() => generateLabels(layout), [layout])

  // Both forms of every label are measured once the SVG is in the page, before it is painted.
  const fullTexts = useRef<Array<SVGTextElement | null>>([])
  const compactTexts = useRef<Array<SVGTextElement | null>>([])
  const [compact, setCompact] = useState<ReadonlySet<number>>(new Set())
  useLayoutEffect(() => {
    const measurements = new Map<number, LabelMeasurement>()
    labels.forEach((label, index) => {
      const full = fullTexts.current[index]
      const short = compactTexts.current[index]
      const size = label.pieces[0]?.size ?? 12
      if (full && short) measurements.set(index, { full: padLabelBox(full.getBBox(), size), compact: padLabelBox(short.getBBox(), size) })
    })
    setCompact(resolveLabelCollisions(labels, measurements).compact)
  }, [labels])

  return (
    <svg width={layout.width} height={layout.height}>
      <g transform={`translate(${layout.margin.left},${layout.margin.top})`}>
        {paths.map((path) => (
          <path
            key={path.flow.index}
            d={path.d}
            fill="none"
            stroke={path.color}
            strokeOpacity={path.opacity}
            strokeWidth={path.strokeWidth}
            onClick={() => onFlowClick?.(path.flow.source.name, path.flow.target.name)}
          />
        ))}
        {rects.map((rect) => (
          <rect
            key={rect.internalName}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={rect.color}
            fillOpacity={rect.opacity}
            onClick={() => onNodeClick?.(rect.internalName)}
          >
            <title>{`${rect.name}: ${rect.value}`}</title>
          </rect>
        ))}
        {labels.map((label, index) => (
          <g key={label.nodeName} opacity={label.opacity}>
            <LabelText label={label} pieces={compact.has(index) ? label.compactPieces : label.pieces} />
            <LabelText label={label} pieces={label.pieces} hidden textRef={(element) => { fullTexts.current[index] = element }} />
            <LabelText label={label} pieces={label.compactPieces} hidden textRef={(element) => { compactTexts.current[index] = element }} />
          </g>
        ))}
      </g>
    </svg>
  )
}

/** A label's text pieces as lines centred on its position (a piece with newLine starts a line). */
function LabelText(props: { label: LabelElement; pieces: LabelElement['pieces']; hidden?: boolean; textRef?: Ref<SVGTextElement> }) {
  const { label, pieces, hidden, textRef } = props
  const lineHeight = (pieces[0]?.size ?? 12) * 1.4
  const lines = pieces.filter((piece) => piece.newLine).length + 1
  return (
    <text
      ref={textRef}
      x={label.x}
      y={label.y}
      textAnchor={label.anchor}
      dominantBaseline="central"
      visibility={hidden ? 'hidden' : undefined}
      pointerEvents={hidden ? 'none' : undefined}
    >
      {pieces.map((piece, index) => (
        <tspan
          key={index}
          x={index === 0 || piece.newLine ? label.x : undefined}
          dy={index === 0 ? lineHeight / 2 - (lines * lineHeight) / 2 : piece.newLine ? lineHeight : 0}
          fontSize={piece.size}
          fontWeight={piece.weight}
        >
          {piece.text}
        </tspan>
      ))}
    </text>
  )
}
```

```tsx
const flows = [
  { source: 'Income', target: 'Budget', value: 300 },
  { source: 'Budget', target: 'Rent', value: 200 },
  { source: 'Budget', target: 'Food', value: 100 },
]
const config = { width: 800, height: 400, margin: { left: 100, right: 100 }, labels: { showValues: true } }

<Sankey flows={flows} config={config} onNodeClick={(node) => console.log(node)} />
```

The labels of the first and last column are placed outside their nodes, so leave room for them with `margin.left` and `margin.right` (the defaults are only 12 px).

When many labels end up compact, `resolveLabelCollisions` also returns `suggestedHeightIncrease`: lay the diagram out again with that much more height until no label has to be compacted, if the page has the room.

## Crossing reduction

With `reduceCrossings: true` (automatic layout order only), the engine reorders nodes within their stages after the usual relaxation so fewer flows cross. It runs barycenter sweeps and swaps neighbouring nodes, weighting each crossing by the product of the two flows' values, so a thick band is kept away from other thick bands first. Flows that skip stages take part via their path through the intermediate stages. The new order is kept only if it crosses strictly less. The layout is then relaxed again with that order fixed.

```ts
computeSankeyLayout(flows, { width: 800, height: 400, reduceCrossings: true })
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

## Releasing

Raise `version` in `package.json` and push to `main`. The workflow (`.github/workflows/publish.yml`) type-checks, tests and builds every push and pull request, and publishes to npm with provenance when that version is not on npm yet. It publishes via npm trusted publishing: on npmjs.com, under the package's settings, add GitHub Actions as trusted publisher with this repository and the workflow `publish.yml`. Without that, an npm automation token in the repository secret `NPM_TOKEN` works too.

## License

MIT. Parts are derived from SankeyMATIC (ISC) and d3-sankey (BSD-3-Clause); their notices are included in [LICENSE](./LICENSE).
