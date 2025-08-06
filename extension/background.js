// Background script for AI AutoFill Extension
class BackgroundManager {
    constructor() {
        this.serverUrl = 'http://localhost:3000';
        this.init();
    }

    init() {
        // Listen for extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstallation(details);
        });

        // Listen for messages from content scripts and popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Listen for tab updates to inject content script if needed
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // Set up context menu items
        this.setupContextMenu();

        // Check server status periodically
        this.startServerHealthCheck();
    }

    handleInstallation(details) {
        if (details.reason === 'install') {
            // First time installation
            console.log('AI AutoFill Extension installed');
            
            // Set default settings
            chrome.storage.local.set({
                autoFillEnabled: true,
                stats: {
                    formsFilled: 0,
                    fieldsFilled: 0,
                    documentsLoaded: 0
                }
            });

            // Open welcome page
            chrome.tabs.create({
                url: chrome.runtime.getURL('welcome.html')
            });
        } else if (details.reason === 'update') {
            console.log('AI AutoFill Extension updated');
        }
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'server_health':
                    const health = await this.checkServerHealth();
                    sendResponse(health);
                    break;

                case 'get_settings':
                    const settings = await this.getSettings();
                    sendResponse(settings);
                    break;

                case 'save_settings':
                    await this.saveSettings(request.settings);
                    sendResponse({ success: true });
                    break;

                case 'get_stats':
                    const stats = await this.getStats();
                    sendResponse(stats);
                    break;

                case 'update_stats':
                    await this.updateStats(request.stats);
                    sendResponse({ success: true });
                    break;

                case 'upload_document':
                    const uploadResult = await this.uploadDocument(request.file);
                    sendResponse(uploadResult);
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ error: error.message });
        }
    }

    handleTabUpdate(tabId, changeInfo, tab) {
        // Re-inject content script if tab is refreshed
        if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
            chrome.tabs.sendMessage(tabId, { action: 'ping' }).catch(() => {
                // Content script not available, it will be injected automatically
                console.log('Content script will be injected automatically');
            });
        }
    }

    setupContextMenu() {
        chrome.contextMenus.removeAll(() => {
            // Add context menu for input fields
            chrome.contextMenus.create({
                id: 'ai-autofill-field',
                title: 'AI AutoFill this field',
                contexts: ['editable']
            });

            // Add context menu for forms
            chrome.contextMenus.create({
                id: 'ai-autofill-form',
                title: 'AI AutoFill entire form',
                contexts: ['page']
            });

            // Add separator
            chrome.contextMenus.create({
                type: 'separator',
                contexts: ['editable', 'page']
            });

            // Add settings option
            chrome.contextMenus.create({
                id: 'ai-autofill-settings',
                title: 'AI AutoFill Settings',
                contexts: ['editable', 'page']
            });
        });

        // Handle context menu clicks
        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenuClick(info, tab);
        });
    }

    async handleContextMenuClick(info, tab) {
        try {
            switch (info.menuItemId) {
                case 'ai-autofill-field':
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'fill_focused_field'
                    });
                    break;

                case 'ai-autofill-form':
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'manual_fill'
                    });
                    break;

                case 'ai-autofill-settings':
                    await chrome.tabs.create({
                        url: `${this.serverUrl}`
                    });
                    break;
            }
        } catch (error) {
            console.error('Context menu action failed:', error);
        }
    }

    async checkServerHealth() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${this.serverUrl}/health`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                return { status: 'online', data };
            } else {
                return { status: 'error', error: response.statusText };
            }
        } catch (error) {
            return { status: 'offline', error: error.message };
        }
    }

    startServerHealthCheck() {
        // Check server health every 5 minutes
        setInterval(async () => {
            const health = await this.checkServerHealth();
            
            // Update badge based on server status
            if (health.status === 'online') {
                chrome.action.setBadgeText({ text: '' });
                chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
            } else {
                chrome.action.setBadgeText({ text: '!' });
                chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
            }
        }, 5 * 60 * 1000); // 5 minutes

        // Initial check
        this.checkServerHealth().then(health => {
            if (health.status !== 'online') {
                chrome.action.setBadgeText({ text: '!' });
                chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
            }
        });
    }

    async getSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['autoFillEnabled', 'serverUrl', 'shortcutKey'], (result) => {
                resolve({
                    autoFillEnabled: result.autoFillEnabled !== false,
                    serverUrl: result.serverUrl || this.serverUrl,
                    shortcutKey: result.shortcutKey || 'Enter'
                });
            });
        });
    }

    async saveSettings(settings) {
        return new Promise((resolve) => {
            chrome.storage.local.set(settings, () => {
                resolve();
            });
        });
    }

    async getStats() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['stats'], (result) => {
                resolve(result.stats || {
                    formsFilled: 0,
                    fieldsFilled: 0,
                    documentsLoaded: 0
                });
            });
        });
    }

    async updateStats(newStats) {
        const currentStats = await this.getStats();
        const updatedStats = { ...currentStats, ...newStats };
        
        return new Promise((resolve) => {
            chrome.storage.local.set({ stats: updatedStats }, () => {
                resolve();
            });
        });
    }

    async uploadDocument(fileData) {
        try {
            const formData = new FormData();
            const blob = new Blob([fileData.content], { type: fileData.type });
            formData.append('document', blob, fileData.name);

            const response = await fetch(`${this.serverUrl}/api/documents/upload`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                
                // Update document count in stats
                const stats = await this.getStats();
                await this.updateStats({
                    documentsLoaded: stats.documentsLoaded + 1
                });

                return { success: true, result };
            } else {
                throw new Error(`Upload failed: ${response.statusText}`);
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Utility method to broadcast messages to all content scripts
    async broadcastToContentScripts(message) {
        try {
            const tabs = await chrome.tabs.query({});
            
            for (const tab of tabs) {
                if (tab.url && !tab.url.startsWith('chrome://')) {
                    try {
                        await chrome.tabs.sendMessage(tab.id, message);
                    } catch (error) {
                        // Ignore errors for tabs without content script
                    }
                }
            }
        } catch (error) {
            console.error('Error broadcasting to content scripts:', error);
        }
    }

    // Handle keyboard shortcuts
    async handleCommand(command) {
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (activeTab) {
                switch (command) {
                    case 'fill-form':
                        await chrome.tabs.sendMessage(activeTab.id, {
                            action: 'manual_fill'
                        });
                        break;
                        
                    case 'toggle-autofill':
                        const settings = await this.getSettings();
                        await this.saveSettings({
                            autoFillEnabled: !settings.autoFillEnabled
                        });
                        
                        await chrome.tabs.sendMessage(activeTab.id, {
                            action: 'toggle_autofill',
                            enabled: !settings.autoFillEnabled
                        });
                        break;
                }
            }
        } catch (error) {
            console.error('Command handling error:', error);
        }
    }
}

// Initialize background manager
const backgroundManager = new BackgroundManager();

// Handle keyboard commands if they're defined
if (chrome.commands) {
    chrome.commands.onCommand.addListener((command) => {
        backgroundManager.handleCommand(command);
    });
} 