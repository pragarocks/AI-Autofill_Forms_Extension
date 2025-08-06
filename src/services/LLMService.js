const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Anthropic = require('@anthropic-ai/sdk');
const { spawn } = require('child_process');
const path = require('path');

const logger = require('../utils/logger');

class LLMService {
    constructor() {
        this.providers = {};
        this.currentProvider = null;
        this.localLLMEnabled = process.env.LOCAL_LLM_ENABLED === 'true';
        
        this.initializeProviders();
    }

    initializeProviders() {
        // Initialize OpenAI
        if (process.env.OPENAI_API_KEY) {
            this.providers.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
            this.currentProvider = 'openai';
            logger.info('OpenAI provider initialized');
        }

        // Initialize Google Gemini
        if (process.env.GOOGLE_API_KEY) {
            this.providers.google = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
            if (!this.currentProvider) this.currentProvider = 'google';
            logger.info('Google Gemini provider initialized');
        }

        // Initialize Anthropic
        if (process.env.ANTHROPIC_API_KEY) {
            this.providers.anthropic = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY,
            });
            if (!this.currentProvider) this.currentProvider = 'anthropic';
            logger.info('Anthropic provider initialized');
        }

        // Local LLM support (for future implementation)
        if (this.localLLMEnabled) {
            this.initializeLocalLLM();
        }

        if (!this.currentProvider) {
            logger.warn('No LLM providers configured. Please add API keys to environment variables.');
        }
    }

    initializeLocalLLM() {
        try {
            // Initialize local GGUF model support
            this.providers.local = {
                type: 'simple',
                modelPath: process.env.LOCAL_LLM_PATH || './models/gemma-3n-E2B-it-IQ4_XS.gguf',
                pythonScript: path.join(__dirname, '../local_llm/simple_llm.py')
            };
            
            if (!this.currentProvider) this.currentProvider = 'local';
            logger.info('Local GGUF LLM provider initialized');
        } catch (error) {
            logger.warn('Local LLM initialization failed:', error.message);
        }
    }

    async generateFieldSuggestion(options) {
        const {
            fieldName,
            fieldType,
            context,
            currentValue,
            relevantDocs
        } = options;

        const prompt = this.buildFieldSuggestionPrompt({
            fieldName,
            fieldType,
            context,
            currentValue,
            relevantDocs
        });

        try {
            const response = await this.generateCompletion(prompt);
            return this.parseFieldSuggestion(response, fieldType);
        } catch (error) {
            logger.error('Error generating field suggestion:', error);
            throw error;
        }
    }

    buildFieldSuggestionPrompt({ fieldName, fieldType, context, currentValue, relevantDocs }) {
        let prompt = `You are an intelligent form auto-fill assistant. Your task is to suggest appropriate values for form fields based on available documents and context.

Field Details:
- Field Name: ${fieldName}
- Field Type: ${fieldType}
- Current Value: ${currentValue || 'empty'}
- Page Context: ${context}

`;

        if (relevantDocs && relevantDocs.length > 0) {
            prompt += `Relevant Document Information:\n`;
            relevantDocs.forEach((doc, index) => {
                prompt += `${index + 1}. From ${doc.fileName || 'document'} (similarity: ${doc.similarity?.toFixed(2) || 'N/A'}):\n`;
                prompt += `   ${doc.content.substring(0, 300)}${doc.content.length > 300 ? '...' : ''}\n\n`;
            });
        }

        prompt += `Instructions:
1. Analyze the field name, type, and context to understand what information is needed
2. Extract relevant information from the provided documents
3. Suggest the most appropriate value for this field
4. If multiple options are possible, provide the most likely one
5. For sensitive information (SSN, passwords, etc.), respond with "SENSITIVE_FIELD"
6. If no relevant information is found, respond with "NO_DATA_AVAILABLE"

Response format:
- For text fields: provide the exact text to fill
- For select/dropdown: provide the exact option value
- For checkboxes: provide "true" or "false"
- For dates: provide in YYYY-MM-DD format
- For phone numbers: provide in standardized format
- For emails: provide the email address

Suggested value:`;

        return prompt;
    }

    async generateCompletion(prompt, options = {}) {
        if (!this.currentProvider) {
            throw new Error('No LLM provider available');
        }

        const maxRetries = 3;
        let lastError;

        for (let i = 0; i < maxRetries; i++) {
            try {
                switch (this.currentProvider) {
                    case 'openai':
                        return await this.generateOpenAICompletion(prompt, options);
                    case 'google':
                        return await this.generateGoogleCompletion(prompt, options);
                    case 'anthropic':
                        return await this.generateAnthropicCompletion(prompt, options);
                    case 'local':
                        return await this.generateLocalCompletion(prompt, options);
                    default:
                        throw new Error(`Unknown provider: ${this.currentProvider}`);
                }
            } catch (error) {
                lastError = error;
                logger.warn(`Attempt ${i + 1} failed for provider ${this.currentProvider}:`, error.message);
                
                // Try next available provider
                await this.switchToNextProvider();
                
                if (!this.currentProvider) {
                    break;
                }
            }
        }

        throw lastError || new Error('All LLM providers failed');
    }

    async generateOpenAICompletion(prompt, options = {}) {
        const response = await this.providers.openai.chat.completions.create({
            model: options.model || 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: options.maxTokens || 150,
            temperature: options.temperature || 0.3,
        });

        return response.choices[0].message.content.trim();
    }

    async generateGoogleCompletion(prompt, options = {}) {
        const model = this.providers.google.getGenerativeModel({ 
            model: options.model || 'gemini-2.5-flash' 
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    }

    async generateAnthropicCompletion(prompt, options = {}) {
        const response = await this.providers.anthropic.messages.create({
            model: options.model || 'claude-3-haiku-20240307',
            max_tokens: options.maxTokens || 150,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });

        return response.content[0].text.trim();
    }

    async generateLocalCompletion(prompt, options = {}) {
        try {
            const maxTokens = options.maxTokens || 150;
            const temperature = options.temperature || 0.3;
            
            const provider = this.providers.local;
            if (!provider || provider.type !== 'simple') {
                throw new Error('Local simple provider not available');
            }

            // Call Python script for GGUF inference
            const result = await this.callPythonScript(provider.pythonScript, [
                'generate',
                prompt,
                maxTokens.toString(),
                temperature.toString()
            ]);

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.success) {
                return { text: result.text };
            } else {
                throw new Error('Local LLM generation failed');
            }

        } catch (error) {
            logger.error('Local LLM completion error:', error);
            throw error;
        }
    }

    async callPythonScript(scriptPath, args = []) {
        return new Promise((resolve, reject) => {
            const python = spawn('python', [scriptPath, ...args]);
            let output = '';
            let errorOutput = '';

            python.stdout.on('data', (data) => {
                output += data.toString();
            });

            python.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python script failed: ${errorOutput}`));
                    return;
                }

                try {
                    const result = JSON.parse(output.trim());
                    resolve(result);
                } catch (parseError) {
                    reject(new Error(`Failed to parse Python output: ${output}`));
                }
            });

            python.on('error', (error) => {
                reject(new Error(`Failed to start Python script: ${error.message}`));
            });
        });
    }

    switchToNextProvider() {
        const providers = Object.keys(this.providers);
        const currentIndex = providers.indexOf(this.currentProvider);
        const nextIndex = (currentIndex + 1) % providers.length;
        
        // Don't switch to the same provider
        if (nextIndex === currentIndex) {
            this.currentProvider = null;
            return;
        }
        
        this.currentProvider = providers[nextIndex];
        logger.info(`Switched to LLM provider: ${this.currentProvider}`);
    }

    parseFieldSuggestion(response, fieldType) {
        const cleanResponse = response.trim();
        
        // Handle special responses
        if (cleanResponse === 'SENSITIVE_FIELD') {
            return {
                suggestion: '',
                confidence: 0,
                reason: 'Sensitive field detected'
            };
        }
        
        if (cleanResponse === 'NO_DATA_AVAILABLE') {
            return {
                suggestion: '',
                confidence: 0,
                reason: 'No relevant data found'
            };
        }

        // Parse based on field type
        let suggestion = cleanResponse;
        let confidence = 0.8; // Default confidence

        switch (fieldType?.toLowerCase()) {
            case 'email':
                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (emailRegex.test(suggestion)) {
                    confidence = 0.9;
                } else {
                    confidence = 0.3;
                }
                break;
                
            case 'phone':
            case 'tel':
                // Format phone number
                suggestion = this.formatPhoneNumber(suggestion);
                confidence = suggestion ? 0.8 : 0.3;
                break;
                
            case 'date':
                // Validate and format date
                suggestion = this.formatDate(suggestion);
                confidence = suggestion ? 0.8 : 0.3;
                break;
                
            case 'checkbox':
                suggestion = cleanResponse.toLowerCase() === 'true';
                confidence = 0.7;
                break;
                
            case 'number':
                const num = parseFloat(suggestion);
                if (!isNaN(num)) {
                    suggestion = num.toString();
                    confidence = 0.8;
                } else {
                    confidence = 0.2;
                }
                break;
        }

        return {
            suggestion,
            confidence,
            reason: 'Generated from document analysis'
        };
    }

    formatPhoneNumber(phone) {
        // Basic phone number formatting
        const cleaned = phone.replace(/\D/g, '');
        
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        } else if (cleaned.length === 11 && cleaned[0] === '1') {
            return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
        }
        
        return phone; // Return original if can't format
    }

    formatDate(dateStr) {
        try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0]; // YYYY-MM-DD format
            }
        } catch (error) {
            // Ignore parse errors
        }
        return null;
    }

    async generateFormAnalysis(formData, pageContext) {
        const prompt = `Analyze this web form and provide intelligent suggestions for auto-filling:

Page Context: ${pageContext}

Form Fields:
${formData.map(field => `- ${field.name} (${field.type}): ${field.label || 'No label'}`).join('\n')}

Provide analysis on:
1. What type of form this appears to be (contact, registration, application, etc.)
2. Which fields are likely required vs optional
3. Suggested filling priority order
4. Any fields that should be skipped (sensitive/security fields)

Response in JSON format:
{
  "formType": "string",
  "priority": ["field1", "field2", ...],
  "skipFields": ["sensitiveField1", ...],
  "suggestions": {
    "fieldName": "suggestion"
  }
}`;

        try {
            const response = await this.generateCompletion(prompt);
            return JSON.parse(response);
        } catch (error) {
            logger.error('Error generating form analysis:', error);
            return {
                formType: 'unknown',
                priority: formData.map(f => f.name),
                skipFields: [],
                suggestions: {}
            };
        }
    }

    // Health check for LLM providers
    async healthCheck() {
        const status = {
            providers: {},
            currentProvider: this.currentProvider,
            localLLMEnabled: this.localLLMEnabled
        };

        for (const [name, provider] of Object.entries(this.providers)) {
            try {
                // Simple test completion
                await this.generateCompletion('Test', { maxTokens: 5 });
                status.providers[name] = 'healthy';
            } catch (error) {
                status.providers[name] = 'error';
            }
        }

        return status;
    }

    // Switch provider manually
    setProvider(providerName) {
        if (this.providers[providerName]) {
            this.currentProvider = providerName;
            logger.info(`Manually switched to provider: ${providerName}`);
            return true;
        }
        return false;
    }

    getAvailableProviders() {
        return Object.keys(this.providers);
    }
}

module.exports = LLMService; 