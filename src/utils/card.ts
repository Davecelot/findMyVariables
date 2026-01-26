import { ResolvedVariable } from './variables'
import { VariableUsage } from './traversal'

export interface CardData {
    targetName: string
    variables: (ResolvedVariable & { property: string })[]
}

// Map property names to semantic groups
const PROPERTY_GROUPS: { [key: string]: string } = {
    // Colors
    'fills': 'Colors',
    'strokes': 'Colors',
    'fill': 'Colors',
    'stroke': 'Colors',
    // Typography
    'fontName': 'Typography',
    'fontSize': 'Typography',
    'lineHeight': 'Typography',
    'letterSpacing': 'Typography',
    'textCase': 'Typography',
    'textDecoration': 'Typography',
    'paragraphSpacing': 'Typography',
    'paragraphIndent': 'Typography',
    // Layout
    'itemSpacing': 'Layout',
    'paddingLeft': 'Layout',
    'paddingRight': 'Layout',
    'paddingTop': 'Layout',
    'paddingBottom': 'Layout',
    'width': 'Dimensions',
    'height': 'Dimensions',
    'minWidth': 'Dimensions',
    'maxWidth': 'Dimensions',
    'minHeight': 'Dimensions',
    'maxHeight': 'Dimensions',
    // Effects
    'effects': 'Effects',
    // Corner Radius
    'cornerRadius': 'Shape',
    'topLeftRadius': 'Shape',
    'topRightRadius': 'Shape',
    'bottomLeftRadius': 'Shape',
    'bottomRightRadius': 'Shape',
    'strokeWeight': 'Shape',
    // Others
    'opacity': 'Appearance',
    'visible': 'Appearance',
    'fontFamily': 'Typography',
    'fontWeight': 'Typography'
}

// Dark Mode Config
const DARK_THEME = {
    bg: { r: 0.07, g: 0.07, b: 0.07 }, // #111111
    surface: { r: 0.11, g: 0.11, b: 0.11 }, // #1C1C1C
    border: { r: 0.2, g: 0.2, b: 0.2 }, // #333333
    textPrimary: { r: 1, g: 1, b: 1 }, // #FFFFFF
    textSecondary: { r: 0.6, g: 0.6, b: 0.6 }, // #999999
    headerBg: { r: 0.16, g: 0.16, b: 0.16 }, // #282828
}

const TYPE_CONFIG: { [key: string]: { color: RGB; label: string; textColor: RGB } } = {
    'COLOR': { color: { r: 0.2, g: 0.4, b: 1 }, label: 'Color', textColor: { r: 0.9, g: 0.95, b: 1 } },
    'FLOAT': { color: { r: 0.2, g: 0.6, b: 0.4 }, label: 'Float', textColor: { r: 0.9, g: 1, b: 0.9 } },
    'STRING': { color: { r: 0.8, g: 0.5, b: 0.2 }, label: 'String', textColor: { r: 1, g: 0.9, b: 0.8 } },
    'BOOLEAN': { color: { r: 0.6, g: 0.2, b: 0.6 }, label: 'Bool', textColor: { r: 0.95, g: 0.85, b: 0.95 } },
}

