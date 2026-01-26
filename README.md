# Find My Variable

A powerful Figma plugin designed to help you efficiently find, inspect, and manage variables within your Figma design files.

## Features

- **Inspect Variables**: deeply inspect variables bound to your layers and elements.
- **Find Usage**: Quickly locate where specific variables are being used across your design.
- **Variant Analysis**: Understand how variables are interacting with component variants.
- **Seamless Integration**: Built to work natively within the Figma environment.

## Installation

1. Open your Figma file.
2. Go to **Plugins** > **Find My Variable**.
3. (Or install via the manifest if running locally).

## Development

This plugin is built with [Create Figma Plugin](https://yuanqing.github.io/create-figma-plugin/).

### Pre-requisites

- [Node.js](https://nodejs.org) – v20+
- [Figma desktop app](https://figma.com/downloads/)

### Build the plugin

```bash
npm install
npm run build
```

This will generate a `manifest.json` file and a `build/` directory containing the JavaScript bundle(s) for the plugin.

### Watch mode

To watch for code changes and rebuild the plugin automatically:

```bash
npm run watch
```

## License

MIT
