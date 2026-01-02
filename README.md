# Logcat Viewer

A VSCode extension for viewing and filtering Android ADB logcat logs in real-time.

## Features

- **Sidebar Panel** - Dedicated logcat viewer in the Activity Bar with a phone icon
- **Real-time Streaming** - Live logcat capture from connected Android devices
- **Colorized Output** - Logs colored by priority level (Verbose, Debug, Info, Warning, Error, Fatal)
- **Filtering** - Filter by minimum log level, tag name, or search text
- **Auto-scroll** - Automatically scroll to latest logs (toggleable)
- **Auto-detect ADB** - Finds ADB in common installation paths


## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `logcat-viewer.adbPath` | `adb` | Path to ADB executable (auto-detected if not set) |

## Requirements

- ADB (Android Debug Bridge) installed
- Android device connected via USB or an emulator running

## License

MIT