export async function drawCard(data: CardData, targetNode: SceneNode) {
    // Load fonts first
    await Promise.all([
        figma.loadFontAsync({ family: 'Inter', style: 'Regular' }),
        figma.loadFontAsync({ family: 'Inter', style: 'Medium' }),
        figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' }),
        figma.loadFontAsync({ family: 'Inter', style: 'Bold' })
    ])

    // 1. Create Main Container
    const card = figma.createFrame()
    card.name = `Variables Report: ${data.targetName}`
    card.layoutMode = 'VERTICAL'
    card.layoutSizingHorizontal = 'HUG'
    card.layoutSizingVertical = 'HUG'
    card.itemSpacing = 32 // Generous spacing between sections
    card.paddingLeft = 32
    card.paddingRight = 32
    card.paddingTop = 32
    card.paddingBottom = 32
    card.fills = [{ type: 'SOLID', color: DARK_THEME.bg }]
    card.strokes = [{ type: 'SOLID', color: DARK_THEME.border }]
    card.cornerRadius = 16
    card.effects = [{
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.4 },
        offset: { x: 0, y: 12 },
        radius: 32,
        visible: true,
        blendMode: 'NORMAL'
    }]

    // Tag for refresh
    card.setPluginData('sourceNodeId', targetNode.id)
    card.setPluginData('isTechCard', 'true')

    // 2. Report Header
    const headerFrame = figma.createFrame()
    headerFrame.name = 'Header'
    headerFrame.layoutMode = 'VERTICAL'
    headerFrame.layoutSizingHorizontal = 'HUG'
    headerFrame.layoutSizingVertical = 'HUG'
    headerFrame.itemSpacing = 8
    headerFrame.fills = []

    const title = figma.createText()
    title.characters = data.targetName
    title.fontSize = 24
    title.fontName = { family: 'Inter', style: 'Bold' }
    title.fills = [{ type: 'SOLID', color: DARK_THEME.textPrimary }]
    headerFrame.appendChild(title)

    const subtitle = figma.createText()
    subtitle.characters = `Variables Report • ${data.variables.length} bound variables`
    subtitle.fontSize = 14
    subtitle.fontName = { family: 'Inter', style: 'Regular' }
    subtitle.fills = [{ type: 'SOLID', color: DARK_THEME.textSecondary }]
    headerFrame.appendChild(subtitle)

    card.appendChild(headerFrame)

    // 3. Variables Sections
    if (data.variables.length > 0) {
        // Group variables
        const grouped = groupVariables(data.variables)

        // Order keys specifically
        const orderedKeys = ['Colors', 'Typography', 'Layout', 'Dimensions', 'Shape', 'Effects', 'Appearance', 'Other']
        // Add any keys that appeared but aren't in orderedKeys
        Object.keys(grouped).forEach(k => {
            if (!orderedKeys.includes(k)) orderedKeys.push(k)
        })

        for (const groupName of orderedKeys) {
            const vars = grouped[groupName]
            if (vars && vars.length > 0) {
                const section = createSection(groupName, vars)
                card.appendChild(section)
            }
        }

    } else {
        const emptyText = figma.createText()
        emptyText.characters = 'No bound variables found.'
        emptyText.fontSize = 14
        emptyText.fills = [{ type: 'SOLID', color: DARK_THEME.textSecondary }]
        card.appendChild(emptyText)
    }

    // 4. Position
    if ('absoluteBoundingBox' in targetNode && targetNode.absoluteBoundingBox) {
        const bbox = targetNode.absoluteBoundingBox
        card.x = bbox.x + bbox.width + 50
        card.y = bbox.y
    } else {
        card.x = 0
        card.y = 0
    }

    figma.currentPage.appendChild(card)
    figma.currentPage.selection = [card]
}

function groupVariables(variables: (ResolvedVariable & { property: string })[]) {
    const groups: { [key: string]: (ResolvedVariable & { property: string })[] } = {}

    variables.forEach(v => {
        // Normalize property name for grouping
        // Handle nested paths (e.g., "textSeg[0].fontSize" -> "fontSize")
        const parts = v.property.split('.')
        const leaf = parts[parts.length - 1]
        // Handle array indices (e.g., "fill[0]" -> "fill")
        const normalizedProp = leaf.replace(/\[\d+\]/g, '')

        const groupName = PROPERTY_GROUPS[normalizedProp] || 'Other'
        if (!groups[groupName]) groups[groupName] = []
        groups[groupName].push(v)
    })

    return groups
}

function createSection(title: string, variables: (ResolvedVariable & { property: string })[]) {
    const sectionFrame = figma.createFrame()
    sectionFrame.name = `Section: ${title}`
    sectionFrame.layoutMode = 'VERTICAL'
    sectionFrame.layoutSizingHorizontal = 'HUG'
    sectionFrame.layoutSizingVertical = 'HUG'
    sectionFrame.itemSpacing = 16
    sectionFrame.fills = []

    // Section Title
    const titleText = figma.createText()
    titleText.characters = title
    titleText.fontSize = 14
    titleText.fontName = { family: 'Inter', style: 'Bold' }
    titleText.fills = [{ type: 'SOLID', color: DARK_THEME.textSecondary }]
    titleText.textCase = 'UPPER'
    titleText.letterSpacing = { value: 4, unit: 'PERCENT' }
    sectionFrame.appendChild(titleText)

    // Table
    const table = createTable(variables, title === 'Colors')
    sectionFrame.appendChild(table)

    return sectionFrame
}

