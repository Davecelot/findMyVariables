import { once, showUI, on } from '@create-figma-plugin/utilities'

import { CreateCardHandler, CloseHandler } from './types'
import { collectVariables, collectStyleVariables, VariableUsage, StyleUsage } from './utils/traversal'
import { resolveVariable, ResolvedVariable } from './utils/variables'
import { drawCard, CardData, StyleGroup } from './utils/card'

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

      let styleUsages: StyleUsage[] = []
      if (options.includeStyleVariables) {
        console.log('🔍 Collecting style variables...')
        styleUsages = await collectStyleVariables(target, options)
        console.log('✅ Styles found:', styleUsages.length)
      }

      // 2. Resolve
      // Collect all unique variable IDs
      const directIds = usages.map(u => u.variableId)
      const styleIds = styleUsages.flatMap(s => s.variables.map(v => v.variableId))
      const uniqueIds = Array.from(new Set([...directIds, ...styleIds]))

      // Resolve in parallel
      const resolutionResults = await Promise.all(
        uniqueIds.map(async (id) => {
          const resolved = await resolveVariable(id, target)
          return { id, resolved }
        })
      )

      const varCache = new Map<string, ResolvedVariable | null>()
      resolutionResults.forEach(r => varCache.set(r.id, r.resolved))

      // Direct Variables
      const resolvedVars: (ResolvedVariable & { property: string })[] = []
      for (const usage of usages) {
        const resolved = varCache.get(usage.variableId)
        if (resolved) {
          resolvedVars.push({ ...resolved, property: usage.property })
        }
      }

      // Grouped Style Variables
      const resolvedStyles: StyleGroup[] = []
      for (const sUsage of styleUsages) {
        const styleGroup: StyleGroup = {
          styleId: sUsage.styleId,
          styleName: sUsage.styleName,
          styleType: sUsage.styleType,
          description: sUsage.description,
          variables: []
        }

        for (const vUsage of sUsage.variables) {
          const resolved = varCache.get(vUsage.variableId)
          if (resolved) {
            styleGroup.variables.push({
              ...resolved,
              property: vUsage.property
            })
          }
        }
        resolvedStyles.push(styleGroup)
      }

      // 3. Draw
      const cardData: CardData = {
        targetName: target.name,
        variables: resolvedVars,
        styles: resolvedStyles
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
    height: 540,
    width: 340
  })
}
