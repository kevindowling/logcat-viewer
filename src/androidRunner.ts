import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { pickDevice, installApk, launchApp, AndroidDevice } from './deviceManager';

interface AndroidProjectInfo {
    rootPath: string;
    packageName: string;
    mainActivity: string;
    apkPath: string | null;
}

/**
 * Find Android project info in workspace
 */
async function findAndroidProject(): Promise<AndroidProjectInfo | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return null;
    }

    for (const folder of workspaceFolders) {
        const rootPath = folder.uri.fsPath;
        
        // Check for build.gradle or build.gradle.kts
        const buildGradle = path.join(rootPath, 'app', 'build.gradle');
        const buildGradleKts = path.join(rootPath, 'app', 'build.gradle.kts');
        
        if (!fs.existsSync(buildGradle) && !fs.existsSync(buildGradleKts)) {
            continue;
        }

        // Try to find package name from AndroidManifest.xml
        const manifestPath = path.join(rootPath, 'app', 'src', 'main', 'AndroidManifest.xml');
        let packageName = '';
        let mainActivity = '.MainActivity';

        if (fs.existsSync(manifestPath)) {
            const manifestContent = fs.readFileSync(manifestPath, 'utf8');
            
            // Extract package name
            const packageMatch = manifestContent.match(/package="([^"]+)"/);
            if (packageMatch) {
                packageName = packageMatch[1];
            }
            
            // Try to find main activity
            const activityMatch = manifestContent.match(/android:name="([^"]+)"[^>]*>[\s\S]*?MAIN/);
            if (activityMatch) {
                mainActivity = activityMatch[1];
            }
        }

        // Also check build.gradle for namespace (newer projects)
        if (!packageName) {
            const gradlePath = fs.existsSync(buildGradle) ? buildGradle : buildGradleKts;
            const gradleContent = fs.readFileSync(gradlePath, 'utf8');
            const namespaceMatch = gradleContent.match(/namespace\s*[=\s]['"]([^'"]+)['"]/);
            if (namespaceMatch) {
                packageName = namespaceMatch[1];
            }
        }

        if (!packageName) {
            vscode.window.showErrorMessage('Could not determine package name. Check AndroidManifest.xml or build.gradle');
            return null;
        }

        // Find APK path
        const debugApkPath = path.join(rootPath, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
        const apkPath = fs.existsSync(debugApkPath) ? debugApkPath : null;

        return {
            rootPath,
            packageName,
            mainActivity,
            apkPath
        };
    }

    vscode.window.showErrorMessage('No Android project found in workspace. Make sure you have an app/build.gradle file.');
    return null;
}

/**
 * Run Gradle build
 */