function createTable(variables: (ResolvedVariable & { property: string })[], isColorSection: boolean) {
    const tableFrame = figma.createFrame()
    tableFrame.name = 'Variables Table'
    tableFrame.layoutMode = 'VERTICAL'
    tableFrame.layoutSizingHorizontal = 'HUG'
    tableFrame.layoutSizingVertical = 'HUG'
    tableFrame.itemSpacing = 2 // Tiny gap for borders if we used them, but we'll use bottom borders on rows
    tableFrame.cornerRadius = 12
    tableFrame.clipsContent = true
    tableFrame.fills = [{ type: 'SOLID', color: DARK_THEME.surface }]
    tableFrame.strokes = [{ type: 'SOLID', color: DARK_THEME.border }]

    // Headers
    const headers = isColorSection
        ? ['', 'PROPERTY', 'TYPE', 'NAME', 'VALUE', 'COLLECTION']
        : ['PROPERTY', 'TYPE', 'NAME', 'VALUE', 'COLLECTION']

    const headerRow = createRow(headers, true, false, isColorSection)
    tableFrame.appendChild(headerRow)

    variables.forEach((v, i) => {
        const valueStr = formatValue(v.resolvedValue)
        const rowData = isColorSection
            ? [
                { type: 'color_swatch', value: v.resolvedValue },
                v.property,
                { type: 'type_tag', value: v.resolvedType },
                { type: 'name_pill', value: v.name },
                valueStr,
                v.collectionName
            ]
            : [
                v.property,
                { type: 'type_tag', value: v.resolvedType },
                { type: 'name_pill', value: v.name },
                valueStr,
                v.collectionName
            ]

        const row = createRow(rowData, false, false, isColorSection)
        tableFrame.appendChild(row)
    })

    return tableFrame
}

function createRow(data: any[], isHeader: boolean, isAlternate: boolean = false, isColorSection: boolean) {
    const row = figma.createFrame()
    row.layoutMode = 'HORIZONTAL'
    row.layoutSizingHorizontal = 'HUG'
    row.layoutSizingVertical = 'HUG'
    row.paddingLeft = 24
    row.paddingRight = 24
    row.paddingTop = 16
    row.paddingBottom = 16
    row.itemSpacing = 24

    // Bottom border for all rows except the last (handled by container)
    // Actually, Figma AutoLayout doesn't support individual borders easily without specific structure.
    // We'll simulate bottom border with a line or just rely on the clean dark look.
    // Let's use a box-shadow (inner) for bottom border simulation on header
    if (isHeader) {
        row.fills = [{ type: 'SOLID', color: DARK_THEME.headerBg }]
    } else {
        row.fills = []
        // We could add a separator line
    }

    data.forEach((item, i) => {
        // Define widths - WIDER for legibility
        // If Color Section: [Swatch(32), Property(120), Type(80), Name(180), Value(100), Collection(140)]
        // Else: [Property(120), Type(80), Name(180), Value(100), Collection(140)]
        let width = 120
        if (isColorSection) {
            width = [32, 120, 80, 200, 100, 140][i] || 120
        } else {
            width = [120, 80, 200, 100, 140][i] || 120
        }

        const cellFrame = figma.createFrame()
        cellFrame.layoutMode = 'HORIZONTAL'
        cellFrame.layoutSizingHorizontal = 'FIXED'
        cellFrame.layoutSizingVertical = 'HUG'
        cellFrame.resize(width, 24)
        cellFrame.fills = []
        cellFrame.itemSpacing = 8
        cellFrame.primaryAxisAlignItems = 'MIN'
        cellFrame.counterAxisAlignItems = 'CENTER'

        if (typeof item === 'object' && item.type === 'color_swatch') {
            const swatch = figma.createEllipse()
            swatch.resize(20, 20)
            if (item.value && 'r' in item.value) {
                const { r, g, b, a } = item.value as any
                swatch.fills = [{
                    type: 'SOLID',
                    color: { r, g, b },
                    opacity: typeof a === 'number' ? a : 1
                }]
                swatch.strokes = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.2 }]
            } else {
                swatch.fills = []
                swatch.strokes = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.2 }]
            }
            cellFrame.appendChild(swatch)
        } else if (typeof item === 'object' && item.type === 'type_tag') {
            const tag = createTypeTag(item.value)
            cellFrame.appendChild(tag)
        } else if (typeof item === 'object' && item.type === 'name_pill') {
            const pill = createNamePill(item.value) // Just text now, maybe?
            // Actually, for the reference look, the "Name" isn't a pill, it's just text. 
            // The "Status" was a pill in the reference image.
            // Let's keep it clean text but primary color.
            const nameText = figma.createText()
            nameText.characters = item.value
            nameText.fontSize = 13
            nameText.fontName = { family: 'Inter', style: 'Medium' }
            nameText.fills = [{ type: 'SOLID', color: DARK_THEME.textPrimary }]
            cellFrame.appendChild(nameText)
        } else {
            const textHTML = String(item)
            const cell = figma.createText()
            cell.characters = textHTML
            cell.fontSize = 13 // Larger font
            cell.fontName = { family: 'Inter', style: isHeader ? 'Semi Bold' : 'Regular' }
            cell.fills = [{
                type: 'SOLID',
                color: isHeader ? DARK_THEME.textPrimary : DARK_THEME.textSecondary
            }]
            cellFrame.appendChild(cell)
        }

        row.appendChild(cellFrame)
    })

    return row
}

