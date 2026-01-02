import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let adbProcess: cp.ChildProcess | null = null;
let outputChannel: vscode.OutputChannel | null = null;
let liveDocument: vscode.TextDocument | null = null;
let liveEditor: vscode.TextEditor | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;

/**
 * Find ADB executable path
 */
function findAdbPath(configuredPath: string): string {
    // If user configured a specific path, use it
    if (configuredPath && configuredPath !== 'adb') {
        return configuredPath;
    }
    
    // Common ADB locations to check
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
    
    // Fall back to hoping it's in PATH
    return 'adb';
}

/**
 * Check if ADB is available and a device is connected
 */
async function checkAdbConnection(adbPath: string): Promise<{ connected: boolean; devices: string[] }> {
    return new Promise((resolve) => {
        cp.exec(`${adbPath} devices`, (error, stdout, stderr) => {
            if (error) {
                resolve({ connected: false, devices: [] });
                return;
            }
            
            const lines = stdout.trim().split('\n').slice(1); // Skip header "List of devices attached"
            const devices = lines
                .filter(line => {
                    const trimmed = line.trim();
                    // Match any line that has a device identifier followed by "device"
                    // Format can be: "SERIAL device" or "SERIAL\tdevice" with variable whitespace
                    return trimmed.length > 0 && /\s+device(\s|$)/.test(trimmed);
                })
                .map(line => line.trim().split(/\s+/)[0]);
            
            resolve({ connected: devices.length > 0, devices });
        });
    });
}

/**
 * Start live logcat capture from connected device
 */
export async function startLiveCapture(): Promise<void> {
    if (adbProcess) {
        vscode.window.showWarningMessage('Logcat capture is already running. Stop it first.');
        return;
    }
    
    const config = vscode.workspace.getConfiguration('logcat-viewer');
    const configuredPath = config.get<string>('adbPath', 'adb');
    const adbPath = findAdbPath(configuredPath);
    
    // Check ADB connection first
    const { connected, devices } = await checkAdbConnection(adbPath);
    
    let targetDevice: string | undefined;
    
    if (!connected) {
        // Try to start anyway - user said adb logcat works
        const action = await vscode.window.showWarningMessage(
            'Could not detect Android device. Try to capture anyway?',
            'Try Anyway',
            'Check ADB Path',
            'Cancel'
        );
        
        if (action === 'Check ADB Path') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'logcat-viewer.adbPath');
            return;
        } else if (action !== 'Try Anyway') {
            return;
        }
        // Continue without target device - let adb figure it out
    } else if (devices.length > 1) {
        // If multiple devices, let user choose
        targetDevice = await vscode.window.showQuickPick(devices, {
            placeHolder: 'Select device'
        });
        if (!targetDevice) {
            return;
        }
    }
    
    // Ask user for output destination
    const outputDestination = await vscode.window.showQuickPick([
        { label: '$(file) Open in Editor', description: 'Open logcat in a new editor tab with full colorization', value: 'editor' },
        { label: '$(output) Output Panel', description: 'Show in Output panel (lightweight)', value: 'output' }
    ], {
        placeHolder: 'Where to show logcat output?'
    });
    
    if (!outputDestination) {
        return;
    }
    
    // Get logcat format options
    const formatOptions = await vscode.window.showQuickPick([
        { label: 'threadtime', description: 'Display date, time, priority, tag, PID and TID' },
        { label: 'brief', description: 'Display priority/tag and PID' },
        { label: 'time', description: 'Display date, time, priority/tag and PID' },
        { label: 'long', description: 'Display all metadata fields' },
        { label: 'raw', description: 'Display raw log message' }
    ], {
        placeHolder: 'Select logcat format'
    });
    
    const format = formatOptions?.label || 'threadtime';
    
    // Optional: filter by priority
    const priorityFilter = await vscode.window.showQuickPick([
        { label: '*:V', description: 'All messages (Verbose and above)' },
        { label: '*:D', description: 'Debug and above' },
        { label: '*:I', description: 'Info and above' },
        { label: '*:W', description: 'Warning and above' },
        { label: '*:E', description: 'Error and above' }
    ], {
        placeHolder: 'Select minimum priority level (optional)'
    });
    
    const priority = priorityFilter?.label || '*:V';
    
    // Optional: filter by tag
    const tagFilter = await vscode.window.showInputBox({
        prompt: 'Filter by tag (optional, leave empty for all)',
        placeHolder: 'e.g., ActivityManager or MyApp:D *:S'
    });
    
    // Build adb command arguments
    const args = ['logcat', '-v', format];
    
    if (targetDevice) {
        args.unshift('-s', targetDevice);
    }
    
    // Add priority/tag filters
    if (tagFilter && tagFilter.trim()) {
        args.push(...tagFilter.trim().split(/\s+/));
    } else {
        args.push(priority);
    }
    
    // Create status bar item
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.command = 'logcat-viewer.stopLiveCapture';
    }
    statusBarItem.text = '$(debug-stop) Logcat Running';
    statusBarItem.tooltip = 'Click to stop logcat capture';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    statusBarItem.show();
    
    if (outputDestination.value === 'editor') {
        await startCaptureToEditor(adbPath, args);
    } else {
        await startCaptureToOutput(adbPath, args);
    }
}

