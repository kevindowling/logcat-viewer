import * as vscode from 'vscode';
import { LogcatViewProvider, dispose as disposeLogcat } from './logcatViewProvider';
import { createAndroidProject } from './androidProject';
import { buildAndRunAndroid, buildAndroid, cleanAndroid, installAndroid, runOnDevice } from './androidRunner';
import { pickDevice, AndroidDevice } from './deviceManager';
import { DeviceTreeProvider, ActionsTreeProvider } from './androidTreeViews';

export function activate(context: vscode.ExtensionContext) {
    console.log('Android Dev Tools extension is now active');
    
    // Register the webview view provider for the sidebar (Logcat)
    const logcatProvider = new LogcatViewProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            LogcatViewProvider.viewType,
            logcatProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );

    // Register Device tree view
    const deviceTreeProvider = new DeviceTreeProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('androidDevices', deviceTreeProvider)
    );

    // Register Actions tree view
    const actionsTreeProvider = new ActionsTreeProvider();
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('androidActions', actionsTreeProvider)
    );

    // Register Android project commands
    context.subscriptions.push(
        vscode.commands.registerCommand('android.newProject', createAndroidProject)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('android.buildAndRun', buildAndRunAndroid)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('android.build', () => buildAndroid(false))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('android.buildRelease', () => buildAndroid(true))
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('android.clean', cleanAndroid)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('android.install', installAndroid)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('android.selectDevice', async () => {
            const device = await pickDevice();
            if (device) {
                deviceTreeProvider.setSelectedDevice(device);
                vscode.window.showInformationMessage(`Selected device: ${device.name} (${device.id})`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('android.refreshDevices', () => {
            deviceTreeProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('android.runOnDevice', (device: AndroidDevice) => {
            runOnDevice(device);
        })
    );

    // Auto-refresh devices on activation
    deviceTreeProvider.refresh();
}

export function deactivate() {
    disposeLogcat();
}
