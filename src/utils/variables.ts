export interface ResolvedVariable {
    id: string
    name: string
    key: string
    resolvedType: VariableResolvedDataType
    valuesByMode: { [modeId: string]: string | number | boolean | RGB | RGBA | VariableAlias }
    collectionId: string
    collectionName: string
    remote: boolean
    description: string
    scopes: VariableScope[]
    // For the specific consumer context
    resolvedValue: any
    aliasChain: { name: string; id: string }[]
}

export async function resolveVariable(variableId: string, consumerNode: SceneNode): Promise<ResolvedVariable | null> {
    try {
        const variable = await figma.variables.getVariableByIdAsync(variableId)
        if (!variable) return null

        const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId)

        // Resolve value for the consumer node
        // Note: resolveForConsumer might be available on the variable object in recent APIs
        // If not, we use a fallback or specific mode logic. 
        // Usually we want the value for the *current* mode of the variable's collection on the node's context.

        // Attempt to interpret resolved value
        // Since we don't have easy access to the exact mode active on the node without deep traversal of modes,
        // we will try to resolve strictly if the API supports it, or return the default mode value.

        // Simulating alias chain resolution
        const aliasChain: { name: string; id: string }[] = []
        let currentVar = variable
        let resolvedValue: any = null

        // Helper to find value in a specific mode if we knew it. 
        // For now, let's just pick the first mode or default.
        // In a real plugin, we would look up `node.resolvedVariableModes` via `figma.variables.getVariableModeForNode(node, collectionId)`.
        // Wait, figma.variables.getVariableModeForNode is not a standard API? 
        // It's `node.resolvedVariableModes`.

        const modes = consumerNode.resolvedVariableModes || {}
        const modeId = modes[collection?.id || ''] || collection?.defaultModeId

        if (modeId && currentVar.valuesByMode[modeId]) {
            resolvedValue = currentVar.valuesByMode[modeId]
        } else {
            // Fallback to first mode
            const firstModeId = collection?.modes[0].modeId
            resolvedValue = currentVar.valuesByMode[firstModeId || '']
        }

        // Trace alias if resolvedValue is an alias
        aliasChain.push({ name: currentVar.name, id: currentVar.id })

        // Simple loop to follow aliases (max depth 10)
        let depth = 0
        while (resolvedValue && (resolvedValue as any).type === 'VARIABLE_ALIAS' && depth < 10) {
            const aliasId = (resolvedValue as VariableAlias).id
            const nextVar = await figma.variables.getVariableByIdAsync(aliasId)
            if (!nextVar) break

            aliasChain.push({ name: nextVar.name, id: nextVar.id })

            // Resolve next value
            const nextCollection = await figma.variables.getVariableCollectionByIdAsync(nextVar.variableCollectionId)
            const nextModeId = modes[nextCollection?.id || ''] || nextCollection?.defaultModeId // Mixed modes across collections?
            // Simplification: use default if not explicit

            const val = nextVar.valuesByMode[nextModeId || nextCollection?.modes[0].modeId || '']
            resolvedValue = val
            depth++
        }

        return {
            id: variable.id,
            name: variable.name,
            key: variable.key,
            resolvedType: variable.resolvedType,
            valuesByMode: variable.valuesByMode,
            collectionId: collection?.id || '',
            collectionName: collection?.name || 'Unknown',
            remote: variable.remote,
            description: variable.description,
            scopes: variable.scopes,
            resolvedValue,
            aliasChain
        }

    } catch (error) {
        console.error('Error resolving variable:', error)
        return null
    }
}