function createTypeTag(type: string) {
    const config = TYPE_CONFIG[type] || { color: { r: 0.3, g: 0.3, b: 0.3 }, label: type, textColor: { r: 0.9, g: 0.9, b: 0.9 } }

    const tag = figma.createFrame()
    tag.name = 'Type Tag'
    tag.layoutMode = 'HORIZONTAL'
    tag.layoutSizingHorizontal = 'HUG'
    tag.layoutSizingVertical = 'FIXED'
    tag.resize(100, 24)
    tag.cornerRadius = 6
    // Use translucent background for that "badge" look
    tag.fills = [{ type: 'SOLID', color: config.color, opacity: 0.2 }]
    tag.strokes = [{ type: 'SOLID', color: config.color, opacity: 0.4 }]

    tag.paddingLeft = 8
    tag.paddingRight = 8
    tag.primaryAxisAlignItems = 'CENTER'
    tag.counterAxisAlignItems = 'CENTER'

    const label = figma.createText()
    label.characters = config.label
    label.fontSize = 11
    label.fontName = { family: 'Inter', style: 'Semi Bold' }
    label.fills = [{ type: 'SOLID', color: config.textColor }]
    tag.appendChild(label)

    return tag
}

function createNamePill(name: string) {
    // Deprecated for the "clean text" look in the main table, 
    // but if we use it, let's make it look like the "Target" column (just text) or "Reviewer"

    // For now we replaced it inline in createRow. 
    // This function is kept if we need it back, but let's just return a frame wrapper
    const wrapper = figma.createFrame()
    wrapper.layoutMode = 'HORIZONTAL'
    wrapper.layoutSizingHorizontal = 'HUG'
    wrapper.layoutSizingVertical = 'HUG'
    wrapper.fills = []

    const text = figma.createText()
    text.characters = name
    text.fontSize = 13
    text.fontName = { family: 'Inter', style: 'Medium' }
    text.fills = [{ type: 'SOLID', color: DARK_THEME.textPrimary }]
    wrapper.appendChild(text)

    return wrapper
}

function formatValue(val: any): string {
    if (!val) return '—'
    if (typeof val === 'object') {
        if ('r' in val && 'g' in val && 'b' in val) {
            // Hex
            const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0').toUpperCase()
            return `#${toHex(val.r)}${toHex(val.g)}${toHex(val.b)}`
        }
        if (val.type === 'VARIABLE_ALIAS') return 'Alias'
    }
    return String(val)
}
