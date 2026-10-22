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

    // 1. Check direct bound variables - iterate over ALL keys to catch everything
    if ('boundVariables' in node && node.boundVariables) {
        const bv = node.boundVariables as Record<string, VariableAlias | VariableAlias[] | undefined>
        
        // Log all keys for debugging
        const bvKeys = Object.keys(bv)
        if (bvKeys.length > 0) {
            console.log('🔍 Node has boundVariables:', node.name, bvKeys)
        }

        // Iterate over ALL bound variable keys dynamically
        for (const key of bvKeys) {
            const binding = bv[key]
            if (!binding) continue

            // Check if it's an array (like fills, strokes, effects) or a single binding
            if (Array.isArray(binding)) {
                (binding as VariableAlias[]).forEach((alias, i) => {
                    if (alias && alias.id) {
                        addVar(`${key}[${i}]`, alias.id)
                    }
                })
            } else if (typeof binding === 'object' && 'id' in binding) {
                addVar(key, (binding as VariableAlias).id)
            }
        }
    }

    // 2. Check Text segments/props
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

export async function collectStyleVariables(node: SceneNode, options: { includeDescendants: boolean; includeStylesWithoutVariables?: boolean }): Promise<StyleUsage[]> {
    const stylesMap = new Map<string, StyleUsage>()
    const includeStylesWithoutVars = options.includeStylesWithoutVariables ?? false

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

            // Only add if it has variables OR if includeStylesWithoutVariables is true
            if (usage.variables.length > 0 || includeStylesWithoutVars) {
                stylesMap.set(styleId, usage)
            }

        } catch (e) {
            console.error('Error checking style:', styleId, e)
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
