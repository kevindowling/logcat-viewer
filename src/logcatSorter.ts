import * as vscode from 'vscode';
import { LogEntry, LogPriority, parseLogcat, getPriorityLevel, formatLogEntry } from './logcatParser';

/**
 * Sort log entries by timestamp
 */
export function sortByTime(entries: LogEntry[], ascending: boolean = true): LogEntry[] {
    return [...entries].sort((a, b) => {
        // Entries without timestamps go to the end
        if (!a.timestamp && !b.timestamp) {
            return 0;
        }
        if (!a.timestamp) {
            return 1;
        }
        if (!b.timestamp) {
            return -1;
        }
        
        const diff = a.timestamp.getTime() - b.timestamp.getTime();
        return ascending ? diff : -diff;
    });
}

/**
 * Sort log entries by priority level
 */
export function sortByPriority(entries: LogEntry[], ascending: boolean = true): LogEntry[] {
    return [...entries].sort((a, b) => {
        const levelA = getPriorityLevel(a.priority);
        const levelB = getPriorityLevel(b.priority);
        const diff = levelA - levelB;
        return ascending ? diff : -diff;
    });
}

/**
 * Sort log entries by tag name
 */
export function sortByTag(entries: LogEntry[], ascending: boolean = true): LogEntry[] {
    return [...entries].sort((a, b) => {
        const tagA = a.tag || '';
        const tagB = b.tag || '';
        const diff = tagA.localeCompare(tagB);
        return ascending ? diff : -diff;
    });
}

/**
 * Filter log entries by minimum priority level
 */
export function filterByPriority(entries: LogEntry[], minPriority: LogPriority): LogEntry[] {
    const minLevel = getPriorityLevel(minPriority);
    return entries.filter(entry => {
        const level = getPriorityLevel(entry.priority);
        return level >= minLevel;
    });
}

/**
 * Filter log entries by tag (supports regex)
 */
export function filterByTag(entries: LogEntry[], tagPattern: string): LogEntry[] {
    try {
        const regex = new RegExp(tagPattern, 'i');
        return entries.filter(entry => entry.tag && regex.test(entry.tag));
    } catch {
        // If regex is invalid, do exact match
        return entries.filter(entry => entry.tag === tagPattern);
    }
}

/**
 * Filter log entries by PID
 */
export function filterByPid(entries: LogEntry[], pid: number): LogEntry[] {
    return entries.filter(entry => entry.pid === pid);
}

/**
 * Filter log entries by message content (supports regex)
 */
export function filterByMessage(entries: LogEntry[], messagePattern: string): LogEntry[] {
    try {
        const regex = new RegExp(messagePattern, 'i');
        return entries.filter(entry => entry.message && regex.test(entry.message));
    } catch {
        // If regex is invalid, do substring match
        return entries.filter(entry => entry.message && entry.message.includes(messagePattern));
    }
}

/**
 * Apply sorting and replace document content
 */
export async function applySortToDocument(
    document: vscode.TextDocument,
    sortFn: (entries: LogEntry[]) => LogEntry[]
): Promise<void> {
    const text = document.getText();
    const entries = parseLogcat(text);
    const sortedEntries = sortFn(entries);
    const newText = sortedEntries.map(e => e.raw).join('\n');
    
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(text.length)
    );
    edit.replace(document.uri, fullRange, newText);
    await vscode.workspace.applyEdit(edit);
}

/**
 * Apply filtering and create a new document with filtered results
 */
export async function applyFilterToDocument(
    document: vscode.TextDocument,
    filterFn: (entries: LogEntry[]) => LogEntry[]
): Promise<vscode.TextDocument> {
    const text = document.getText();
    const entries = parseLogcat(text);
    const filteredEntries = filterFn(entries);
    const newText = filteredEntries.map(e => e.raw).join('\n');
    
    // Create a new untitled document with the filtered results
    const newDoc = await vscode.workspace.openTextDocument({
        language: 'logcat',
        content: newText
    });
    
    await vscode.window.showTextDocument(newDoc);
    return newDoc;
}
