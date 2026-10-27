import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
    computeSankeyLayout,
    generateFlowPaths,
    generateLabels,
    generateNodeRects,
    resolveLabelCollisions,
    type LabelMeasurement,
} from '../src/index.ts'

const flows = [
    { source: 'Income', target: 'Budget', value: 300 },
    { source: 'Budget', target: 'Rent', value: 200 },
    { source: 'Budget', target: 'Food', value: 100 },
]

describe('layout', () => {
    it('places nodes in stages with values that conserve the flows', () => {
        const layout = computeSankeyLayout(flows, { width: 800, height: 400 })
        const byName = new Map(layout.nodes.map(node => [ node.name, node ]))
        assert.deepEqual([ ...byName.keys() ].sort(), [ 'Budget', 'Food', 'Income', 'Rent' ])
        assert.equal(byName.get('Budget')!.value, 300)
        assert.ok(byName.get('Income')!.x < byName.get('Budget')!.x)
        assert.ok(byName.get('Budget')!.x < byName.get('Rent')!.x)
        assert.ok(byName.get('Rent')!.dy > byName.get('Food')!.dy)
    })

    it('produces SVG geometry for every flow, node and label', () => {
        const layout = computeSankeyLayout(flows, { width: 800, height: 400, labels: { showValues: true } })
        assert.equal(generateFlowPaths(layout).length, 3)
        assert.ok(generateFlowPaths(layout).every(path => path.d.startsWith('M')))
        assert.equal(generateNodeRects(layout).length, 4)
        assert.equal(generateLabels(layout).length, 4)
    })

    it('stacks a flow skipping stages with the other flows at its source and target', () => {
        // A → D skips two stages; C → D enters D above it although it is listed first.
        const layout = computeSankeyLayout([
            { source: 'C', target: 'D', value: 69 },
            { source: 'B', target: 'Y', value: 78 },
            { source: 'A', target: 'D', value: 43 },
            { source: 'B', target: 'C', value: 75 },
            { source: 'X', target: 'B', value: 32 },
            { source: 'A', target: 'B', value: 98 },
            { source: 'C', target: 'E', value: 17 },
        ], { width: 800, height: 400 })
        const disjoint = (spans: Array<[ number, number ]>) => {
            const sorted = spans.slice().sort((a, b) => a[0] - b[0])
            return sorted.every((span, i) => i === 0 || span[0] >= sorted[i - 1]![1] - 1e-9)
        }
        for (const node of layout.nodes) {
            const into = layout.flows.filter(flow => flow.target === node)
            const out = layout.flows.filter(flow => flow.source === node)
            assert.ok(disjoint(into.map(flow => [ flow.ty, flow.ty + flow.dy ])), `into ${node.name}: ${JSON.stringify(into.map(flow => [ flow.source.name, flow.ty, flow.dy ]))}`)
            assert.ok(disjoint(out.map(flow => [ flow.sy, flow.sy + flow.dy ])), `out of ${node.name}: ${JSON.stringify(out.map(flow => [ flow.target.name, flow.sy, flow.dy ]))}`)
        }
    })

    it('reorders nodes so fewer bands cross when reducing crossings', () => {
        // Relaxation stacks D above A and E below C, so E → A crosses C → D.
        const flows = [
            { source: 'A', target: 'B', value: 456 },
            { source: 'C', target: 'D', value: 8750 },
            { source: 'C', target: 'A', value: 14754 },
            { source: 'E', target: 'A', value: 1029 },
        ]
        const crossings = (reduceCrossings: boolean) => {
            const layout = computeSankeyLayout(flows, { width: 800, height: 400, reduceCrossings })
            const startY = (flow: typeof layout.flows[number]) => flow.source.y + flow.sy
            const endY = (flow: typeof layout.flows[number]) => flow.target.y + flow.ty
            return layout.flows.flatMap((a, i) => layout.flows.slice(i + 1)
                .filter(b => a.source !== b.source && a.target !== b.target && a.source.stage === b.source.stage && a.target.stage === b.target.stage)
                .filter(b => (startY(a) < startY(b)) !== (endY(a) < endY(b)))
                .map(b => `${a.source.name}→${a.target.name} × ${b.source.name}→${b.target.name}`))
        }
        assert.deepEqual(crossings(false), [ 'C→D × E→A' ])
        assert.deepEqual(crossings(true), [])
    })
})

describe('label collisions', () => {
    const box = (x: number, y: number, width = 50) => ({ x, y, width, height: 10 })

    it('keeps the label with the higher value full and compacts the one overlapping it', () => {
        const labels = [ { value: 10 }, { value: 500 }, { value: 40 } ]
        const measurements = new Map<number, LabelMeasurement>([
            [ 0, { full: box(0, 0), compact: box(0, 0, 20) } ],
            [ 1, { full: box(10, 2), compact: box(10, 2, 20) } ],
            [ 2, { full: box(0, 100), compact: box(0, 100, 20) } ],
        ])
        const result = resolveLabelCollisions(labels, measurements)
        assert.deepEqual([ ...result.compact ], [ 0 ])
        assert.equal(result.suggestedHeightIncrease, 30)
    })

    it('suggests no height increase when nothing collides', () => {
        const measurements = new Map<number, LabelMeasurement>([ [ 0, { full: box(0, 0), compact: box(0, 0) } ] ])
        assert.deepEqual(resolveLabelCollisions([ { value: 1 } ], measurements), { compact: new Set(), suggestedHeightIncrease: 0 })
    })
})
