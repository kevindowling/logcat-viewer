# Logcat Viewer

A VSCode extension for viewing, sorting, and colorizing Android ADB logcat logs.

## Features

- **Syntax Highlighting**: Automatic colorization of logcat output based on log priority (V, D, I, W, E, F)
- **Sorting**: Sort logs by time, priority level, or tag name
- **Filtering**: Filter logs by minimum priority level or tag pattern (regex supported)
- **Live Capture**: Start live logcat capture directly from VSCode
- **Customizable Colors**: Configure colors for each log priority level

## Usage

### Opening Logcat Files

The extension automatically activates for files with `.logcat` or `.log` extensions. You can also manually set the language mode to "Logcat" using the language selector in the bottom right of VSCode.

### Commands

Access these commands via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- **Logcat: Sort by Time** - Sort log entries chronologically
- **Logcat: Sort by Priority** - Sort log entries by priority level (V→F or F→V)
- **Logcat: Sort by Tag** - Sort log entries alphabetically by tag
- **Logcat: Filter by Priority Level** - Show only logs at a certain priority and above
- **Logcat: Filter by Tag** - Filter logs by tag name or regex pattern
- **Logcat: Start Live Capture** - Start capturing logcat from connected device
- **Logcat: Stop Live Capture** - Stop the live capture

### Context Menu

Right-click in a logcat file to access sorting and filtering options.

### Configuration

Configure the extension in VSCode settings:

```json
{
  "logcat-viewer.colorize": true,
  "logcat-viewer.verboseColor": "#808080",
  "logcat-viewer.debugColor": "#0000FF",
  "logcat-viewer.infoColor": "#00FF00",
  "logcat-viewer.warningColor": "#FFA500",
  "logcat-viewer.errorColor": "#FF0000",
  "logcat-viewer.fatalColor": "#FF00FF",
  "logcat-viewer.adbPath": "adb"
}
```

## Supported Logcat Formats

The extension supports multiple logcat output formats:

- **threadtime**: `MM-DD HH:MM:SS.mmm PID TID PRIORITY TAG: MESSAGE`
- **brief**: `PRIORITY/TAG(PID): MESSAGE`
- **time**: `MM-DD HH:MM:SS.mmm PRIORITY/TAG(PID): MESSAGE`
- **tag**: `PRIORITY/TAG: MESSAGE`
- **long**: Multi-line format with header

## Requirements

- For live capture: ADB (Android Debug Bridge) must be installed and in your PATH
- A connected Android device or running emulator

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package extension
npx vsce package
```

## License

ISC
