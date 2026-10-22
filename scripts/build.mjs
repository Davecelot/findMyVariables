import { watch } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { build } from 'esbuild'
import ts from 'typescript'

// The former builder depended on unpatched glob/brace expansion code. This
// single-command plugin only needs two explicit entry points and CSS modules.
const globalCss = {
  name: 'figma-global-css',
  setup(builder) {
    builder.onResolve({ filter: /^!/ }, ({ path, resolveDir }) => ({
      path: resolve(resolveDir, path.slice(1)),
      namespace: 'figma-global-css'
    }))
    builder.onLoad({ filter: /.*/, namespace: 'figma-global-css' }, async ({ path }) => ({
      contents: await readFile(path, 'utf8'),
      loader: 'css',
      resolveDir: dirname(path)
    }))
  }
}

async function buildPlugin() {
  const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile)
  if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd(), { noEmit: true })
  const program = ts.createProgram(parsed.fileNames, parsed.options)
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)].filter(diagnostic => {
    // Figma's sandbox, DOM and Node typings overlap. The former Figma builder
    // ignored these declarations too; retain every application diagnostic.
    const file = diagnostic.file?.fileName.replaceAll('\\', '/') || ''
    const hostDeclaration = /(?:typescript\/lib\/lib\.dom\.d\.ts|@figma\/plugin-typings\/index\.d\.ts|@types\/node\/(?:ts4\.8\/)?globals\.d\.ts)$/.test(file)
    return !(hostDeclaration && diagnostic.code === 2451 &&
      ["Cannot redeclare block-scoped variable 'console'.", "Cannot redeclare block-scoped variable 'fetch'."].includes(diagnostic.messageText))
  })
  if (diagnostics.length) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: name => name,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n'
    }))
  }
  const { 'figma-plugin': config } = JSON.parse(await readFile('package.json', 'utf8'))
  await mkdir('build', { recursive: true })
  await build({
    stdin: { contents: `import main from ${JSON.stringify('./' + config.main)}; main();`, resolveDir: process.cwd() },
    outfile: 'build/main.js',
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'neutral',
    target: 'es2017'
  })
  const result = await build({
    stdin: {
      contents: `import render from ${JSON.stringify('./' + config.ui)}; render(document.getElementById('create-figma-plugin'), __SHOW_UI_DATA__);`,
      resolveDir: process.cwd()
    },
    outfile: 'build/ui.js',
    bundle: true,
    minify: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'chrome58',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    alias: { react: 'preact/compat', 'react-dom': 'preact/compat' },
    loader: { '.css': 'local-css', '.gif': 'dataurl', '.jpg': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl' },
    plugins: [globalCss]
  })
  const css = result.outputFiles.find(file => file.path.endsWith('.css'))?.text || ''
  const javascript = result.outputFiles.find(file => file.path.endsWith('.js')).text
  // Figma consumes UI JavaScript via utilities.showUI. Keep CSS inside that
  // bundle rather than relying on an external stylesheet or network access.
  const styles = `(()=>{const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.append(style)})();\n`
  await writeFile('build/ui.js', styles + javascript)
  const manifest = { api: '1.0.0', ...config, main: 'build/main.js', ui: 'build/ui.js' }
  await writeFile('manifest.json', JSON.stringify(manifest) + '\n')
  console.log('Built and typechecked the Figma main and UI bundles.')
}

await buildPlugin()
if (process.argv.includes('--watch')) {
  let timer
  let building = false
  let pending = false
  async function rebuild() {
    if (building) { pending = true; return }
    building = true
    try { await buildPlugin() } catch (error) { console.error(error.message) }
    finally {
      building = false
      if (pending) { pending = false; await rebuild() }
    }
  }
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(rebuild, 100)
  }
  watch('src', { recursive: true }, schedule)
  watch('.', (_event, filename) => {
    if (filename === 'package.json' || filename === 'tsconfig.json') schedule()
  })
  console.log('Watching src/, package.json and tsconfig.json for changes.')
}