/**
 * Start capture to a new editor document
 */
async function startCaptureToEditor(adbPath: string, args: string[]): Promise<void> {
    // Create a new untitled document with logcat language
    liveDocument = await vscode.workspace.openTextDocument({
        language: 'logcat',
        content: `// Live Logcat Capture - ${new Date().toLocaleString()}\n// Command: ${adbPath} ${args.join(' ')}\n// Press Ctrl+C or use "Logcat: Stop Live Capture" to stop\n\n`
    });
    
    liveEditor = await vscode.window.showTextDocument(liveDocument, {
        preview: false,
        preserveFocus: false
    });
    
    try {
        adbProcess = cp.spawn(adbPath, args);
        
        let buffer = '';
        const updateInterval = 100; // ms
        let updateTimeout: NodeJS.Timeout | null = null;
        
        const flushBuffer = async () => {
            if (buffer && liveDocument && liveEditor) {
                const edit = new vscode.WorkspaceEdit();
                const lastLine = liveDocument.lineCount - 1;
                const lastChar = liveDocument.lineAt(lastLine).text.length;
                edit.insert(liveDocument.uri, new vscode.Position(lastLine, lastChar), buffer);
                await vscode.workspace.applyEdit(edit);
                
                // Auto-scroll to bottom
                if (liveEditor) {
                    const newLastLine = liveDocument.lineCount - 1;
                    liveEditor.revealRange(
                        new vscode.Range(newLastLine, 0, newLastLine, 0),
                        vscode.TextEditorRevealType.Default
                    );
                }
                
                buffer = '';
            }
            updateTimeout = null;
        };
        
        adbProcess.stdout?.on('data', (data: Buffer) => {
            buffer += data.toString();
            
            // Batch updates to avoid too many edits
            if (!updateTimeout) {
                updateTimeout = setTimeout(flushBuffer, updateInterval);
            }
        });
        
        adbProcess.stderr?.on('data', (data: Buffer) => {
            buffer += `[ERROR] ${data.toString()}`;
            if (!updateTimeout) {
                updateTimeout = setTimeout(flushBuffer, updateInterval);
            }
        });
        
        adbProcess.on('close', (code) => {
            if (updateTimeout) {
                clearTimeout(updateTimeout);
            }
            flushBuffer().then(() => {
                if (liveDocument) {
                    const edit = new vscode.WorkspaceEdit();
                    const lastLine = liveDocument.lineCount - 1;
                    const lastChar = liveDocument.lineAt(lastLine).text.length;
                    edit.insert(liveDocument.uri, new vscode.Position(lastLine, lastChar), 
                        `\n\n// Logcat capture ended with code ${code}`);
                    vscode.workspace.applyEdit(edit);
                }
            });
            cleanup();
        });
        
        adbProcess.on('error', (err) => {
            vscode.window.showErrorMessage(`Failed to start ADB: ${err.message}`);
            cleanup();
        });
        
        vscode.window.showInformationMessage('Logcat capture started in editor');
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to start logcat capture: ${error}`);
        cleanup();
    }
}

/**
 * Start capture to output panel
 */
async function startCaptureToOutput(adbPath: string, args: string[]): Promise<void> {
    // Create output channel for logcat
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Logcat', 'logcat');
    }
    outputChannel.clear();
    outputChannel.show(true);
    
    outputChannel.appendLine(`// Live Logcat Capture - ${new Date().toLocaleString()}`);
    outputChannel.appendLine(`// Command: ${adbPath} ${args.join(' ')}`);
    outputChannel.appendLine('');
    
    try {
        adbProcess = cp.spawn(adbPath, args);
        
        adbProcess.stdout?.on('data', (data: Buffer) => {
            outputChannel?.append(data.toString());
        });
        
        adbProcess.stderr?.on('data', (data: Buffer) => {
            outputChannel?.append(`[ERROR] ${data.toString()}`);
        });
        
        adbProcess.on('close', (code) => {
            outputChannel?.appendLine(`\n// Logcat capture ended with code ${code}`);
            cleanup();
        });
        
        adbProcess.on('error', (err) => {
            vscode.window.showErrorMessage(`Failed to start ADB: ${err.message}`);
            cleanup();
        });
        
        vscode.window.showInformationMessage('Logcat capture started in output panel');
        
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to start logcat capture: ${error}`);
        cleanup();
    }
}

/**
 * Cleanup resources after capture stops
 */
function cleanup(): void {
    adbProcess = null;
    liveDocument = null;
    liveEditor = null;
    if (statusBarItem) {
        statusBarItem.hide();
    }
}

/**
 * Stop live logcat capture
 */
export function stopLiveCapture(): void {
    if (adbProcess) {
        adbProcess.kill();
        adbProcess = null;
        vscode.window.showInformationMessage('Logcat capture stopped');
    } else {
        vscode.window.showWarningMessage('No logcat capture is running');
    }
    cleanup();
}

/**
 * Clear the logcat buffer on device
 */
export async function clearLogcatBuffer(): Promise<void> {
    const config = vscode.workspace.getConfiguration('logcat-viewer');
    const adbPath = findAdbPath(config.get<string>('adbPath', 'adb'));
    
    return new Promise((resolve, reject) => {
        cp.exec(`${adbPath} logcat -c`, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Failed to clear logcat: ${stderr}`);
                reject(error);
            } else {
                vscode.window.showInformationMessage('Logcat buffer cleared');
                resolve();
            }
        });
    });
}

