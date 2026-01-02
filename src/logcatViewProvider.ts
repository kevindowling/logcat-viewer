import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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

export class LogcatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'logcatView';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview();

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'start':
                    this._startAdbLogcat();
                    break;
                case 'stop':
                    this._stopAdbLogcat();
                    break;
                case 'clear':
                    this._clearLogcatBuffer();
                    break;
            }
        });

        // Stop capture when view is disposed
        webviewView.onDidDispose(() => {
            this._stopAdbLogcat();
        });
    }

    private _startAdbLogcat(): void {
        if (adbProcess) {
            return;
        }

        const adbPath = findAdbPath();
        const args = ['logcat', '-v', 'threadtime'];

        try {
            adbProcess = cp.spawn(adbPath, args);

            this._view?.webview.postMessage({ command: 'started' });

            adbProcess.stdout?.on('data', (data: Buffer) => {
                this._view?.webview.postMessage({
                    command: 'log',
                    data: data.toString()
                });
            });

            adbProcess.stderr?.on('data', (data: Buffer) => {
                this._view?.webview.postMessage({
                    command: 'log',
                    data: '[ERROR] ' + data.toString()
                });
            });

            adbProcess.on('close', (code) => {
                adbProcess = null;
                this._view?.webview.postMessage({ command: 'stopped' });
            });

            adbProcess.on('error', (err) => {
                adbProcess = null;
                this._view?.webview.postMessage({
                    command: 'error',
                    data: 'Failed to start ADB: ' + err.message
                });
            });

        } catch (error) {
            this._view?.webview.postMessage({
                command: 'error',
                data: 'Failed to start logcat: ' + error
            });
        }
    }

    private _stopAdbLogcat(): void {
        if (adbProcess) {
            adbProcess.kill();
            adbProcess = null;
        }
        this._view?.webview.postMessage({ command: 'stopped' });
    }

    private _clearLogcatBuffer(): void {
        const adbPath = findAdbPath();
        cp.exec(`${adbPath} logcat -c`, (error) => {
            if (error) {
                this._view?.webview.postMessage({
                    command: 'error',
                    data: 'Failed to clear logcat buffer'
                });
            }
        });
    }

    private _getHtmlForWebview(): string {
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
            gap: 6px;
            padding: 6px 8px;
            background: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            flex-wrap: wrap;
            align-items: center;
        }
        
        .toolbar-row {
            display: flex;
            gap: 6px;
            align-items: center;
            width: 100%;
        }
        
        .toolbar-row.filters {
            padding-top: 4px;
        }
        
        .toolbar label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        input, select {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border, transparent);
            padding: 3px 6px;
            border-radius: 2px;
            font-size: 11px;
        }
        
        input:focus, select:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        
        input[type="text"] {
            flex: 1;
            min-width: 60px;
        }
        
        select {
            min-width: 70px;
        }
        
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 3px 8px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 11px;
            white-space: nowrap;
        }
        
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        button.icon-btn {
            padding: 3px 6px;
            font-size: 14px;
            line-height: 1;
        }
        
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        button.stop {
            background: #c24038;
        }
        
        button.stop:hover {
            background: #d64940;
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #666;
            flex-shrink: 0;
        }
        
        .status-dot.running {
            background: #4ec9b0;
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
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
            line-height: 1.35;
        }
        
        .log-line {
            padding: 1px 8px;
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
        .log-line.E { color: #f44747; }
        .log-line.F { color: #ff00ff; font-weight: bold; }
        
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            gap: 8px;
            font-size: 12px;
        }
        
        .log-count {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            padding: 3px 8px;
            border-top: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBar-background);
            display: flex;
            justify-content: space-between;
        }
        
        .spacer { flex: 1; }
    </style>
</head>
<body>
    <div class="toolbar">
        <div class="toolbar-row">
            <button id="startBtn" class="icon-btn" onclick="startCapture()" title="Start">▶</button>
            <button id="stopBtn" class="icon-btn stop" onclick="stopCapture()" disabled title="Stop">■</button>
            <button class="icon-btn secondary" onclick="clearLogs()" title="Clear">🗑</button>
            <span class="status-dot" id="statusDot"></span>
            <span class="spacer"></span>
            <label><input type="checkbox" id="autoScroll" checked> Lock to bottom</label>
        </div>
        <div class="toolbar-row filters">
            <select id="levelFilter" onchange="applyFilters()" title="Minimum log level">
                <option value="V">V+</option>
                <option value="D">D+</option>
                <option value="I" selected>I+</option>
                <option value="W">W+</option>
                <option value="E">E+</option>
            </select>
            <input type="text" id="tagFilter" placeholder="Tag filter..." oninput="applyFilters()">
            <input type="text" id="searchFilter" placeholder="Search..." oninput="applyFilters()">
        </div>
    </div>
    
    <div class="log-container" id="logContainer">
        <div class="empty-state" id="emptyState">
            <div>No logs yet</div>
            <div>Click ▶ to start capturing</div>
        </div>
    </div>
    
    <div class="log-count">
        <span id="logCount">0 lines</span>
        <span id="statusText"></span>
    </div>
    
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
        let renderPending = false;
        
        const priorityLevels = { V: 0, D: 1, I: 2, W: 3, E: 4, F: 5 };
        
        const logcatRegex = /^(\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}:\\d{2}\\.\\d{3})\\s+(\\d+)\\s+(\\d+)\\s+([VDIWEF])\\s+([^:]+):\\s*(.*)$/;
        
        function startCapture() {
            vscode.postMessage({ command: 'start' });
        }
        
        function stopCapture() {
            vscode.postMessage({ command: 'stop' });
        }
        
        function clearLogs() {
            allLogs = [];
            logContainer.innerHTML = '';
            emptyState.style.display = 'flex';
            logCountEl.textContent = '0 lines';
        }
        
        function setRunning(running) {
            isRunning = running;
            startBtn.disabled = running;
            stopBtn.disabled = !running;
            statusDot.classList.toggle('running', running);
            statusText.textContent = running ? 'Running' : '';
        }
        
        function applyFilters() {
            scheduleRender();
        }
        
        function getFilteredLogs() {
            const levelFilter = document.getElementById('levelFilter').value;
            const tagFilter = document.getElementById('tagFilter').value.toLowerCase();
            const searchFilter = document.getElementById('searchFilter').value.toLowerCase();
            const minLevel = priorityLevels[levelFilter];
            
            return allLogs.filter(log => {
                if (priorityLevels[log.priority] < minLevel) return false;
                if (tagFilter && (!log.tag || !log.tag.toLowerCase().includes(tagFilter))) return false;
                if (searchFilter && !log.raw.toLowerCase().includes(searchFilter)) return false;
                return true;
            });
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function scheduleRender() {
            if (!renderPending) {
                renderPending = true;
                requestAnimationFrame(renderLogs);
            }
        }
        
        function renderLogs() {
            renderPending = false;
            const filtered = getFilteredLogs();
            const autoScroll = document.getElementById('autoScroll').checked;
            const wasAtBottom = logContainer.scrollTop + logContainer.clientHeight >= logContainer.scrollHeight - 50;
            
            if (filtered.length === 0) {
                if (allLogs.length === 0) {
                    emptyState.style.display = 'flex';
                } else {
                    emptyState.style.display = 'none';
                    logContainer.innerHTML = '<div class="empty-state">No matching logs</div>';
                }
                logCountEl.textContent = allLogs.length > 0 ? '0 / ' + allLogs.length + ' lines' : '0 lines';
                return;
            }
            
            emptyState.style.display = 'none';
            
            const toRender = filtered.slice(-3000);
            
            const html = toRender.map(log => 
                '<div class="log-line ' + (log.priority || '') + '">' + escapeHtml(log.raw) + '</div>'
            ).join('');
            
            logContainer.innerHTML = html;
            
            if (autoScroll && (wasAtBottom || isRunning)) {
                logContainer.scrollTop = logContainer.scrollHeight;
            }
            
            logCountEl.textContent = (filtered.length === allLogs.length) 
                ? filtered.length + ' lines'
                : filtered.length + ' / ' + allLogs.length + ' lines';
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
            const priorityMatch = line.match(/\\s([VDIWEF])\\s/);
            return {
                raw: line,
                priority: priorityMatch ? priorityMatch[1] : 'V',
                tag: ''
            };
        }
        
        function addLogs(text) {
            const lines = text.split('\\n').filter(line => line.trim());
            if (lines.length === 0) return;
            
            const newLogs = lines.map(parseLine);
            allLogs.push(...newLogs);
            
            if (allLogs.length > 30000) {
                allLogs = allLogs.slice(-25000);
            }
            
            scheduleRender();
        }
        
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
                    statusText.textContent = message.data;
                    break;
            }
        });
        
        setRunning(false);
    </script>
</body>
</html>
`;
    }
}

export function dispose(): void {
    if (adbProcess) {
        adbProcess.kill();
        adbProcess = null;
    }
}
