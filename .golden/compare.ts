import * as orig from './orig/layout.ts'
import * as origR from './orig/renderer.ts'
import * as pkg from '../src/index.ts'

const fixtures: Array<{ name: string; flows: any[]; config: any }> = [
  { name: 'simple', flows: [{ source: 'A', target: 'B', value: 100 }, { source: 'A', target: 'C', value: 50 }, { source: 'B', target: 'D', value: 80 }], config: { width: 800, height: 400 } },
  { name: 'budget', flows: [
    { source: 'Salary', target: 'Budget', value: 5200 }, { source: 'Rent income', target: 'Budget', value: 900 },
    { source: 'Budget', target: 'Housing', value: 1700 }, { source: 'Budget', target: 'Taxes', value: 1400 },
    { source: 'Budget', target: 'Food', value: 650 }, { source: 'Housing', target: 'Rent', value: 1450 }, { source: 'Housing', target: 'Energy', value: 250 },
    { source: 'Budget', target: 'Savings', value: 2350 }, { source: 'Food', target: 'Groceries', value: 500 }, { source: 'Food', target: 'Restaurants', value: 150 },
    { source: 'Salary', target: 'Savings', value: 100 } ], config: { width: 1000, height: 600, flowColorMode: 'outside-in', labels: { showValues: true }, colorScheme: 'dark' } },
  { name: 'exact-order', flows: [{ source: 'X', target: 'Y', value: 3 }, { source: 'Y', target: 'Z', value: 2 }, { source: 'X', target: 'Z', value: 1 }, { source: 'W', target: 'Y', value: 4, color: '#ff0000' }], config: { width: 600, height: 300, layoutOrder: 'exact', flowColorMode: 'target', justifyEnds: true, nodeBorder: 1 } },
  { name: 'defaults', flows: Array.from({ length: 12 }, (_, i) => ({ source: `S${i % 3}`, target: `T${i % 5}`, value: 10 + i * 7 })), config: {} },
]

let failures = 0
for (const fixture of fixtures) {
  const a = orig.computeSankeyLayout(structuredClone(fixture.flows), structuredClone(fixture.config))
  const b = pkg.computeSankeyLayout(structuredClone(fixture.flows), structuredClone(fixture.config))
  const seen = () => { const set = new WeakSet(); return (_k: string, v: any) => (typeof v === 'object' && v !== null ? (set.has(v) ? '[ref]' : (set.add(v), v)) : v) }
  const outputs = (r: any, d: any) => JSON.stringify({
    paths: r.generateFlowPaths(d), rects: r.generateNodeRects(d), labels: r.generateLabels(d), gradients: r.generateFlowGradients(d),
    size: [d.width, d.height], nodes: d.nodes.map((n: any) => [n.name, n.x, n.y, n.dx, n.dy, n.value, n.color, n.stage]),
  }, seen())
  const same = outputs(origR, a) === outputs(pkg, b)
  if (!same) failures += 1
  console.log(`${same ? 'IDENTICAL' : 'DIFFERENT'}  ${fixture.name} (${a.nodes.length} nodes, ${a.flows.length} flows)`)
}
process.exit(failures ? 1 : 0)
