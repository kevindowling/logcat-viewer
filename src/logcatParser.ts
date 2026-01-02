/**
 * Logcat Parser
 * Parses Android logcat output into structured log entries
 */

export enum LogPriority {
    VERBOSE = 'V',
    DEBUG = 'D',
    INFO = 'I',
    WARNING = 'W',
    ERROR = 'E',
    FATAL = 'F',
    SILENT = 'S'
}

export interface LogEntry {
    raw: string;
    lineNumber: number;
    timestamp?: Date;
    timestampStr?: string;
    pid?: number;
    tid?: number;
    priority?: LogPriority;
    tag?: string;
    message?: string;
}

// Regex patterns for different logcat formats
// Standard format: "MM-DD HH:MM:SS.mmm  PID  TID PRIORITY TAG: MESSAGE"
const STANDARD_PATTERN = /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+([^:]+):\s*(.*)$/;

// Threadtime format: "MM-DD HH:MM:SS.mmm  PID  TID PRIORITY TAG: MESSAGE"
const THREADTIME_PATTERN = /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+([^:]+):\s*(.*)$/;

// Brief format: "PRIORITY/TAG(PID): MESSAGE"
const BRIEF_PATTERN = /^([VDIWEFS])\/([^\(]+)\(\s*(\d+)\):\s*(.*)$/;

// Tag format: "PRIORITY/TAG: MESSAGE"
const TAG_PATTERN = /^([VDIWEFS])\/([^:]+):\s*(.*)$/;

// Time format: "MM-DD HH:MM:SS.mmm PRIORITY/TAG(PID): MESSAGE"
const TIME_PATTERN = /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+([VDIWEFS])\/([^\(]+)\(\s*(\d+)\):\s*(.*)$/;

// Long format (multi-line): "[ MM-DD HH:MM:SS.mmm  PID: TID PRIORITY/TAG ]"
const LONG_HEADER_PATTERN = /^\[\s*(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+):\s*(\d+)\s+([VDIWEFS])\/([^\s\]]+)\s*\]$/;

/**
 * Parse a single logcat line into a LogEntry
 */
export function parseLogLine(line: string, lineNumber: number): LogEntry {
    const entry: LogEntry = {
        raw: line,
        lineNumber: lineNumber
    };

    // Try standard/threadtime format first (most common)
    let match = line.match(STANDARD_PATTERN);
    if (match) {
        entry.timestampStr = match[1];
        entry.timestamp = parseTimestamp(match[1]);
        entry.pid = parseInt(match[2], 10);
        entry.tid = parseInt(match[3], 10);
        entry.priority = match[4] as LogPriority;
        entry.tag = match[5].trim();
        entry.message = match[6];
        return entry;
    }

    // Try brief format
    match = line.match(BRIEF_PATTERN);
    if (match) {
        entry.priority = match[1] as LogPriority;
        entry.tag = match[2].trim();
        entry.pid = parseInt(match[3], 10);
        entry.message = match[4];
        return entry;
    }

    // Try time format
    match = line.match(TIME_PATTERN);
    if (match) {
        entry.timestampStr = match[1];
        entry.timestamp = parseTimestamp(match[1]);
        entry.priority = match[2] as LogPriority;
        entry.tag = match[3].trim();
        entry.pid = parseInt(match[4], 10);
        entry.message = match[5];
        return entry;
    }

    // Try tag format
    match = line.match(TAG_PATTERN);
    if (match) {
        entry.priority = match[1] as LogPriority;
        entry.tag = match[2].trim();
        entry.message = match[3];
        return entry;
    }

    // Try long format header
    match = line.match(LONG_HEADER_PATTERN);
    if (match) {
        entry.timestampStr = match[1];
        entry.timestamp = parseTimestamp(match[1]);
        entry.pid = parseInt(match[2], 10);
        entry.tid = parseInt(match[3], 10);
        entry.priority = match[4] as LogPriority;
        entry.tag = match[5].trim();
        return entry;
    }

    // Could not parse - return as raw line
    return entry;
}

/**
 * Parse all lines of logcat output
 */
export function parseLogcat(text: string): LogEntry[] {
    const lines = text.split('\n');
    return lines.map((line, index) => parseLogLine(line, index + 1));
}

/**
 * Parse timestamp string to Date object
 */
function parseTimestamp(timestampStr: string): Date {
    // Format: "MM-DD HH:MM:SS.mmm"
    const currentYear = new Date().getFullYear();
    const [datePart, timePart] = timestampStr.trim().split(/\s+/);
    const [month, day] = datePart.split('-').map(n => parseInt(n, 10));
    const [hours, minutes, secondsMs] = timePart.split(':');
    const [seconds, ms] = secondsMs.split('.');
    
    return new Date(
        currentYear,
        month - 1,
        day,
        parseInt(hours, 10),
        parseInt(minutes, 10),
        parseInt(seconds, 10),
        parseInt(ms, 10)
    );
}

/**
 * Get priority level as a numeric value for sorting
 */
export function getPriorityLevel(priority: LogPriority | undefined): number {
    const levels: Record<LogPriority, number> = {
        [LogPriority.VERBOSE]: 0,
        [LogPriority.DEBUG]: 1,
        [LogPriority.INFO]: 2,
        [LogPriority.WARNING]: 3,
        [LogPriority.ERROR]: 4,
        [LogPriority.FATAL]: 5,
        [LogPriority.SILENT]: 6
    };
    return priority ? levels[priority] : -1;
}

/**
 * Format a LogEntry back to string
 */
export function formatLogEntry(entry: LogEntry): string {
    // If we couldn't parse it, return raw
    if (!entry.priority) {
        return entry.raw;
    }

    // Reconstruct in standard format
    const parts: string[] = [];
    
    if (entry.timestampStr) {
        parts.push(entry.timestampStr);
    }
    
    if (entry.pid !== undefined) {
        parts.push(entry.pid.toString().padStart(5));
    }
    
    if (entry.tid !== undefined) {
        parts.push(entry.tid.toString().padStart(5));
    }
    
    parts.push(entry.priority);
    
    if (entry.tag) {
        parts.push(`${entry.tag}:`);
    }
    
    if (entry.message !== undefined) {
        parts.push(entry.message);
    }

    return parts.join(' ');
}