/**
 * Save current live capture to file
 */
export async function saveCaptureToFile(): Promise<void> {
    if (!liveDocument) {
        vscode.window.showWarningMessage('No active logcat capture to save');
        return;
    }
    
    const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`logcat-${Date.now()}.log`),
        filters: {
            'Logcat Files': ['log', 'logcat', 'txt'],
            'All Files': ['*']
        }
    });
    
    if (uri) {
        const content = liveDocument.getText();
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
        vscode.window.showInformationMessage(`Saved to ${uri.fsPath}`);
    }
}

/**
 * Restart logcat capture (clear buffer and start fresh)
 */
export async function restartCapture(): Promise<void> {
    if (adbProcess) {
        stopLiveCapture();
    }
    
    const config = vscode.workspace.getConfiguration('logcat-viewer');
    const adbPath = findAdbPath(config.get<string>('adbPath', 'adb'));
    
    // Clear the buffer first
    await new Promise<void>((resolve) => {
        cp.exec(`${adbPath} logcat -c`, () => resolve());
    });
    
    // Start fresh capture
    await startLiveCapture();
}

/**
 * Dispose resources
 */
export function dispose(): void {
    if (adbProcess) {
        adbProcess.kill();
        adbProcess = null;
    }
    if (outputChannel) {
        outputChannel.dispose();
        outputChannel = null;
    }
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = null;
    }
}
