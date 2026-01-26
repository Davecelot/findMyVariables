export interface VariableUsage {
    nodeId: string
    nodeName: string
    property: string // e.g., 'fill', 'stroke', 'fontName', 'characters'
    variableId: string
}

export async function collectVariables(
    node: SceneNode,
    options: { includeDescendants: boolean; includeTextSegments: boolean }
): Promise<VariableUsage[]> {
    const variables: VariableUsage[] = []

    // Helper to push variable if exists
    const addVar = (prop: string, variableId: string | undefined) => {
        if (variableId) {
            variables.push({
                nodeId: node.id,
                nodeName: node.name,
                property: prop,
                variableId,
            })
        }
    }

    // 1. Check direct bound variables (dimensions, layout, etc.)
    if ('boundVariables' in node && node.boundVariables) {
        const bv = node.boundVariables
        // Common properties
        addVar('width', bv.width?.id)
        addVar('height', bv.height?.id)
        addVar('itemSpacing', bv.itemSpacing?.id)
        addVar('paddingLeft', bv.paddingLeft?.id)
        addVar('paddingRight', bv.paddingRight?.id)
        addVar('paddingTop', bv.paddingTop?.id)
        addVar('paddingBottom', bv.paddingBottom?.id)
        addVar('topLeftRadius', bv.topLeftRadius?.id)
        // Add others as needed
    }

    // 2. Check Fills
    if ('fills' in node && Array.isArray(node.fills)) {
        // Fills can be mixed, but boundVariables usually on the property itself?
        // Actually, fill colors are inside the boundVariables object under 'fills'?
        // Wait, node.boundVariables['fills'] returns an array of bindings.
        if ('boundVariables' in node && node.boundVariables && node.boundVariables['fills']) {
            const fillsBindings = node.boundVariables['fills'] as VariableAlias[]
            fillsBindings.forEach((alias, index) => {
                addVar(`fill[${index}]`, alias.id)
            })
        }
    }

    // 3. Check Strokes
    if ('strokes' in node && Array.isArray(node.strokes)) {
        if ('boundVariables' in node && node.boundVariables && node.boundVariables['strokes']) {
            const strokesBindings = node.boundVariables['strokes'] as VariableAlias[]
            strokesBindings.forEach((alias, index) => {
                addVar(`stroke[${index}]`, alias.id)
            })
        }
    }

    // 4. Check Text segments
    if (node.type === 'TEXT' && options.includeTextSegments) {
        // Check if mixed
        if (node.fills === figma.mixed || node.fontName === figma.mixed || node.fontSize === figma.mixed) {
            const segments = node.getStyledTextSegments(['boundVariables', 'fills', 'fontName', 'fontSize'])
            segments.forEach((seg, i) => {
                if (seg.boundVariables) {
                    // Check seg bound vars
                    const bv = seg.boundVariables as any
                    addVar(`textSeg[${i}].fontFamily`, bv['fontFamily']?.id)
                    addVar(`textSeg[${i}].fontSize`, bv['fontSize']?.id)

                    if (bv['fills']) {
                        const fillSetup = bv['fills'] as VariableAlias[]
                        fillSetup.forEach((a, fi) => addVar(`textSeg[${i}].fill[${fi}]`, a.id))
                    }
                }
            })
        } else {
            // Not mixed, check direct node.boundVariables above (partially covered)
            // But need to ensure coverage for text props if not mixed
            if ('boundVariables' in node && node.boundVariables) {
                const bv = node.boundVariables as any
                addVar('fontFamily', bv['fontFamily']?.id)
                addVar('fontSize', bv['fontSize']?.id)
                addVar('fontWeight', bv['fontWeight']?.id)
            }
        }
    }

    // 5. Recursion
    if (options.includeDescendants && 'children' in node) {
        for (const child of node.children) {
            const childVars = await collectVariables(child, options)
            variables.push(...childVars)
        }
    }

    return variables
}
