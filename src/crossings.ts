/**
 * Crossing reduction
 *
 * Reorders nodes within their stages so that fewer flows cross each other, in the spirit of the
 * crossing minimisation step of layered graph drawing (Sugiyama et al.): barycenter sweeps plus
 * transposition of neighbouring nodes. A crossing of two bands is weighted by the product of their
 * values, so a thick band crossing another thick band counts far more than a hairline.
 *
 * Flows skipping stages take part through their shadow segments, which connect adjacent stages.
 */

import { IN, OUT } from './types.ts';
import type { Direction, InternalFlow, InternalNode } from './types.ts';

type Positions = Map<InternalNode, number>;

const MAX_SWEEPS = 12;
const MAX_TRANSPOSE_PASSES = 20;

/**
 * Reorders the nodes of each stage in place when that strictly reduces the weighted crossings.
 * Returns whether the order changed. Expects every stage sorted top to bottom.
 */
export function reduceStageCrossings(stages: InternalNode[][]): boolean {
    const segments = new Map<InternalNode, Record<Direction, InternalFlow[]>>();
    for (const stage of stages) {
        for (const node of stage) {
            segments.set(node, { [IN]: segmentsOf(node, IN), [OUT]: segmentsOf(node, OUT) });
        }
    }
    const positions: Positions = new Map();
    const order = stages.map(stage => stage.slice());
    order.forEach(stage => indexStage(stage, positions));

    const initial = totalCrossings(order, segments, positions);
    if (initial === 0) {
        return false;
    }

    let best = initial;
    let bestOrder = order.map(stage => stage.slice());
    const keepIfBetter = (): boolean => {
        transpose(order, segments, positions);
        const crossings = totalCrossings(order, segments, positions);
        if (crossings < best * (1 - 1e-9)) {
            best = crossings;
            bestOrder = order.map(stage => stage.slice());
            return true;
        }
        return false;
    };

    // Local swaps first: they find improvements closest to the relaxed layout.
    keepIfBetter();

    for (let sweep = 0; sweep < MAX_SWEEPS && best > 0; sweep++) {
        let improved = false;
        for (let s = 1; s < order.length; s++) {
            reorderByBarycenter(order[s], IN, segments, positions);
        }
        improved = keepIfBetter() || improved;
        for (let s = order.length - 2; s >= 0; s--) {
            reorderByBarycenter(order[s], OUT, segments, positions);
        }
        improved = keepIfBetter() || improved;
        if (!improved) {
            break;
        }
    }

    if (best >= initial) {
        return false;
    }
    stages.forEach((stage, s) => stage.splice(0, stage.length, ...bestOrder[s]));
    return true;
}

/** Flows drawn between this node and the adjacent stage on the given side. */
function segmentsOf(node: InternalNode, side: Direction): InternalFlow[] {
    return node.flows[side].filter(f => !f.hasAShadow && f.target.stage - f.source.stage === 1);
}

function otherEnd(flow: InternalFlow, side: Direction): InternalNode {
    return side === IN ? flow.source : flow.target;
}

/** Relative position (0..1) so stages with different node counts compare. */
function indexStage(stage: InternalNode[], positions: Positions): void {
    stage.forEach((node, i) => positions.set(node, (i + 0.5) / stage.length));
}

function totalCrossings(
    order: InternalNode[][],
    segments: Map<InternalNode, Record<Direction, InternalFlow[]>>,
    positions: Positions,
): number {
    let total = 0;
    for (const stage of order) {
        const flows = stage.flatMap(node => segments.get(node)![OUT]);
        for (let i = 0; i < flows.length; i++) {
            const a = flows[i];
            for (let j = i + 1; j < flows.length; j++) {
                const b = flows[j];
                if (a.source === b.source || a.target === b.target) {
                    continue;
                }
                const sourceOrder = positions.get(a.source)! - positions.get(b.source)!;
                const targetOrder = positions.get(a.target)! - positions.get(b.target)!;
                if (sourceOrder * targetOrder < 0) {
                    total += a.value * b.value;
                }
            }
        }
    }
    return total;
}

function reorderByBarycenter(
    stage: InternalNode[],
    side: Direction,
    segments: Map<InternalNode, Record<Direction, InternalFlow[]>>,
    positions: Positions,
): void {
    const keys = new Map<InternalNode, number>();
    for (const node of stage) {
        const flows = segments.get(node)![side];
        const weight = flows.reduce((sum, f) => sum + f.value, 0);
        keys.set(node, weight > 0
            ? flows.reduce((sum, f) => sum + positions.get(otherEnd(f, side))! * f.value, 0) / weight
            : positions.get(node)!);
    }
    stage.sort((a, b) => keys.get(a)! - keys.get(b)!);
    indexStage(stage, positions);
}

/** Weighted crossings between the flows of `upper` and `lower` when `upper` is placed above `lower`. */
function pairCrossings(
    upper: InternalNode,
    lower: InternalNode,
    segments: Map<InternalNode, Record<Direction, InternalFlow[]>>,
    positions: Positions,
): number {
    let crossings = 0;
    for (const side of [ IN, OUT ] as const) {
        for (const a of segments.get(upper)![side]) {
            const aEnd = otherEnd(a, side);
            for (const b of segments.get(lower)![side]) {
                const bEnd = otherEnd(b, side);
                if (aEnd !== bEnd && positions.get(aEnd)! > positions.get(bEnd)!) {
                    crossings += a.value * b.value;
                }
            }
        }
    }
    return crossings;
}

/** Swaps neighbouring nodes while that reduces crossings. */
function transpose(
    order: InternalNode[][],
    segments: Map<InternalNode, Record<Direction, InternalFlow[]>>,
    positions: Positions,
): void {
    for (let pass = 0; pass < MAX_TRANSPOSE_PASSES; pass++) {
        let swapped = false;
        for (const stage of order) {
            for (let i = 0; i + 1 < stage.length; i++) {
                const upper = stage[i];
                const lower = stage[i + 1];
                if (pairCrossings(lower, upper, segments, positions) < pairCrossings(upper, lower, segments, positions)) {
                    stage[i] = lower;
                    stage[i + 1] = upper;
                    const upperPosition = positions.get(upper)!;
                    positions.set(upper, positions.get(lower)!);
                    positions.set(lower, upperPosition);
                    swapped = true;
                }
            }
        }
        if (!swapped) {
            break;
        }
    }
}
