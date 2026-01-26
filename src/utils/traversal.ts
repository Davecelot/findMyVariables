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

export interface StyleVariableUsage {
    styleId: string
    styleName: string
    styleType: 'FILL' | 'STROKE' | 'TEXT' | 'EFFECT' | 'GRID'
    property: string
    variableId: string
}

export async function collectStyleVariables(node: SceneNode): Promise<StyleVariableUsage[]> {
    const styleVariables: StyleVariableUsage[] = []
    const checkedStyles = new Set<string>()

    const checkStyle = async (styleId: string, type: 'FILL' | 'STROKE' | 'TEXT' | 'EFFECT' | 'GRID') => {
        if (typeof styleId !== 'string' || !styleId || checkedStyles.has(styleId)) return
        checkedStyles.add(styleId)

        try {
            const style = figma.getStyleById(styleId)
            if (!style) return

            // Check style.boundVariables if exists
            // As of recent API, styles handle boundVariables in specific ways or on consumers. 
            // However, the requirement states: "Styles that consume variables should expose a boundVariables object similar to nodes."
            // Let's inspect the style object properties.

            // NOTE: The Figma API for Style objects might not directly expose boundVariables in all typings yet, 
            // but we can try to access it safely or check specific properties like `paints` for variables.

            // For PaintStyle
            if (type === 'FILL' || type === 'STROKE') {
                const paintStyle = style as PaintStyle
                // Check paints for bound variables if they are solid colors bound to vars?
                // Actually, paintStyle.paints is ReadonlyArray<Paint>. 
                // Variables are usually bound via boundVariables on the *node*, BUT inside a style definition, 
                // the style itself can be effectively a "consumer" of variables if it's a "local style" that aliases a variable.
                // But typically, a Variable is used INSTEAD of a Style, or a Style IS a Variable alias? 
                // No, you can have a Style that *is* a specific color, and that color *is* a variable.
                // In that case, `paintStyle.paints[0]` might have a bound variable?

                // Let's use `boundVariables` checking if it exists on the style object (it should in newer API)
                if ('boundVariables' in paintStyle && paintStyle.boundVariables) {
                    const bv = paintStyle.boundVariables
                    // paints?
                    if (bv['paints']) {
                        const paintsBindings = bv['paints'] as VariableAlias[]
                        paintsBindings.forEach((alias, i) => {
                            styleVariables.push({
                                styleId: style.id,
                                styleName: style.name,
                                styleType: type,
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
                    const bv = textStyle.boundVariables
                    if (bv['fontFamily']) {
                        styleVariables.push({ styleId: style.id, styleName: style.name, styleType: type, property: 'fontFamily', variableId: bv['fontFamily'].id })
                    }
                    if (bv['fontSize']) {
                        styleVariables.push({ styleId: style.id, styleName: style.name, styleType: type, property: 'fontSize', variableId: bv['fontSize'].id })
                    }
                    if (bv['fontWeight']) {
                        styleVariables.push({ styleId: style.id, styleName: style.name, styleType: type, property: 'fontWeight', variableId: bv['fontWeight'].id })
                    }
                    if (bv['lineHeight']) {
                        styleVariables.push({ styleId: style.id, styleName: style.name, styleType: type, property: 'lineHeight', variableId: bv['lineHeight'].id })
                    }
                    if (bv['letterSpacing']) {
                        styleVariables.push({ styleId: style.id, styleName: style.name, styleType: type, property: 'letterSpacing', variableId: bv['letterSpacing'].id })
                    }
                    if (bv['paragraphSpacing']) {
                        styleVariables.push({ styleId: style.id, styleName: style.name, styleType: type, property: 'paragraphSpacing', variableId: bv['paragraphSpacing'].id })
                    }
                }
            }

            // For EffectStyle
            if (type === 'EFFECT') {
                const effectStyle = style as EffectStyle
                if ('boundVariables' in effectStyle && effectStyle.boundVariables) {
                    // Check effects array binding?
                    const bv = effectStyle.boundVariables
                    if (bv['effects']) {
                        const effectsBindings = bv['effects'] as VariableAlias[]
                        effectsBindings.forEach((alias, i) => {
                            styleVariables.push({
                                styleId: style.id,
                                styleName: style.name,
                                styleType: type,
                                property: `effect[${i}]`,
                                variableId: alias.id
                            })
                        })
                    }
                }
            }

        } catch (e) {
            console.error(`Error checking style ${styleId}:`, e)
        }
    }

    // Check relevant properties on the node
    if ('fillStyleId' in node && node.fillStyleId) {
        if (typeof node.fillStyleId === 'string') {
            await checkStyle(node.fillStyleId, 'FILL')
        }
    }
    if ('strokeStyleId' in node && node.strokeStyleId) {
        if (typeof node.strokeStyleId === 'string') {
            await checkStyle(node.strokeStyleId, 'STROKE')
        }
    }
    if ('textStyleId' in node && node.textStyleId) {
        if (typeof node.textStyleId === 'string') {
            await checkStyle(node.textStyleId, 'TEXT')
        }
    }
    if ('effectStyleId' in node && node.effectStyleId) {
        if (typeof node.effectStyleId === 'string') {
            await checkStyle(node.effectStyleId, 'EFFECT')
        }
    }
    if ('gridStyleId' in node && node.gridStyleId) {
        if (typeof node.gridStyleId === 'string') {
            await checkStyle(node.gridStyleId, 'GRID')
        }
    }

    return styleVariables
}
