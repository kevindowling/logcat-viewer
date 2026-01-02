import * as vscode from 'vscode';
import { LogcatViewProvider, dispose as disposeLogcat } from './logcatViewProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('Logcat Viewer extension is now active');
    
    // Register the webview view provider for the sidebar
    const provider = new LogcatViewProvider(context.extensionUri);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            LogcatViewProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        )
    );
}

export function deactivate() {
    disposeLogcat();
}
