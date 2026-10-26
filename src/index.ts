/**
 * @sovarto/sankey
 *
 * Framework-independent Sankey diagram engine: layout, SVG geometry and label
 * collision handling. Follows SankeyMATIC's visual style and layout algorithms.
 *
 * @example
 * ```ts
 * import { computeSankeyLayout, generateFlowPaths, generateNodeRects, generateLabels } from '@sovarto/sankey';
 *
 * const layout = computeSankeyLayout(
 *     [
 *         { source: 'Income', target: 'Rent', value: 1200 },
 *         { source: 'Income', target: 'Food', value: 400 },
 *     ],
 *     { width: 900, height: 500, flowColorMode: 'source' },
 * );
 * const paths = generateFlowPaths(layout); // SVG path data per flow
 * const rects = generateNodeRects(layout); // node rectangles
 * const labels = generateLabels(layout); // label positions and text pieces
 * ```
 */

export type {
    SankeyFlow,
    SankeyNodeConfig,
    SankeyConfig,
    SankeyMargin,
    InternalNode,
    InternalFlow,
    LabelPiece,
    NodeLabel,
    SankeyDiagramData,
    ResolvedSankeyConfig,
    Direction,
    PaintDirection,
} from './types.ts';

export { DEFAULT_CONFIG, FONT_METRICS, HIGHLIGHT_STYLES, IN, OUT, BEFORE, AFTER } from './types.ts';

export { computeSankeyLayout } from './layout.ts';

export {
    generateFlowPaths,
    generateNodeRects,
    generateLabels,
    getLabelHighlightColor,
    generateFlowGradients,
    getFlowTooltipPosition,
    getNodeTooltipPosition,
    formatTooltipValue,
    type FlowPath,
    type NodeRect,
    type LabelElement,
} from './renderer.ts';

export {
    boxesOverlap,
    padLabelBox,
    resolveLabelCollisions,
    type LabelBBox,
    type LabelMeasurement,
    type LabelCollisionResult,
} from './labels.ts';
