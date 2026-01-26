import { EventHandler } from '@create-figma-plugin/utilities'

export interface CreateCardHandler extends EventHandler {
  name: 'CREATE_CARD'
  handler: (options: { includeDescendants: boolean; includeTextSegments: boolean }) => void
}

export interface CloseHandler extends EventHandler {
  name: 'CLOSE'
  handler: () => void
}
