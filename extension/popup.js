// Popup script for AI AutoFill Extension
class PopupManager {
    constructor() {
        this.serverUrl = 'http://localhost:3000';
        this.stats = {
            formsFilled: 0,
            fieldsFilled: 0,
            documentsLoaded: 0
        };
        
        this.init();
    }

    init() {
        // Load saved stats
        this.loadStats();
        
        // Check server status
        this.checkServerStatus();
        
        // Load extension state
        this.loadExtensionState();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Update document count
        this.updateDocumentCount();
    }

    setupEventListeners() {
        // Toggle AutoFill
        document.getElementById('toggleAutoFill').addEventListener('click', () => {
            this.toggleAutoFill();
        });

        // Fill current form
        document.getElementById('fillCurrentForm').addEventListener('click', () => {
            this.fillCurrentForm();
        });

        // Open dashboard
        document.getElementById('openDashboard').addEventListener('click', () => {
            chrome.tabs.create({ url: `${this.serverUrl}` });
        });

        // Upload document
        document.getElementById('uploadDocument').addEventListener('click', () => {
            this.uploadDocument();
        });

        // Footer links
        document.getElementById('settingsLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.openSettings();
        });

        document.getElementById('helpLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.openHelp();
        });

        document.getElementById('aboutLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.openAbout();
        });
    }

    async loadExtensionState() {
        try {
            const result = await chrome.storage.local.get(['autoFillEnabled']);
            const isEnabled = result.autoFillEnabled !== false; // Default to true
            
            const toggle = document.getElementById('toggleAutoFill');
            if (isEnabled) {
                toggle.classList.add('active');
            } else {
                toggle.classList.remove('active');
            }
        } catch (error) {
            console.error('Error loading extension state:', error);
        }
    }

    async toggleAutoFill() {
        try {
            const toggle = document.getElementById('toggleAutoFill');
            const isCurrentlyActive = toggle.classList.contains('active');
            const newState = !isCurrentlyActive;
            
            // Update UI
            if (newState) {
                toggle.classList.add('active');
            } else {
                toggle.classList.remove('active');
            }
            
            // Save state
            await chrome.storage.local.set({ autoFillEnabled: newState });
            
            // Notify content script
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { 
                        action: 'toggle_autofill',
                        enabled: newState 
                    });
                } catch (error) {
                    console.warn('Could not send message to content script:', error);
                }
            }
            
        } catch (error) {
            console.error('Error toggling AutoFill:', error);
        }
    }

    async fillCurrentForm() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                const response = await chrome.tabs.sendMessage(tab.id, { 
                    action: 'manual_fill' 
                });
                
                if (response && response.success) {
                    this.incrementStat('formsFilled');
                    this.showTemporaryMessage('Form filling initiated!', 'success');
                } else {
                    this.showTemporaryMessage('No form found on current page', 'warning');
                }
            }
        } catch (error) {
            console.error('Error filling form:', error);
            this.showTemporaryMessage('Error: Could not fill form', 'error');
        }
    }

    async uploadDocument() {
        try {
            // Create file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.docx,.txt,.md';
            input.multiple = true;
            
            input.onchange = async (event) => {
                const files = event.target.files;
                if (files.length > 0) {
                    await this.handleFileUpload(files);
                }
            };
            
            input.click();
        } catch (error) {
            console.error('Error uploading document:', error);
            this.showTemporaryMessage('Error uploading document', 'error');
        }
    }

    async handleFileUpload(files) {
        for (const file of files) {
            try {
                const formData = new FormData();
                formData.append('document', file);
                
                const response = await fetch(`${this.serverUrl}/api/documents/upload`, {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    this.incrementStat('documentsLoaded');
                    this.showTemporaryMessage(`${file.name} uploaded successfully!`, 'success');
                } else {
                    throw new Error(`Upload failed: ${response.statusText}`);
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                this.showTemporaryMessage(`Failed to upload ${file.name}`, 'error');
            }
        }
        
        // Update document count
        this.updateDocumentCount();
    }

    async checkServerStatus() {
        try {
            const response = await fetch(`${this.serverUrl}/health`, {
                method: 'GET',
                timeout: 5000
            });
            
            if (response.ok) {
                this.updateServerStatus(true, 'Server online');
            } else {
                this.updateServerStatus(false, 'Server error');
            }
        } catch (error) {
            this.updateServerStatus(false, 'Server offline');
        }
    }

    updateServerStatus(isOnline, statusText) {
        const dot = document.getElementById('serverStatusDot');
        const text = document.getElementById('serverStatusText');
        
        dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
        text.textContent = statusText;
    }

    async updateDocumentCount() {
        try {
            const response = await fetch(`${this.serverUrl}/api/documents`);
            if (response.ok) {
                const documents = await response.json();
                this.updateStat('documentsLoaded', documents.length);
            }
        } catch (error) {
            console.warn('Could not fetch document count:', error);
        }
    }

    async loadStats() {
        try {
            const result = await chrome.storage.local.get(['stats']);
            if (result.stats) {
                this.stats = { ...this.stats, ...result.stats };
                this.updateStatsDisplay();
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    async saveStats() {
        try {
            await chrome.storage.local.set({ stats: this.stats });
        } catch (error) {
            console.error('Error saving stats:', error);
        }
    }

    incrementStat(statName) {
        if (this.stats.hasOwnProperty(statName)) {
            this.stats[statName]++;
            this.updateStat(statName, this.stats[statName]);
            this.saveStats();
        }
    }

    updateStat(statName, value) {
        this.stats[statName] = value;
        this.updateStatsDisplay();
        this.saveStats();
    }

    updateStatsDisplay() {
        document.getElementById('formsFilled').textContent = this.stats.formsFilled;
        document.getElementById('fieldsFilled').textContent = this.stats.fieldsFilled;
        document.getElementById('documentsLoaded').textContent = this.stats.documentsLoaded;
    }

    showTemporaryMessage(message, type = 'info') {
        // Remove existing message
        const existingMessage = document.querySelector('.temp-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        const messageEl = document.createElement('div');
        messageEl.className = 'temp-message';
        messageEl.textContent = message;
        
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        
        messageEl.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            text-align: center;
            z-index: 1000;
        `;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 3000);
    }

    openSettings() {
        // Create a simple settings modal
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 20px; border-radius: 8px; max-width: 300px; width: 90%;">
                    <h3 style="margin-top: 0;">Settings</h3>
                    <p style="font-size: 14px; color: #666;">Settings will be implemented in a future version.</p>
                    <div style="text-align: right; margin-top: 20px;">
                        <button onclick="this.closest('div').parentNode.remove()" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    openHelp() {
        chrome.tabs.create({ 
            url: chrome.runtime.getURL('help.html') 
        });
    }

    openAbout() {
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 20px; border-radius: 8px; max-width: 300px; width: 90%;">
                    <h3 style="margin-top: 0;">About AI AutoFill</h3>
                    <p style="font-size: 14px; color: #666;">
                        Version 1.0.0<br>
                        Intelligent form auto-filling using AI and local documents.<br><br>
                        Features:<br>
                        • Document-based suggestions<br>
                        • Multiple AI providers<br>
                        • Privacy-focused design<br>
                        • Local document processing
                    </p>
                    <div style="text-align: right; margin-top: 20px;">
                        <button onclick="this.closest('div').parentNode.remove()" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

// Initialize popup manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
}); 