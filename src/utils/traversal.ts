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

    // 4. Check Text segments/props
    if (node.type === 'TEXT') {
        const bv = (node as any).boundVariables || {}

        // Add character variable if exists
        addVar('characters', bv['characters']?.id)

        const mixedProps: (keyof TextNode)[] = ['fills', 'fontName', 'fontSize', 'lineHeight', 'letterSpacing', 'textCase', 'textDecoration']
        const isMixed = mixedProps.some(p => (node as any)[p] === figma.mixed)

        if (isMixed) {
            if (options.includeTextSegments) {
                const segments = node.getStyledTextSegments(['boundVariables', 'fills', 'fontName', 'fontSize', 'lineHeight', 'letterSpacing', 'textCase', 'textDecoration'])
                segments.forEach((seg, i) => {
                    if (seg.boundVariables) {
                        const sbv = seg.boundVariables as any
                        addVar(`textSeg[${i}].fontFamily`, sbv['fontFamily']?.id)
                        addVar(`textSeg[${i}].fontSize`, sbv['fontSize']?.id)
                        addVar(`textSeg[${i}].fontWeight`, sbv['fontWeight']?.id)
                        addVar(`textSeg[${i}].fontStyle`, sbv['fontStyle']?.id)
                        addVar(`textSeg[${i}].lineHeight`, sbv['lineHeight']?.id)
                        addVar(`textSeg[${i}].letterSpacing`, sbv['letterSpacing']?.id)
                        addVar(`textSeg[${i}].textCase`, sbv['textCase']?.id)
                        addVar(`textSeg[${i}].textDecoration`, sbv['textDecoration']?.id)

                        if (sbv['fills']) {
                            const fillSetup = sbv['fills'] as VariableAlias[]
                            fillSetup.forEach((a, fi) => addVar(`textSeg[${i}].fill[${fi}]`, a.id))
                        }
                    }
                })
            }
        } else {
            // Not mixed - always check these if it's a Text node
            addVar('fontFamily', bv['fontFamily']?.id)
            addVar('fontSize', bv['fontSize']?.id)
            addVar('fontWeight', bv['fontWeight']?.id)
            addVar('fontStyle', bv['fontStyle']?.id)
            addVar('lineHeight', bv['lineHeight']?.id)
            addVar('letterSpacing', bv['letterSpacing']?.id)
            addVar('paragraphSpacing', bv['paragraphSpacing']?.id)
            addVar('paragraphIndent', bv['paragraphIndent']?.id)
            addVar('textCase', bv['textCase']?.id)
            addVar('textDecoration', bv['textDecoration']?.id)
        }
    }

    // 5. Check other common properties
    if ('cornerRadius' in node && node.cornerRadius !== figma.mixed) {
        addVar('cornerRadius', (node.boundVariables as any)?.cornerRadius?.id)
    }
    if ('strokeWeight' in node) {
        addVar('strokeWeight', (node.boundVariables as any)?.strokeWeight?.id)
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

export interface StyleUsage {
    styleId: string
    styleName: string
    styleType: 'FILL' | 'STROKE' | 'TEXT' | 'EFFECT' | 'GRID'
    description?: string
    variables: {
        property: string
        variableId: string
    }[]
}

export async function collectStyleVariables(node: SceneNode, options: { includeDescendants: boolean }): Promise<StyleUsage[]> {
    const stylesMap = new Map<string, StyleUsage>()

    const checkStyle = async (styleId: string, type: 'FILL' | 'STROKE' | 'TEXT' | 'EFFECT' | 'GRID') => {
        if (typeof styleId !== 'string' || !styleId || stylesMap.has(styleId)) return

        try {
            const style = figma.getStyleById(styleId)
            if (!style) return

            const usage: StyleUsage = {
                styleId: style.id,
                styleName: style.name,
                styleType: type,
                description: style.description,
                variables: []
            }

            // For PaintStyle
            if (type === 'FILL' || type === 'STROKE') {
                const paintStyle = style as PaintStyle
                if ('boundVariables' in paintStyle && paintStyle.boundVariables) {
                    const bv = paintStyle.boundVariables
                    if (bv['paints']) {
                        const paintsBindings = bv['paints'] as VariableAlias[]
                        paintsBindings.forEach((alias, i) => {
                            usage.variables.push({
                                property: `paint[${i}]`,
                                variableId: alias.id
                            })
                        })
                    }
                }
            }

            // For TextStyle
            if (type === 'TEXT') {
                const textStyle = style as TextStyle
                if ('boundVariables' in textStyle && textStyle.boundVariables) {
                    const bv = textStyle.boundVariables as any
                    if (bv['fontFamily']) usage.variables.push({ property: 'fontFamily', variableId: bv['fontFamily'].id })
                    if (bv['fontSize']) usage.variables.push({ property: 'fontSize', variableId: bv['fontSize'].id })
                    if (bv['fontWeight']) usage.variables.push({ property: 'fontWeight', variableId: bv['fontWeight'].id })
                    if (bv['fontStyle']) usage.variables.push({ property: 'fontStyle', variableId: bv['fontStyle'].id })
                    if (bv['lineHeight']) usage.variables.push({ property: 'lineHeight', variableId: bv['lineHeight'].id })
                    if (bv['letterSpacing']) usage.variables.push({ property: 'letterSpacing', variableId: bv['letterSpacing'].id })
                    if (bv['paragraphSpacing']) usage.variables.push({ property: 'paragraphSpacing', variableId: bv['paragraphSpacing'].id })
                    if (bv['paragraphIndent']) usage.variables.push({ property: 'paragraphIndent', variableId: bv['paragraphIndent'].id })
                    if (bv['textCase']) usage.variables.push({ property: 'textCase', variableId: bv['textCase'].id })
                    if (bv['textDecoration']) usage.variables.push({ property: 'textDecoration', variableId: bv['textDecoration'].id })
                }
            }

            // For EffectStyle
            if (type === 'EFFECT') {
                const effectStyle = style as EffectStyle
                if ('boundVariables' in effectStyle && effectStyle.boundVariables) {
                    const bv = effectStyle.boundVariables
                    if (bv['effects']) {
                        const effectsBindings = bv['effects'] as VariableAlias[]
                        effectsBindings.forEach((alias, i) => {
                            usage.variables.push({
                                property: `effect[${i}]`,
                                variableId: alias.id
                            })
                        })
                    }
                }
            }

            // Only add if it has variables (or if we want to show all styles, but let's stick to variables for now)
            // Actually, the user wants "a table for every style too", so let's include it if it's there
            stylesMap.set(styleId, usage)

        } catch (e) {
            console.error(`Error checking style ${styleId}:`, e)
        }
    }

    const traverse = async (curr: SceneNode) => {
        // Use a generic property check to catch all possible styles
        const styleProps = [
            { key: 'fillStyleId', type: 'FILL' as const },
            { key: 'strokeStyleId', type: 'STROKE' as const },
            { key: 'textStyleId', type: 'TEXT' as const },
            { key: 'effectStyleId', type: 'EFFECT' as const },
            { key: 'gridStyleId', type: 'GRID' as const }
        ]

        for (const { key, type } of styleProps) {
            if (key in curr) {
                const sid = (curr as any)[key]
                if (sid === figma.mixed && curr.type === 'TEXT') {
                    const segments = curr.getStyledTextSegments([key as any])
                    for (const seg of segments) {
                        const segSid = (seg as any)[key]
                        if (typeof segSid === 'string' && segSid) {
                            await checkStyle(segSid, type)
                        }
                    }
                } else if (typeof sid === 'string' && sid) {
                    await checkStyle(sid, type)
                }
            }
        }

        // Search in children
        if (options.includeDescendants && 'children' in curr) {
            for (const child of curr.children) {
                await traverse(child)
            }
        }
    }

    await traverse(node)
    return Array.from(stylesMap.values())
}
