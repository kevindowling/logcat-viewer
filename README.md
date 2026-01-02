# Android Dev Tools

A VS Code extension for Android development: create projects, build, run, and view logcat logs.

## Features

### 🚀 Project Creation
- **New Project Wizard** - Create Java or Kotlin Android projects from templates
- **Configurable SDK** - Choose minimum SDK version during setup
- **Ready to Build** - Projects include Gradle wrapper and proper structure

### 🔨 Build & Run
- **Build Debug/Release** - One-click Gradle builds
- **Install & Run** - Deploy and launch on connected devices
- **Device Selection** - Pick from multiple connected devices or emulators
- **Clean Project** - Run Gradle clean task

### 📱 Device Management
- **Device Tree View** - See all connected devices in the sidebar
- **Auto-refresh** - Detect newly connected devices
- **Direct Run** - Click a device to run your app on it

### 📋 Logcat Viewer
- **Sidebar Panel** - Dedicated logcat viewer in the Activity Bar
- **Real-time Streaming** - Live logcat capture from connected Android devices
- **Colorized Output** - Logs colored by priority level (Verbose, Debug, Info, Warning, Error, Fatal)
- **Filtering** - Filter by minimum log level, tag name, or search text
- **Auto-scroll** - Automatically scroll to latest logs (toggleable)

## Getting Started

1. Open the **Android** panel in the Activity Bar (phone icon)
2. Click **New Project** in the Actions section
3. Follow the wizard to configure your app
4. Connect an Android device or start an emulator
5. Click **Build & Run** or click directly on a device

## Commands

| Command | Description |
|---------|-------------|
| `Android: New Project` | Create a new Android project |
| `Android: Build and Run` | Build APK and run on device |
| `Android: Build Debug APK` | Build debug APK |
| `Android: Build Release APK` | Build release APK |
| `Android: Clean Project` | Run Gradle clean |
| `Android: Install APK` | Install existing APK to device |
| `Android: Select Device` | Pick target device |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `logcat-viewer.adbPath` | `adb` | Path to ADB executable (auto-detected if not set) |
| `android.sdkPath` | `` | Path to Android SDK (uses ANDROID_HOME if not set) |

## Requirements

- **ADB** (Android Debug Bridge) installed
- **Android SDK** with build tools
- **Java JDK 8+** for Gradle builds
- Android device connected via USB or an emulator running

## Sidebar Views

The Android panel includes three sections:

1. **Devices** - Shows connected Android devices and emulators
2. **Actions** - Quick access to project, build, and run commands
3. **Logcat** - Real-time log viewer with filtering

## License

MIT
