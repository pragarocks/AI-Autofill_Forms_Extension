const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Service for external local LLM providers
 * Supports: LM Studio, llama.cpp server, Ollama, Text Generation WebUI, etc.
 */
class ExternalLLMService {
    constructor() {
        this.providers = {};
        this.currentProvider = null;
        this.initializeProviders();
    }

    initializeProviders() {
        // LM Studio (OpenAI-compatible API)
        if (process.env.LM_STUDIO_URL) {
            this.providers.lmstudio = {
                type: 'openai-compatible',
                url: process.env.LM_STUDIO_URL || 'http://localhost:1234/v1',
                name: 'LM Studio',
                available: true
            };
            logger.info(`LM Studio provider configured: ${this.providers.lmstudio.url}`);
        }

        // llama.cpp server
        if (process.env.LLAMACPP_URL) {
            this.providers.llamacpp = {
                type: 'llamacpp',
                url: process.env.LLAMACPP_URL || 'http://localhost:8080',
                name: 'llama.cpp server',
                available: true
            };
            logger.info(`llama.cpp server provider configured: ${this.providers.llamacpp.url}`);
        }

        // Ollama
        if (process.env.OLLAMA_URL) {
            this.providers.ollama = {
                type: 'ollama',
                url: process.env.OLLAMA_URL || 'http://localhost:11434',
                name: 'Ollama',
                available: true
            };
            logger.info(`Ollama provider configured: ${this.providers.ollama.url}`);
        }

        // Text Generation WebUI (oobabooga)
        if (process.env.TEXTGEN_URL) {
            this.providers.textgen = {
                type: 'openai-compatible',
                url: process.env.TEXTGEN_URL || 'http://localhost:5000/v1',
                name: 'Text Generation WebUI',
                available: true
            };
            logger.info(`Text Generation WebUI provider configured: ${this.providers.textgen.url}`);
        }

        // Custom external endpoint
        if (process.env.CUSTOM_LLM_URL) {
            this.providers.custom = {
                type: 'openai-compatible',
                url: process.env.CUSTOM_LLM_URL,
                name: 'Custom LLM',
                available: true
            };
            logger.info(`Custom LLM provider configured: ${this.providers.custom.url}`);
        }

        // Set the first available provider as current
        const availableProviders = Object.keys(this.providers);
        if (availableProviders.length > 0) {
            this.currentProvider = availableProviders[0];
            logger.info(`External LLM service initialized with ${availableProviders.length} provider(s)`);
        }
    }

    async isAvailable() {
        if (!this.currentProvider) return false;
        
        try {
            await this.healthCheck();
            return true;
        } catch (error) {
            logger.warn(`External LLM provider ${this.currentProvider} not available:`, error.message);
            return false;
        }
    }

    async healthCheck() {
        const provider = this.providers[this.currentProvider];
        if (!provider) throw new Error('No provider configured');

        try {
            switch (provider.type) {
                case 'openai-compatible':
                    // Check if /v1/models endpoint is available
                    const response = await axios.get(`${provider.url}/models`, {
                        timeout: 5000,
                        headers: { 'Content-Type': 'application/json' }
                    });
                    return response.status === 200;

                case 'llamacpp':
                    // Check llama.cpp health endpoint
                    const healthResponse = await axios.get(`${provider.url}/health`, {
                        timeout: 5000
                    });
                    return healthResponse.status === 200;

                case 'ollama':
                    // Check Ollama API
                    const ollamaResponse = await axios.get(`${provider.url}/api/tags`, {
                        timeout: 5000
                    });
                    return ollamaResponse.status === 200;

                default:
                    throw new Error(`Unknown provider type: ${provider.type}`);
            }
        } catch (error) {
            throw new Error(`Health check failed: ${error.message}`);
        }
    }

    async generateCompletion(prompt, options = {}) {
        if (!this.currentProvider) {
            throw new Error('No external LLM provider available');
        }

        const provider = this.providers[this.currentProvider];
        logger.info(`Generating completion using ${provider.name}`);

        try {
            switch (provider.type) {
                case 'openai-compatible':
                    return await this.generateOpenAICompatible(provider, prompt, options);
                case 'llamacpp':
                    return await this.generateLlamaCpp(provider, prompt, options);
                case 'ollama':
                    return await this.generateOllama(provider, prompt, options);
                default:
                    throw new Error(`Unsupported provider type: ${provider.type}`);
            }
        } catch (error) {
            logger.error(`External LLM completion error with ${provider.name}:`, error.message);
            
            // Try next available provider
            await this.switchToNextProvider();
            if (this.currentProvider) {
                return await this.generateCompletion(prompt, options);
            }
            
            throw error;
        }
    }

    async generateOpenAICompatible(provider, prompt, options = {}) {
        const requestData = {
            model: options.model || "local-model",
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: options.maxTokens || 150,
            temperature: options.temperature || 0.7,
            stream: false
        };

        const response = await axios.post(`${provider.url}/chat/completions`, requestData, {
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LLM_API_KEY || 'not-needed'}`
            }
        });

        return response.data.choices[0].message.content.trim();
    }

    async generateLlamaCpp(provider, prompt, options = {}) {
        const requestData = {
            prompt: prompt,
            n_predict: options.maxTokens || 150,
            temperature: options.temperature || 0.7,
            stop: ["\n\n", "User:", "Human:"],
            stream: false
        };

        const response = await axios.post(`${provider.url}/completion`, requestData, {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
        });

        return response.data.content.trim();
    }

    async generateOllama(provider, prompt, options = {}) {
        const requestData = {
            model: options.model || "llama2",
            prompt: prompt,
            stream: false,
            options: {
                num_predict: options.maxTokens || 150,
                temperature: options.temperature || 0.7
            }
        };

        const response = await axios.post(`${provider.url}/api/generate`, requestData, {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
        });

        return response.data.response.trim();
    }

    async switchToNextProvider() {
        const providers = Object.keys(this.providers);
        const currentIndex = providers.indexOf(this.currentProvider);
        const nextIndex = (currentIndex + 1) % providers.length;
        
        if (nextIndex !== currentIndex) {
            this.currentProvider = providers[nextIndex];
            logger.info(`Switched to external LLM provider: ${this.providers[this.currentProvider].name}`);
        } else {
            this.currentProvider = null;
            logger.warn('No more external LLM providers available');
        }
    }

    getCurrentProviderInfo() {
        if (!this.currentProvider) return null;
        
        return {
            name: this.providers[this.currentProvider].name,
            type: this.providers[this.currentProvider].type,
            url: this.providers[this.currentProvider].url
        };
    }

    listAvailableProviders() {
        return Object.entries(this.providers).map(([key, provider]) => ({
            id: key,
            name: provider.name,
            type: provider.type,
            url: provider.url,
            available: provider.available
        }));
    }
}

module.exports = ExternalLLMService; 