import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let panel: vscode.WebviewPanel | null = null;
let adbProcess: cp.ChildProcess | null = null;

/**
 * Find ADB executable path
 */
function findAdbPath(): string {
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
 * Get the HTML content for the webview panel
 */
function getWebviewContent(): string {
    return /*html*/`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Logcat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-editor-font-family, 'Consolas', 'Courier New', monospace);
            font-size: var(--vscode-editor-font-size, 13px);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .toolbar {
            display: flex;
            gap: 8px;
            padding: 8px;
            background: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            flex-wrap: wrap;
            align-items: center;
        }
        
        .toolbar-group {
            display: flex;
            gap: 4px;
            align-items: center;
        }
        
        .toolbar label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-right: 4px;
        }
        
        input, select {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, transparent);
            padding: 4px 8px;
            border-radius: 2px;
            font-size: 12px;
        }
        
        input:focus, select:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        
        input[type="text"] {
            width: 200px;
        }
        
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 12px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        button.danger {
            background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .status {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--vscode-testing-iconSkipped);
        }
        
        .status-dot.running {
            background: var(--vscode-testing-iconPassed, #4ec9b0);
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .log-container {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 4px 0;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: var(--vscode-editor-font-size, 13px);
            line-height: 1.4;
        }
        
        .log-line {
            padding: 1px 12px;
            white-space: pre-wrap;
            word-break: break-all;
        }
        
        .log-line:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .log-line.V { color: #808080; }
        .log-line.D { color: #4fc1ff; }
        .log-line.I { color: #4ec9b0; }
        .log-line.W { color: #dcdcaa; }
        .log-line.E { color: #f44747; font-weight: bold; }
        .log-line.F { color: #ff00ff; font-weight: bold; }
        
        .log-line .timestamp { color: #6a9955; }
        .log-line .pid { color: #b5cea8; }
        .log-line .tag { color: #9cdcfe; }
        
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            gap: 12px;
        }
        
        .empty-state button {
            margin-top: 8px;
        }
        
        .filter-highlight {
            background: var(--vscode-editor-findMatchHighlightBackground, rgba(255, 255, 0, 0.2));
        }
        
        .hidden {
            display: none !important;
        }
        
        .log-count {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            padding: 4px 12px;
            border-top: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBar-background);
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <div class="toolbar-group">
            <button id="startBtn" onclick="startCapture()">▶ Start</button>
            <button id="stopBtn" class="danger" onclick="stopCapture()" disabled>■ Stop</button>
            <button class="secondary" onclick="clearLogs()">Clear</button>
        </div>
        
        <div class="toolbar-group">
            <label>Level:</label>
            <select id="levelFilter" onchange="applyFilters()">
                <option value="V">Verbose</option>
                <option value="D">Debug</option>
                <option value="I" selected>Info</option>
                <option value="W">Warning</option>
                <option value="E">Error</option>
                <option value="F">Fatal</option>
            </select>
        </div>
        
        <div class="toolbar-group">
            <label>Tag:</label>
            <input type="text" id="tagFilter" placeholder="tag,-exclude,/regex/" oninput="applyFilters()" title="Comma-separated, -prefix to exclude, /regex/ for patterns">
        </div>
        
        <div class="toolbar-group">
            <label>Search:</label>
            <input type="text" id="searchFilter" placeholder="term,-exclude,/regex/" oninput="applyFilters()" title="Comma-separated, -prefix to exclude, /regex/ for patterns">
        </div>
        
        <div class="toolbar-group">
            <label>
                <input type="checkbox" id="autoScroll" checked> Lock to Bottom
            </label>
        </div>
        
        <div class="status">
            <span class="status-dot" id="statusDot"></span>
            <span id="statusText">Stopped</span>
        </div>
    </div>
    
    <div class="log-container" id="logContainer">
        <div class="empty-state" id="emptyState">
            <div>No logs yet</div>
            <div style="font-size: 11px;">Click Start to begin capturing logcat</div>
        </div>
    </div>
    
    <div class="log-count" id="logCount">0 lines</div>
    
    <script>
        const vscode = acquireVsCodeApi();
        const logContainer = document.getElementById('logContainer');
        const emptyState = document.getElementById('emptyState');
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const logCountEl = document.getElementById('logCount');
        
        let allLogs = [];
        let isRunning = false;
        
        const priorityLevels = { V: 0, D: 1, I: 2, W: 3, E: 4, F: 5 };
        
        // Regex to parse logcat lines
        const logcatRegex = /^(\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}\\.\\d{3})\\s+(\\d+)\\s+(\\d+)\\s+([VDIWEF])\\s+([^:]+):\\s*(.*)$/;
        
        function startCapture() {
            vscode.postMessage({ command: 'start' });
        }
        
        function stopCapture() {
            vscode.postMessage({ command: 'stop' });
        }
        
        function clearLogs() {
            allLogs = [];
            renderLogs();
            emptyState.classList.remove('hidden');
        }
        
        function setRunning(running) {
            isRunning = running;
            startBtn.disabled = running;
            stopBtn.disabled = !running;
            statusDot.classList.toggle('running', running);
            statusText.textContent = running ? 'Running' : 'Stopped';
        }
        
        function applyFilters() {
            renderLogs();
        }
        
        /**
         * Parse a filter string into terms with support for:
         * - Comma-separated values (OR logic): "term1,term2"
         * - Negation with prefix: "-term" 
         * - Regex patterns: "/pattern/"
         */
        function parseFilterTerms(filterStr) {
            if (!filterStr.trim()) return [];
            
            return filterStr.split(',').map(term => {
                term = term.trim();
                if (!term) return null;
                
                const isNegated = term.startsWith('-');
                if (isNegated) term = term.slice(1);
                
                // Don't treat empty string after removing "-" as valid
                if (!term) return null;
                
                // Check for regex pattern /pattern/
                if (term.startsWith('/') && term.endsWith('/') && term.length > 2) {
                    try {
                        const pattern = term.slice(1, -1);
                        return { regex: new RegExp(pattern, 'i'), negated: isNegated };
                    } catch (e) {
                        // Invalid regex, treat as plain text
                        return { text: term.toLowerCase(), negated: isNegated };
                    }
                }
                
                return { text: term.toLowerCase(), negated: isNegated };
            }).filter(Boolean);
        }
        
        /**
         * Test if a value matches any of the filter terms
         * Returns true if the value should be INCLUDED
         */
        function matchesFilter(value, terms) {
            if (terms.length === 0) return true;
            
            const valueLower = value.toLowerCase();
            
            // Separate positive and negative terms
            const positiveTerms = terms.filter(t => !t.negated);
            const negativeTerms = terms.filter(t => t.negated);
            
            // Check negative terms first - if any match, exclude
            for (const term of negativeTerms) {
                const matches = term.regex 
                    ? term.regex.test(value)
                    : valueLower.includes(term.text);
                if (matches) return false;
            }
            
            // If no positive terms, include (only negatives were specified)
            if (positiveTerms.length === 0) return true;
            
            // Check positive terms - at least one must match (OR logic)
            for (const term of positiveTerms) {
                const matches = term.regex 
                    ? term.regex.test(value)
                    : valueLower.includes(term.text);
                if (matches) return true;
            }
            
            return false;
        }
        
        function getFilteredLogs() {
            const levelFilter = document.getElementById('levelFilter').value;
            const tagFilter = document.getElementById('tagFilter').value;
            const searchFilter = document.getElementById('searchFilter').value;
            const minLevel = priorityLevels[levelFilter];
            
            const tagTerms = parseFilterTerms(tagFilter);
            const searchTerms = parseFilterTerms(searchFilter);
            
            return allLogs.filter(log => {
                // Level filter
                if (priorityLevels[log.priority] < minLevel) return false;
                
                // Tag filter
                if (!matchesFilter(log.tag || '', tagTerms)) return false;
                
                // Search filter
                if (!matchesFilter(log.raw || '', searchTerms)) return false;
                
                return true;
            });
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function formatLogLine(log) {
            const escaped = escapeHtml(log.raw);
            
            // Highlight the parsed parts
            if (log.timestamp) {
                return escaped
                    .replace(log.timestamp, '<span class="timestamp">' + log.timestamp + '</span>')
                    .replace(log.tag + ':', '<span class="tag">' + log.tag + '</span>:');
            }
            
            return escaped;
        }
        
        function renderLogs() {
            const filtered = getFilteredLogs();
            const autoScroll = document.getElementById('autoScroll').checked;
            
            if (filtered.length === 0 && allLogs.length === 0) {
                emptyState.classList.remove('hidden');
                logCountEl.textContent = '0 lines';
                return;
            }
            
            emptyState.classList.add('hidden');
            
            // Only render last 5000 lines for performance
            const toRender = filtered.slice(-5000);
            
            const html = toRender.map(log => 
                '<div class="log-line ' + (log.priority || '') + '">' + formatLogLine(log) + '</div>'
            ).join('');
            
            // Calculate scroll position relative to bottom before re-render
            const distanceFromBottom = logContainer.scrollHeight - logContainer.scrollTop - logContainer.clientHeight;
            
            logContainer.innerHTML = html || '<div class="empty-state">No matching logs</div>';
            
            // Auto-scroll to bottom, or maintain position relative to bottom
            if (autoScroll) {
                logContainer.scrollTop = logContainer.scrollHeight;
            } else {
                // Keep the same distance from the bottom (so view stays on same content)
                logContainer.scrollTop = logContainer.scrollHeight - logContainer.clientHeight - distanceFromBottom;
            }
            
            logCountEl.textContent = filtered.length + ' / ' + allLogs.length + ' lines';
        }
        
        function parseLine(line) {
            const match = line.match(logcatRegex);
            if (match) {
                return {
                    raw: line,
                    timestamp: match[1],
                    pid: match[2],
                    tid: match[3],
                    priority: match[4],
                    tag: match[5].trim(),
                    message: match[6]
                };
            }
            
            // Try to at least get the priority
            const priorityMatch = line.match(/\\s([VDIWEF])\\s/);
            return {
                raw: line,
                priority: priorityMatch ? priorityMatch[1] : null,
                tag: ''
            };
        }
        
        function addLogs(lines) {
            const newLogs = lines
                .split('\\n')
                .filter(line => line.trim())
                .map(parseLine);
            
            if (newLogs.length > 0) {
                allLogs.push(...newLogs);
                
                // Keep max 50000 logs in memory
                if (allLogs.length > 50000) {
                    allLogs = allLogs.slice(-40000);
                }
                
                renderLogs();
            }
        }
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'log':
                    addLogs(message.data);
                    break;
                case 'started':
                    setRunning(true);
                    break;
                case 'stopped':
                    setRunning(false);
                    break;
                case 'error':
                    setRunning(false);
                    alert(message.data);
                    break;
            }
        });
        
        // Initial state
        setRunning(false);
    </script>
</body>
</html>
`;
}

/**
 * Open the Logcat Panel
 */
export function openLogcatPanel(context: vscode.ExtensionContext): void {
    if (panel) {
        // Update HTML content in case it changed, then reveal
        panel.webview.html = getWebviewContent();
        panel.reveal(vscode.ViewColumn.Two);
        return;
    }
    
    panel = vscode.window.createWebviewPanel(
        'logcatPanel',
        'Logcat',
        { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );
    
    panel.webview.html = getWebviewContent();
    
    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'start':
                    startAdbLogcat();
                    break;
                case 'stop':
                    stopAdbLogcat();
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
    
    panel.onDidDispose(() => {
        stopAdbLogcat();
        panel = null;
    });
}

/**
 * Start ADB logcat process
 */
function startAdbLogcat(): void {
    if (adbProcess) {
        return;
    }
    
    const adbPath = findAdbPath();
    const args = ['logcat', '-v', 'threadtime'];
    
    try {
        adbProcess = cp.spawn(adbPath, args);
        
        panel?.webview.postMessage({ command: 'started' });
        
        adbProcess.stdout?.on('data', (data: Buffer) => {
            panel?.webview.postMessage({ 
                command: 'log', 
                data: data.toString() 
            });
        });
        
        adbProcess.stderr?.on('data', (data: Buffer) => {
            panel?.webview.postMessage({ 
                command: 'log', 
                data: '[ERROR] ' + data.toString() 
            });
        });
        
        adbProcess.on('close', (code) => {
            adbProcess = null;
            panel?.webview.postMessage({ command: 'stopped' });
        });
        
        adbProcess.on('error', (err) => {
            adbProcess = null;
            panel?.webview.postMessage({ 
                command: 'error', 
                data: 'Failed to start ADB: ' + err.message 
            });
        });
        
    } catch (error) {
        panel?.webview.postMessage({ 
            command: 'error', 
            data: 'Failed to start logcat: ' + error 
        });
    }
}

/**
 * Stop ADB logcat process
 */
function stopAdbLogcat(): void {
    if (adbProcess) {
        adbProcess.kill();
        adbProcess = null;
    }
    panel?.webview.postMessage({ command: 'stopped' });
}

/**
 * Dispose resources
 */
export function dispose(): void {
    stopAdbLogcat();
    if (panel) {
        panel.dispose();
        panel = null;
    }
}
