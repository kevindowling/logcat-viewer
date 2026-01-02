import * as vscode from 'vscode';
import { getConnectedDevices, AndroidDevice } from './deviceManager';

/**
 * Tree item for Android devices
 */
class DeviceTreeItem extends vscode.TreeItem {
    constructor(
        public readonly device: AndroidDevice
    ) {
        super(device.name, vscode.TreeItemCollapsibleState.None);
        
        this.description = device.id;
        this.tooltip = `${device.name}\nID: ${device.id}\nType: ${device.isEmulator ? 'Emulator' : 'Physical Device'}`;
        this.iconPath = new vscode.ThemeIcon(device.isEmulator ? 'vm' : 'device-mobile');
        this.contextValue = 'device';
        
        // Make device runnable with a click
        this.command = {
            command: 'android.runOnDevice',
            title: 'Run on Device',
            arguments: [device]
        };
    }
}

/**
 * Tree item for "No devices" placeholder
 */
class NoDevicesTreeItem extends vscode.TreeItem {
    constructor() {
        super('No devices connected', vscode.TreeItemCollapsibleState.None);
        this.description = 'Connect a device or start emulator';
        this.iconPath = new vscode.ThemeIcon('warning');
    }
}

/**
 * Device tree data provider
 */
export class DeviceTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    
    private devices: AndroidDevice[] = [];
    private selectedDevice: AndroidDevice | undefined;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getSelectedDevice(): AndroidDevice | undefined {
        return this.selectedDevice;
    }

    setSelectedDevice(device: AndroidDevice | undefined): void {
        this.selectedDevice = device;
        this.refresh();
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (element) {
            return [];
        }

        this.devices = await getConnectedDevices();
        
        if (this.devices.length === 0) {
            return [new NoDevicesTreeItem()];
        }

        return this.devices.map(device => {
            const item = new DeviceTreeItem(device);
            // Highlight selected device
            if (this.selectedDevice?.id === device.id) {
                item.description = `${device.id} ✓`;
            }
            return item;
        });
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }
}

/**
 * Action tree item
 */
class ActionTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        public readonly commandId: string,
        icon: string,
        description?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        
        this.description = description;
        this.iconPath = new vscode.ThemeIcon(icon);
        this.command = {
            command: commandId,
            title: label
        };
    }
}

/**
 * Category tree item (collapsible)
 */
class CategoryTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        public readonly children: ActionTreeItem[],
        icon: string,
        expanded: boolean = true
    ) {
        super(label, expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon(icon);
    }
}

/**
 * Actions tree data provider
 */
export class ActionsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private categories: CategoryTreeItem[];

    constructor() {
        this.categories = [
            new CategoryTreeItem('Project', [
                new ActionTreeItem('New Project', 'android.newProject', 'add', 'Create Android app'),
            ], 'folder'),
            new CategoryTreeItem('Build', [
                new ActionTreeItem('Build Debug', 'android.build', 'tools', 'assembleDebug'),
                new ActionTreeItem('Build Release', 'android.buildRelease', 'package', 'assembleRelease'),
                new ActionTreeItem('Clean', 'android.clean', 'trash', 'Clean build files'),
            ], 'wrench'),
            new CategoryTreeItem('Run', [
                new ActionTreeItem('Build & Run', 'android.buildAndRun', 'play', 'Build and launch app'),
                new ActionTreeItem('Install APK', 'android.install', 'desktop-download', 'Install existing APK'),
            ], 'run'),
        ];
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
            return this.categories;
        }

        if (element instanceof CategoryTreeItem) {
            return element.children;
        }

        return [];
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }
}
