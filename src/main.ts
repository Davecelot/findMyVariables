import { once, showUI, on } from '@create-figma-plugin/utilities'

import { CreateCardHandler, CloseHandler } from './types'
import { collectVariables, VariableUsage } from './utils/traversal'
import { resolveVariable, ResolvedVariable } from './utils/variables'
import { drawCard, CardData } from './utils/card'

export default function () {
  on<CreateCardHandler>('CREATE_CARD', async function (options) {
    const selection = figma.currentPage.selection
    if (selection.length !== 1) {
      figma.notify('Please select exactly one element.')
      return
    }

    const target = selection[0]
    figma.notify('Inspecting variables...')

    try {
      // 1. Collect
      const usages = await collectVariables(target, options)

      if (usages.length === 0) {
        figma.notify('No bound variables found.')
        // We might still want to draw an empty card or just return
        // Let's draw an empty card for feedback
      }

      // 2. Resolve
      // Collect unique IDs first
      const uniqueIds = Array.from(new Set(usages.map(u => u.variableId)))

      // Resolve in parallel
      const resolutionResults = await Promise.all(
        uniqueIds.map(async (id) => {
          const resolved = await resolveVariable(id, target)
          return { id, resolved }
        })
      )

      const varCache = new Map<string, ResolvedVariable | null>()
      resolutionResults.forEach(r => varCache.set(r.id, r.resolved))

      const resolvedVars: (ResolvedVariable & { property: string })[] = []

      for (const usage of usages) {
        const resolved = varCache.get(usage.variableId)
        if (resolved) {
          resolvedVars.push({
            ...resolved,
            property: usage.property
          })
        }
      }

      // 3. Draw
      const cardData: CardData = {
        targetName: target.name,
        variables: resolvedVars
      }

      await drawCard(cardData, target)

      figma.notify('Variables card generated!')

    } catch (e: any) {
      console.error(e)
      figma.notify('Error generating card: ' + e.message)
    }
  })

  on<CloseHandler>('CLOSE', function () {
    figma.closePlugin()
  })

  showUI({
    height: 380,
    width: 340
  })
}
