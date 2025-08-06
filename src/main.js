const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');
const DocumentProcessor = require('./services/DocumentProcessor');
const RAGSystem = require('./services/RAGSystem');
const LLMService = require('./services/LLMService');
const FormAnalyzer = require('./services/FormAnalyzer');

class AutoFillApp {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.initializeServices();
        this.setupMiddleware();
        this.setupRoutes();
    }

    async initializeServices() {
        try {
            // Initialize core services
            this.ragSystem = new RAGSystem();
            this.documentProcessor = new DocumentProcessor(this.ragSystem);
            this.llmService = new LLMService();
            this.formAnalyzer = new FormAnalyzer();

            // Initialize RAG system
            await this.ragSystem.initialize();
            
            logger.info('All services initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize services:', error);
            process.exit(1);
        }
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // Serve static files for the browser extension
        this.app.use('/extension', express.static(path.join(__dirname, '../extension')));
        
        // Serve test form
        this.app.get('/test-form', (req, res) => {
            res.sendFile(path.join(__dirname, '../test-form.html'));
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });

        // Document upload and processing
        this.app.post('/api/documents/upload', async (req, res) => {
            try {
                const result = await this.documentProcessor.processUpload(req, res);
                res.json(result);
            } catch (error) {
                logger.error('Document upload error:', error);
                res.status(500).json({ error: 'Failed to process document' });
            }
        });

        // Form analysis and suggestion
        this.app.post('/api/forms/analyze', async (req, res) => {
            try {
                const { formData, pageContext } = req.body;
                const suggestions = await this.formAnalyzer.analyzeForms(formData, pageContext);
                res.json(suggestions);
            } catch (error) {
                logger.error('Form analysis error:', error);
                res.status(500).json({ error: 'Failed to analyze form' });
            }
        });

        // Get form field suggestions
        this.app.post('/api/forms/suggest', async (req, res) => {
            try {
                const { fieldName, fieldType, context, currentValue } = req.body;
                
                logger.info(`Form suggestion request for field: ${fieldName} (${fieldType})`);
                
                const suggestion = await this.formAnalyzer.getFieldSuggestion(
                    { name: fieldName, type: fieldType, label: fieldName },
                    context,
                    this.ragSystem,
                    this.llmService
                );
                
                res.json({
                    suggestion: suggestion.suggestion,
                    relevantDocs: suggestion.relevantDocs || []
                });
            } catch (error) {
                logger.error('Error in form suggestion endpoint:', error);
                res.status(500).json({ error: 'Failed to generate suggestion' });
            }
        });

        // Debug endpoint to check RAG system content
        this.app.get('/api/debug/rag', async (req, res) => {
            try {
                const documents = await this.ragSystem.getAllDocuments();
                const chunks = this.ragSystem.db.data.document_chunks;
                
                res.json({
                    documents: documents,
                    totalChunks: chunks.length,
                    sampleChunks: chunks.slice(0, 3).map(chunk => ({
                        id: chunk.id,
                        content: chunk.content.substring(0, 100) + '...',
                        document_id: chunk.document_id
                    }))
                });
            } catch (error) {
                logger.error('Error in debug endpoint:', error);
                res.status(500).json({ error: 'Failed to get debug info' });
            }
        });

        // Auto-fill entire form
        this.app.post('/api/forms/autofill', async (req, res) => {
            try {
                const { formFields, pageContext } = req.body;
                const filledForm = await this.formAnalyzer.autoFillForm(formFields, pageContext);
                res.json(filledForm);
            } catch (error) {
                logger.error('Auto-fill error:', error);
                res.status(500).json({ error: 'Failed to auto-fill form' });
            }
        });

        // Document management
        this.app.get('/api/documents', async (req, res) => {
            try {
                const documents = await this.documentProcessor.listDocuments();
                res.json(documents);
            } catch (error) {
                logger.error('Document listing error:', error);
                res.status(500).json({ error: 'Failed to list documents' });
            }
        });

        // Delete document
        this.app.delete('/api/documents/:id', async (req, res) => {
            try {
                await this.documentProcessor.deleteDocument(req.params.id);
                await this.ragSystem.removeDocument(req.params.id);
                res.json({ success: true });
            } catch (error) {
                logger.error('Document deletion error:', error);
                res.status(500).json({ error: 'Failed to delete document' });
            }
        });
    }

    start() {
        this.app.listen(this.port, () => {
            logger.info(`AI AutoFill server running on port ${this.port}`);
            console.log(`🚀 Server running at http://localhost:${this.port}`);
            console.log(`📋 Extension files available at http://localhost:${this.port}/extension`);
        });
    }
}

// Start the application
const app = new AutoFillApp();
app.start(); 