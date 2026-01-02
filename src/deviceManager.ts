import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface AndroidDevice {
    id: string;
    name: string;
    state: string;
    isEmulator: boolean;
}

/**
 * Find ADB executable path
 */
export function findAdbPath(): string {
    const config = vscode.workspace.getConfiguration('logcat-viewer');
    const configuredPath = config.get<string>('adbPath', 'adb');
    
    if (configuredPath && configuredPath !== 'adb') {
        return configuredPath;
    }
    
    const commonPaths = [
        '/opt/android-sdk/platform-tools/adb',
        '/usr/bin/adb',
        '/usr/local/bin/adb',
        path.join(process.env.HOME || '', 'Android/Sdk/platform-tools/adb'),
        path.join(process.env.ANDROID_HOME || '', 'platform-tools/adb'),
        path.join(process.env.ANDROID_SDK_ROOT || '', 'platform-tools/adb'),
    ];
    
    for (const p of commonPaths) {
        if (p && fs.existsSync(p)) {
            return p;
        }
    }
    
    return 'adb';
}

/**
 * Get list of connected Android devices
 */
export async function getConnectedDevices(): Promise<AndroidDevice[]> {
    const adbPath = findAdbPath();
    
    return new Promise((resolve) => {
        cp.exec(`${adbPath} devices -l`, (error, stdout, stderr) => {
            if (error) {
                resolve([]);
                return;
            }
            
            const lines = stdout.trim().split('\n').slice(1); // Skip header
            const devices: AndroidDevice[] = [];
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.includes('device')) {
                    continue;
                }
                
                const parts = trimmed.split(/\s+/);
                const id = parts[0];
                const state = parts[1];
                
                if (state !== 'device') {
                    continue; // Skip offline, unauthorized, etc.
                }
                
                // Parse device info
                const isEmulator = id.startsWith('emulator-') || trimmed.includes('vbox');
                let name = id;
                
                // Try to extract model name
                const modelMatch = trimmed.match(/model:(\S+)/);
                if (modelMatch) {
                    name = modelMatch[1].replace(/_/g, ' ');
                }
                
                devices.push({ id, name, state, isEmulator });
            }
            
            resolve(devices);
        });
    });
}

/**
 * Show device picker and return selected device
 */
export async function pickDevice(): Promise<AndroidDevice | undefined> {
    const devices = await getConnectedDevices();
    
    if (devices.length === 0) {
        const action = await vscode.window.showWarningMessage(
            'No Android devices connected. Please connect a device or start an emulator.',
            'Refresh',
            'Open ADB Settings'
        );
        
        if (action === 'Refresh') {
            return pickDevice();
        } else if (action === 'Open ADB Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'logcat-viewer.adbPath');
        }
        return undefined;
    }
    
    if (devices.length === 1) {
        return devices[0];
    }
    
    // Multiple devices - show picker
    const items = devices.map(device => ({
        label: device.isEmulator ? `$(device-mobile) ${device.name}` : `$(device-mobile) ${device.name}`,
        description: device.id,
        detail: device.isEmulator ? 'Emulator' : 'Physical Device',
        device
    }));
    
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select target device'
    });
    
    return selected?.device;
}

/**
 * Install APK to device
 */
export async function installApk(deviceId: string, apkPath: string): Promise<boolean> {
    const adbPath = findAdbPath();
    
    return new Promise((resolve) => {
        const command = `${adbPath} -s ${deviceId} install -r "${apkPath}"`;
        
        cp.exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to install APK: ${stderr || error.message}`);
                resolve(false);
                return;
            }
            
            if (stdout.includes('Success')) {
                resolve(true);
            } else {
                vscode.window.showErrorMessage(`Install failed: ${stdout}`);
                resolve(false);
            }
        });
    });
}

/**
 * Launch app on device
 */
export async function launchApp(deviceId: string, packageName: string, activityName: string = '.MainActivity'): Promise<boolean> {
    const adbPath = findAdbPath();
    const component = `${packageName}/${activityName}`;
    
    return new Promise((resolve) => {
        const command = `${adbPath} -s ${deviceId} shell am start -n ${component}`;
        
        cp.exec(command, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to launch app: ${stderr || error.message}`);
                resolve(false);
                return;
            }
            
            if (stderr.includes('Error')) {
                vscode.window.showErrorMessage(`Launch failed: ${stderr}`);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Uninstall app from device
 */
export async function uninstallApp(deviceId: string, packageName: string): Promise<boolean> {
    const adbPath = findAdbPath();
    
    return new Promise((resolve) => {
        const command = `${adbPath} -s ${deviceId} uninstall ${packageName}`;
        
        cp.exec(command, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to uninstall: ${stderr || error.message}`);
                resolve(false);
                return;
            }
            
            if (stdout.includes('Success')) {
                vscode.window.showInformationMessage(`Uninstalled ${packageName}`);
                resolve(true);
            } else {
                vscode.window.showErrorMessage(`Uninstall failed: ${stdout}`);
                resolve(false);
            }
        });
    });
}
