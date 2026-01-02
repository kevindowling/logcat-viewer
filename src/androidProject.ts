import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ProjectConfig {
    appName: string;
    packageName: string;
    language: 'java' | 'kotlin';
    minSdk: number;
    targetSdk: number;
    compileSdk: number;
    projectPath: string;
}

/**
 * Create a new Android project from templates
 */
export async function createAndroidProject(): Promise<void> {
    // Step 1: Get project location
    const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Project Location'
    });

    if (!folderUri || folderUri.length === 0) {
        return;
    }

    const parentPath = folderUri[0].fsPath;

    // Step 2: Get app name
    const appName = await vscode.window.showInputBox({
        prompt: 'Enter your app name',
        placeHolder: 'My App',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'App name is required';
            }
            return null;
        }
    });

    if (!appName) {
        return;
    }

    // Step 3: Get package name
    const defaultPackage = `com.example.${appName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const packageName = await vscode.window.showInputBox({
        prompt: 'Enter package name',
        value: defaultPackage,
        placeHolder: 'com.example.myapp',
        validateInput: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Package name is required';
            }
            if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value)) {
                return 'Invalid package name. Use lowercase letters, numbers, and dots (e.g., com.example.myapp)';
            }
            return null;
        }
    });

    if (!packageName) {
        return;
    }

    // Step 4: Select language
    const languageChoice = await vscode.window.showQuickPick(
        [
            { label: 'Kotlin', description: 'Recommended for new projects', value: 'kotlin' as const },
            { label: 'Java', description: 'Traditional Android development', value: 'java' as const }
        ],
        { placeHolder: 'Select programming language' }
    );

    if (!languageChoice) {
        return;
    }

    // Step 5: Select minimum SDK
    const sdkOptions = [
        { label: 'API 21 (Android 5.0 Lollipop)', description: '~99% of devices', value: 21 },
        { label: 'API 24 (Android 7.0 Nougat)', description: '~95% of devices', value: 24 },
        { label: 'API 26 (Android 8.0 Oreo)', description: '~90% of devices', value: 26 },
        { label: 'API 29 (Android 10)', description: '~75% of devices', value: 29 },
        { label: 'API 31 (Android 12)', description: '~55% of devices', value: 31 },
    ];

    const minSdkChoice = await vscode.window.showQuickPick(sdkOptions, {
        placeHolder: 'Select minimum SDK version'
    });

    if (!minSdkChoice) {
        return;
    }

    const config: ProjectConfig = {
        appName,
        packageName,
        language: languageChoice.value,
        minSdk: minSdkChoice.value,
        targetSdk: 34,
        compileSdk: 34,
        projectPath: path.join(parentPath, appName.replace(/[^a-zA-Z0-9]/g, ''))
    };

    // Create the project
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Creating Android Project',
        cancellable: false
    }, async (progress) => {
        progress.report({ message: 'Copying template files...' });
        await scaffoldProject(config);
        
        progress.report({ message: 'Done!' });
    });

    // Ask to open the project
    const openChoice = await vscode.window.showInformationMessage(
        `Android project "${appName}" created successfully!`,
        'Open Project',
        'Open in New Window'
    );

    if (openChoice === 'Open Project') {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(config.projectPath), false);
    } else if (openChoice === 'Open in New Window') {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(config.projectPath), true);
    }
}

/**
 * Copy template files and replace placeholders
 */
async function scaffoldProject(config: ProjectConfig): Promise<void> {
    const extensionPath = vscode.extensions.getExtension('kevindowling.logcat-viewer')?.extensionPath;
    
    if (!extensionPath) {
        throw new Error('Could not find extension path');
    }

    const templatePath = path.join(extensionPath, 'templates', config.language);
    const packagePath = config.packageName.replace(/\./g, '/');

    // Create project directory
    if (!fs.existsSync(config.projectPath)) {
        fs.mkdirSync(config.projectPath, { recursive: true });
    }

    // Copy and process all template files
    await copyDirectory(templatePath, config.projectPath, config, packagePath);
}

/**
 * Recursively copy directory and replace placeholders
 */
async function copyDirectory(
    src: string, 
    dest: string, 
    config: ProjectConfig, 
    packagePath: string
): Promise<void> {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        // Handle __PACKAGE_PATH__ directory placeholder
        if (entry.name === '__PACKAGE_PATH__') {
            destPath = path.join(dest, packagePath);
        }

        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            await copyDirectory(srcPath, destPath, config, packagePath);
        } else {
            // Read file content
            let content = fs.readFileSync(srcPath, 'utf8');

            // Replace all placeholders
            content = content
                .replace(/__APP_NAME__/g, config.appName)
                .replace(/__PACKAGE_NAME__/g, config.packageName)
                .replace(/__PACKAGE_PATH__/g, packagePath)
                .replace(/__MIN_SDK__/g, config.minSdk.toString())
                .replace(/__TARGET_SDK__/g, config.targetSdk.toString())
                .replace(/__COMPILE_SDK__/g, config.compileSdk.toString());

            // Write to destination
            fs.writeFileSync(destPath, content, 'utf8');
        }
    }
}
