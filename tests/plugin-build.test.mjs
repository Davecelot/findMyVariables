import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'

const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'))
const main = await readFile(new URL(`../${manifest.main}`, import.meta.url), 'utf8')
const ui = await readFile(new URL(`../${manifest.ui}`, import.meta.url), 'utf8')

function startPlugin() {
  const calls = { showUI: [], notify: [], close: 0 }
  const figma = {
    editorType: 'figma',
    currentPage: { selection: [] },
    ui: {},
    showUI: (...args) => calls.showUI.push(args),
    notify: (message) => calls.notify.push(message),
    closePlugin: () => { calls.close += 1 }
  }
  vm.runInNewContext(main, { figma, console, __html__: ui }, { timeout: 1000 })
  return { figma, calls }
}

test('build preserves the plugin identity and disables network access', () => {
  assert.equal(manifest.id, '1597729705379528139')
  assert.equal(manifest.name, 'Find My Variable')
  assert.equal(manifest.documentAccess, 'dynamic-page')
  assert.deepEqual(manifest.networkAccess.allowedDomains, ['none'])
})

test('main bundle starts the existing Figma UI and registers event handlers', () => {
  const { figma, calls } = startPlugin()
  assert.equal(calls.showUI.length, 1)
  assert.match(calls.showUI[0][0], /id="create-figma-plugin"/)
  assert.ok(calls.showUI[0][0].includes(ui))
  assert.equal(calls.showUI[0][1].width, 520)
  assert.equal(calls.showUI[0][1].height, 520)
  assert.equal(calls.showUI[0][1].themeColors, true)
  assert.equal(typeof figma.ui.onmessage, 'function')
  figma.ui.onmessage(['CLOSE'])
  assert.equal(calls.close, 1)
})

test('invalid selection is rejected before generating a card', () => {
  const { figma, calls } = startPlugin()
  figma.ui.onmessage(['CREATE_CARD', { includeDescendants: true }])
  assert.equal(calls.notify[0], 'Please select exactly one element.')
})
