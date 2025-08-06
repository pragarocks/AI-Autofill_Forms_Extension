// AI AutoFill Content Script
class AutoFillManager {
    constructor() {
        this.serverUrl = 'http://localhost:3000';
        this.currentForm = null;
        this.suggestions = new Map();
        this.isEnabled = true;
        this.keyboardShortcut = 'Enter'; // Trigger auto-fill on Enter
        
        this.init();
    }

    init() {
        console.log('AI AutoFill: Content script loaded');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
        
        // Listen for messages from popup/background
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
        });
    }

    setupEventListeners() {
        // Detect forms on page load
        this.detectForms();
        
        // Monitor for dynamically added forms
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'FORM' || node.querySelector('form')) {
                                this.detectForms();
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Listen for focus events on form fields
        document.addEventListener('focusin', (event) => {
            if (this.isFormField(event.target)) {
                this.handleFieldFocus(event.target);
            }
        });

        // Listen for Enter key to trigger auto-fill
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.ctrlKey && this.isFormField(event.target)) {
                event.preventDefault();
                this.triggerAutoFill(event.target);
            }
        });
    }

    detectForms() {
        const forms = document.querySelectorAll('form');
        console.log(`AI AutoFill: Detected ${forms.length} forms on page`);
        
        forms.forEach(form => {
            if (!form.dataset.aiAutofillProcessed) {
                this.processForm(form);
                form.dataset.aiAutofillProcessed = 'true';
            }
        });
    }

    processForm(form) {
        const formData = this.extractFormData(form);
        
        if (formData.length === 0) return;
        
        console.log('AI AutoFill: Processing form with fields:', formData);
        
        // Add visual indicators to form fields
        this.addFormIndicators(form, formData);
    }

    extractFormData(form) {
        const fields = [];
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            // Skip non-fillable fields
            if (this.shouldSkipField(input)) return;
            
            const fieldData = {
                element: input,
                name: input.name || input.id || '',
                type: input.type || input.tagName.toLowerCase(),
                label: this.getFieldLabel(input),
                placeholder: input.placeholder || '',
                value: input.value || '',
                required: input.required || input.hasAttribute('required')
            };
            
            fields.push(fieldData);
        });
        
        return fields;
    }

    getFieldLabel(element) {
        // Try to find associated label
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.textContent.trim();
        }
        
        // Check parent label
        const parentLabel = element.closest('label');
        if (parentLabel) {
            return parentLabel.textContent.replace(element.value, '').trim();
        }
        
        // Check previous sibling
        let sibling = element.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === 'LABEL' || sibling.textContent.trim()) {
                return sibling.textContent.trim();
            }
            sibling = sibling.previousElementSibling;
        }
        
        // Check placeholder or name as fallback
        return element.placeholder || element.name || '';
    }

    shouldSkipField(element) {
        const type = element.type?.toLowerCase();
        const name = element.name?.toLowerCase() || '';
        const id = element.id?.toLowerCase() || '';
        
        // Skip certain input types
        const skipTypes = ['submit', 'button', 'reset', 'hidden', 'image', 'file'];
        if (skipTypes.includes(type)) return true;
        
        // Skip password fields and other sensitive fields
        if (type === 'password') return true;
        
        // Skip CSRF tokens and similar
        const skipPatterns = ['csrf', 'token', '_token', 'authenticity'];
        if (skipPatterns.some(pattern => name.includes(pattern) || id.includes(pattern))) {
            return true;
        }
        
        return false;
    }

    addFormIndicators(form, formData) {
        form.style.position = 'relative';
        
        // Add AI indicator to form
        if (!form.querySelector('.ai-autofill-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'ai-autofill-indicator';
            indicator.innerHTML = '🤖 AI AutoFill Available (Ctrl+Enter to fill)';
            indicator.style.cssText = `
                position: absolute;
                top: -25px;
                right: 0;
                background: #4CAF50;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 10000;
                cursor: pointer;
            `;
            
            indicator.addEventListener('click', () => {
                this.triggerAutoFill(form.querySelector('input, textarea, select'));
            });
            
            form.appendChild(indicator);
        }
        
        // Add subtle indicators to fillable fields
        formData.forEach(field => {
            if (field.element && !field.element.dataset.aiIndicator) {
                field.element.dataset.aiIndicator = 'true';
                field.element.style.boxShadow = '0 0 2px #4CAF50';
                field.element.title = 'AI AutoFill available (Ctrl+Enter)';
            }
        });
    }

    async handleFieldFocus(element) {
        // Show quick suggestion on focus
        try {
            const suggestion = await this.getFieldSuggestion(element);
            if (suggestion && suggestion.suggestion) {
                this.showQuickSuggestion(element, suggestion);
            }
        } catch (error) {
            console.warn('AI AutoFill: Error getting field suggestion:', error);
        }
    }

    async getFieldSuggestion(element) {
        const form = element.closest('form');
        if (!form) return null;
        
        const formData = this.extractFormData(form);
        const fieldData = formData.find(f => f.element === element);
        
        if (!fieldData) return null;
        
        try {
            const response = await fetch(`${this.serverUrl}/api/forms/suggest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fieldName: fieldData.name,
                    fieldType: fieldData.type,
                    context: this.getPageContext(),
                    currentValue: fieldData.value
                })
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn('AI AutoFill: Server request failed:', error);
        }
        
        return null;
    }

    showQuickSuggestion(element, suggestionData) {
        // Remove existing suggestion
        const existingSuggestion = document.querySelector('.ai-quick-suggestion');
        if (existingSuggestion) {
            existingSuggestion.remove();
        }
        
        if (!suggestionData.suggestion || suggestionData.confidence < 0.5) return;
        
        const suggestion = document.createElement('div');
        suggestion.className = 'ai-quick-suggestion';
        suggestion.innerHTML = `
            <div class="ai-suggestion-content">
                <span class="ai-suggestion-text">${suggestionData.suggestion}</span>
                <span class="ai-confidence">${Math.round(suggestionData.confidence * 100)}%</span>
                <button class="ai-apply-btn">Apply</button>
                <button class="ai-close-btn">×</button>
            </div>
        `;
        
        suggestion.style.cssText = `
            position: absolute;
            background: white;
            border: 2px solid #4CAF50;
            border-radius: 6px;
            padding: 8px;
            z-index: 10001;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 300px;
        `;
        
        // Position near the element
        const rect = element.getBoundingClientRect();
        suggestion.style.left = `${rect.left}px`;
        suggestion.style.top = `${rect.bottom + window.scrollY + 5}px`;
        
        // Event listeners
        suggestion.querySelector('.ai-apply-btn').addEventListener('click', () => {
            element.value = suggestionData.suggestion;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            suggestion.remove();
        });
        
        suggestion.querySelector('.ai-close-btn').addEventListener('click', () => {
            suggestion.remove();
        });
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (suggestion.parentNode) {
                suggestion.remove();
            }
        }, 10000);
        
        document.body.appendChild(suggestion);
    }

    async triggerAutoFill(element) {
        const form = element.closest('form');
        if (!form) {
            console.warn('AI AutoFill: No form found for element');
            return;
        }
        
        console.log('AI AutoFill: Triggering auto-fill for form');
        
        // Show loading indicator
        this.showLoadingIndicator(form);
        
        try {
            const formData = this.extractFormData(form);
            const response = await this.requestAutoFill(formData);
            
            if (response && response.fields) {
                await this.applyAutoFill(response.fields);
                this.showSuccessMessage(form, response.summary);
            } else {
                this.showErrorMessage(form, 'No suggestions available');
            }
        } catch (error) {
            console.error('AI AutoFill: Error during auto-fill:', error);
            this.showErrorMessage(form, 'Auto-fill failed. Please check server connection.');
        } finally {
            this.hideLoadingIndicator();
        }
    }

    async requestAutoFill(formData) {
        const payload = {
            formFields: formData.map(field => ({
                name: field.name,
                type: field.type,
                label: field.label,
                placeholder: field.placeholder,
                value: field.value,
                required: field.required
            })),
            pageContext: this.getPageContext()
        };
        
        const response = await fetch(`${this.serverUrl}/api/forms/autofill`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        
        return await response.json();
    }

    async applyAutoFill(suggestions) {
        for (const suggestion of suggestions) {
            if (suggestion.suggestion && suggestion.confidence > 0.5) {
                const element = document.querySelector(`[name="${suggestion.name}"], #${suggestion.name}`);
                if (element && !this.shouldSkipField(element)) {
                    element.value = suggestion.suggestion;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Add visual feedback
                    element.style.backgroundColor = '#e8f5e8';
                    setTimeout(() => {
                        element.style.backgroundColor = '';
                    }, 2000);
                }
            }
        }
    }

    getPageContext() {
        return {
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname,
            description: document.querySelector('meta[name="description"]')?.content || '',
            pageText: document.body.innerText.substring(0, 500)
        };
    }

    showLoadingIndicator(form) {
        const loading = document.createElement('div');
        loading.className = 'ai-loading-indicator';
        loading.innerHTML = '🤖 AI is analyzing and filling form...';
        loading.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2196F3;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10002;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(loading);
    }

    hideLoadingIndicator() {
        const loading = document.querySelector('.ai-loading-indicator');
        if (loading) loading.remove();
    }

    showSuccessMessage(form, summary) {
        const message = document.createElement('div');
        message.className = 'ai-success-message';
        message.innerHTML = `
            ✅ Auto-fill complete!<br>
            Filled: ${summary.filledFields}/${summary.totalFields} fields<br>
            Confidence: ${Math.round(summary.confidence * 100)}%
        `;
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10002;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.remove();
            }
        }, 5000);
    }

    showErrorMessage(form, errorText) {
        const message = document.createElement('div');
        message.className = 'ai-error-message';
        message.innerHTML = `❌ ${errorText}`;
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10002;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.remove();
            }
        }, 5000);
    }

    isFormField(element) {
        const formFields = ['INPUT', 'TEXTAREA', 'SELECT'];
        return formFields.includes(element.tagName) && !this.shouldSkipField(element);
    }

    handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'toggle_autofill':
                this.isEnabled = !this.isEnabled;
                sendResponse({ enabled: this.isEnabled });
                break;
                
            case 'get_form_info':
                const forms = document.querySelectorAll('form');
                const formInfo = Array.from(forms).map(form => ({
                    fields: this.extractFormData(form).length,
                    action: form.action,
                    method: form.method
                }));
                sendResponse({ forms: formInfo });
                break;
                
            case 'manual_fill':
                if (document.activeElement && this.isFormField(document.activeElement)) {
                    this.triggerAutoFill(document.activeElement);
                }
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ error: 'Unknown action' });
        }
    }
}

// Initialize the AutoFill manager
const autoFillManager = new AutoFillManager(); 