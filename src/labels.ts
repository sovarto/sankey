/**
 * Label collision handling, independent of any UI framework.
 *
 * Labels are measured by the host (e.g. with SVGTextElement.getBBox()), then
 * resolveLabelCollisions decides which labels must use their compact form.
 */

import type { LabelElement } from './renderer.ts';

/** Bounding box with padding for collision detection */
export interface LabelBBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Measured boxes of a label in its full and compact form */
export interface LabelMeasurement {
    full: LabelBBox;
    compact: LabelBBox;
}

/** Check if two bounding boxes overlap */
export function boxesOverlap(a: LabelBBox, b: LabelBBox, padding = 2): boolean {
    return !(a.x + a.width + padding < b.x
        || b.x + b.width + padding < a.x
        || a.y + a.height + padding < b.y
        || b.y + b.height + padding < a.y);
}

/** Pads a measured text box the way label highlights are drawn (0.4 em horizontally, 0.3 em vertically). */
export function padLabelBox(box: LabelBBox, fontSize = 12): LabelBBox {
    const padding = { x: fontSize * 0.4, y: fontSize * 0.3 };
    return {
        x: box.x - padding.x,
        y: box.y - padding.y,
        width: box.width + padding.x * 2,
        height: box.height + padding.y * 2,
    };
}

export interface LabelCollisionResult {
    /** Indices of labels that should be shown in compact form */
    compact: Set<number>;
    /** Suggested height increase so that labels fit (0 when no label had to be compacted) */
    suggestedHeightIncrease: number;
}

/**
 * Greedy collision resolution: labels with higher values keep their full form;
 * a label colliding with an already placed label is shown compact.
 */
export function resolveLabelCollisions(
    labels: Pick<LabelElement, 'value'>[],
    measurements: ReadonlyMap<number, LabelMeasurement>,
): LabelCollisionResult {
    const needsCompact = new Set<number>();
    // Prioritize keeping labels with higher values as full labels
    const sortedIndices = [ ...measurements.keys() ].sort((a, b) => labels[b]!.value - labels[a]!.value);
    const placedBoxes: LabelBBox[] = [];

    for (const idx of sortedIndices) {
        const { full, compact } = measurements.get(idx)!;
        if (placedBoxes.some(placed => boxesOverlap(full, placed))) {
            // Even when the compact form still collides it is smaller, so use it.
            needsCompact.add(idx);
            placedBoxes.push(compact);
        } else {
            placedBoxes.push(full);
        }
    }

    // Small fixed increment to avoid overshooting; hosts iterate until no collisions remain.
    return { compact: needsCompact, suggestedHeightIncrease: needsCompact.size > 0 ? 30 : 0 };
}
