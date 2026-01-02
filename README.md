# Logcat Viewer

A VSCode extension for viewing and filtering Android ADB logcat logs in real-time.

## Features

- **Sidebar Panel** - Dedicated logcat viewer in the Activity Bar with a phone icon
- **Real-time Streaming** - Live logcat capture from connected Android devices
- **Colorized Output** - Logs colored by priority level (Verbose, Debug, Info, Warning, Error, Fatal)
- **Filtering** - Filter by minimum log level, tag name, or search text
- **Auto-scroll** - Automatically scroll to latest logs (toggleable)
- **Auto-detect ADB** - Finds ADB in common installation paths

## Usage

1. Connect an Android device via USB or start an emulator
2. Click the **phone icon** in the Activity Bar (left sidebar)
3. Click **▶ Start** to begin capturing logs
4. Use the filters to narrow down logs:
   - **Level dropdown** - Show only logs at a certain priority and above
   - **Tag filter** - Filter by tag name (partial match)
   - **Search** - Search through all log content
5. Click **■ Stop** to stop capturing



## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `logcat-viewer.adbPath` | `adb` | Path to ADB executable (auto-detected if not set) |

## Requirements

- ADB (Android Debug Bridge) installed
- Android device connected via USB or an emulator running

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Press F5 in VSCode to test
```

## License

ISC