async function runGradleBuild(projectPath: string, task: string = 'assembleDebug'): Promise<boolean> {
    return new Promise((resolve) => {
        const gradlew = path.join(projectPath, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
        
        // Check if gradlew exists
        if (!fs.existsSync(gradlew)) {
            vscode.window.showErrorMessage('Gradle wrapper not found. Please run "gradle wrapper" in your project.');
            resolve(false);
            return;
        }

        // Make gradlew executable on Unix
        if (process.platform !== 'win32') {
            try {
                fs.chmodSync(gradlew, '755');
            } catch (e) {
                // Ignore chmod errors
            }
        }

        const terminal = vscode.window.createTerminal({
            name: 'Android Build',
            cwd: projectPath
        });

        terminal.show();
        terminal.sendText(`${gradlew} ${task}`);

        // We can't easily detect when gradle finishes in terminal
        // So we'll ask the user to confirm
        vscode.window.showInformationMessage(
            'Building... Click "Build Complete" when the Gradle build finishes successfully.',
            'Build Complete',
            'Build Failed'
        ).then(choice => {
            if (choice === 'Build Complete') {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

/**
 * Build and run Android app
 */
export async function buildAndRunAndroid(): Promise<void> {
    const project = await findAndroidProject();
    
    if (!project) {
        return;
    }

    // Pick target device first
    const device = await pickDevice();
    
    if (!device) {
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Android',
        cancellable: false
    }, async (progress) => {
        // Check if APK exists and ask if we should rebuild
        let shouldBuild = true;
        
        if (project.apkPath) {
            const buildChoice = await vscode.window.showQuickPick(
                [
                    { label: '$(play) Run Existing APK', description: 'Skip build, use existing APK', value: 'skip' },
                    { label: '$(tools) Build and Run', description: 'Build new APK and run', value: 'build' },
                ],
                { placeHolder: 'APK already exists. What would you like to do?' }
            );
            
            if (!buildChoice) {
                return;
            }
            
            shouldBuild = buildChoice.value === 'build';
        }

        if (shouldBuild) {
            progress.report({ message: 'Building APK...' });
            const buildSuccess = await runGradleBuild(project.rootPath);
            
            if (!buildSuccess) {
                vscode.window.showErrorMessage('Build failed or was cancelled');
                return;
            }

            // Refresh APK path after build
            const debugApkPath = path.join(project.rootPath, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
            if (!fs.existsSync(debugApkPath)) {
                vscode.window.showErrorMessage('APK not found after build. Check build output for errors.');
                return;
            }
            project.apkPath = debugApkPath;
        }

        if (!project.apkPath) {
            vscode.window.showErrorMessage('No APK found. Please build the project first.');
            return;
        }

        // Install APK
        progress.report({ message: 'Installing APK...' });
        const installSuccess = await installApk(device.id, project.apkPath);
        
        if (!installSuccess) {
            return;
        }

        // Launch app
        progress.report({ message: 'Launching app...' });
        const launchSuccess = await launchApp(device.id, project.packageName, project.mainActivity);
        
        if (launchSuccess) {
            vscode.window.showInformationMessage(`${project.packageName} is now running on ${device.name}`);
        }
    });
}

/**
 * Build Android project without running
 */
export async function buildAndroid(release: boolean = false): Promise<void> {
    const project = await findAndroidProject();
    
    if (!project) {
        return;
    }

    const task = release ? 'assembleRelease' : 'assembleDebug';
    await runGradleBuild(project.rootPath, task);
}

/**
 * Clean Android project
 */
export async function cleanAndroid(): Promise<void> {
    const project = await findAndroidProject();
    
    if (!project) {
        return;
    }

    await runGradleBuild(project.rootPath, 'clean');
}

/**
 * Install APK without building
 */
export async function installAndroid(): Promise<void> {
    const project = await findAndroidProject();
    
    if (!project || !project.apkPath) {
        vscode.window.showErrorMessage('No APK found. Please build the project first.');
        return;
    }

    const device = await pickDevice();
    
    if (!device) {
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Android',
        cancellable: false
    }, async (progress) => {
        progress.report({ message: `Installing APK to ${device.name}...` });
        
        const success = await installApk(device.id, project.apkPath!);
        
        if (success) {
            vscode.window.showInformationMessage(`APK installed to ${device.name}`);
        }
    });
}

/**
 * Run on a specific device (called from tree view)
 */
export async function runOnDevice(device: AndroidDevice): Promise<void> {
    const project = await findAndroidProject();
    
    if (!project) {
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Android',
        cancellable: false
    }, async (progress) => {
        // Check if APK exists and ask if we should rebuild
        let shouldBuild = true;
        
        if (project.apkPath) {
            const buildChoice = await vscode.window.showQuickPick(
                [
                    { label: '$(play) Run Existing APK', description: 'Skip build, use existing APK', value: 'skip' },
                    { label: '$(tools) Build and Run', description: 'Build new APK and run', value: 'build' },
                ],
                { placeHolder: 'APK already exists. What would you like to do?' }
            );
            
            if (!buildChoice) {
                return;
            }
            
            shouldBuild = buildChoice.value === 'build';
        }

        if (shouldBuild) {
            progress.report({ message: 'Building APK...' });
            const buildSuccess = await runGradleBuild(project.rootPath);
            
            if (!buildSuccess) {
                vscode.window.showErrorMessage('Build failed or was cancelled');
                return;
            }

            // Refresh APK path after build
            const debugApkPath = path.join(project.rootPath, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
            if (!fs.existsSync(debugApkPath)) {
                vscode.window.showErrorMessage('APK not found after build. Check build output for errors.');
                return;
            }
            project.apkPath = debugApkPath;
        }

        if (!project.apkPath) {
            vscode.window.showErrorMessage('No APK found. Please build the project first.');
            return;
        }

        // Install APK
        progress.report({ message: `Installing to ${device.name}...` });
        const installSuccess = await installApk(device.id, project.apkPath);
        
        if (!installSuccess) {
            return;
        }

        // Launch app
        progress.report({ message: 'Launching app...' });
        const launchSuccess = await launchApp(device.id, project.packageName, project.mainActivity);
        
        if (launchSuccess) {
            vscode.window.showInformationMessage(`${project.packageName} is now running on ${device.name}`);
        }
    });
}
