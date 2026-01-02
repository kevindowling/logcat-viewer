import * as vscode from 'vscode';
import { LogEntry, LogPriority, parseLogcat, getPriorityLevel } from './logcatParser';

/**
 * Decoration types for each log priority level
 */
let decorationTypes: Map<LogPriority, vscode.TextEditorDecorationType> = new Map();

/**
 * Initialize decoration types based on configuration
 */
export function initializeDecorations(context: vscode.ExtensionContext): void {
    disposeDecorations();
    
    const config = vscode.workspace.getConfiguration('logcat-viewer');
    
    const createDecorationType = (color: string, isBold: boolean = false): vscode.TextEditorDecorationType => {
        return vscode.window.createTextEditorDecorationType({
            color: color,
            fontWeight: isBold ? 'bold' : 'normal',
            isWholeLine: true
        });
    };
    
    decorationTypes.set(LogPriority.VERBOSE, createDecorationType(config.get('verboseColor', '#808080')));
    decorationTypes.set(LogPriority.DEBUG, createDecorationType(config.get('debugColor', '#0000FF')));
    decorationTypes.set(LogPriority.INFO, createDecorationType(config.get('infoColor', '#00FF00')));
    decorationTypes.set(LogPriority.WARNING, createDecorationType(config.get('warningColor', '#FFA500'), true));
    decorationTypes.set(LogPriority.ERROR, createDecorationType(config.get('errorColor', '#FF0000'), true));
    decorationTypes.set(LogPriority.FATAL, createDecorationType(config.get('fatalColor', '#FF00FF'), true));
    decorationTypes.set(LogPriority.SILENT, createDecorationType('#404040'));
    
    // Register for disposal
    decorationTypes.forEach(decoration => {
        context.subscriptions.push(decoration);
    });
}

/**
 * Dispose all decoration types
 */
export function disposeDecorations(): void {
    decorationTypes.forEach(decoration => {
        decoration.dispose();
    });
    decorationTypes.clear();
}

/**
 * Apply colorization to the active editor
 */
export function applyColorization(editor: vscode.TextEditor): void {
    const config = vscode.workspace.getConfiguration('logcat-viewer');
    if (!config.get('colorize', true)) {
        clearColorization(editor);
        return;
    }
    
    const document = editor.document;
    const text = document.getText();
    const entries = parseLogcat(text);
    
    // Group entries by priority
    const decorationsByPriority: Map<LogPriority, vscode.DecorationOptions[]> = new Map();
    
    for (const priority of Object.values(LogPriority)) {
        decorationsByPriority.set(priority, []);
    }
    
    entries.forEach(entry => {
        if (entry.priority) {
            const decorations = decorationsByPriority.get(entry.priority);
            if (decorations) {
                const line = entry.lineNumber - 1; // Convert to 0-based
                const lineText = document.lineAt(line);
                decorations.push({
                    range: lineText.range
                });
            }
        }
    });
    
    // Apply decorations
    decorationsByPriority.forEach((decorations, priority) => {
        const decorationType = decorationTypes.get(priority);
        if (decorationType) {
            editor.setDecorations(decorationType, decorations);
        }
    });
}

/**
 * Clear all colorization from the editor
 */
export function clearColorization(editor: vscode.TextEditor): void {
    decorationTypes.forEach(decorationType => {
        editor.setDecorations(decorationType, []);
    });
}

/**
 * Update colorization when configuration changes
 */
export function onConfigurationChanged(context: vscode.ExtensionContext): void {
    initializeDecorations(context);
    
    // Re-apply to all visible editors
    vscode.window.visibleTextEditors.forEach(editor => {
        if (editor.document.languageId === 'logcat') {
            applyColorization(editor);
        }
    });
}
