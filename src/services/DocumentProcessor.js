const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const chokidar = require('chokidar');

const logger = require('../utils/logger');

class DocumentProcessor {
    constructor(ragSystem = null) {
        this.documentsPath = process.env.DOCUMENTS_PATH || './documents';
        this.supportedFormats = ['.pdf', '.docx', '.txt', '.md'];
        this.documents = new Map();
        this.ragSystem = ragSystem;
        
        // Ensure documents directory exists
        fs.ensureDirSync(this.documentsPath);
        
        // Set up file upload handling
        this.setupMulter();
        
        // Set up file watcher for automatic processing
        this.setupFileWatcher();
        
        // Load existing documents on startup
        this.loadExistingDocuments();
    }

    setupMulter() {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, this.documentsPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
            }
        });

        this.upload = multer({
            storage: storage,
            limits: {
                fileSize: 50 * 1024 * 1024 // 50MB limit
            },
            fileFilter: (req, file, cb) => {
                const ext = path.extname(file.originalname).toLowerCase();
                if (this.supportedFormats.includes(ext)) {
                    cb(null, true);
                } else {
                    cb(new Error(`Unsupported file format: ${ext}`));
                }
            }
        });
    }

    setupFileWatcher() {
        // Disable file watcher to prevent continuous restarting
        // this.watcher = chokidar.watch(this.documentsPath, {
        //     ignored: /^\./, 
        //     persistent: true,
        //     ignoreInitial: true // Don't process files on startup
        // });

        // this.watcher
        //     .on('add', filePath => this.processFile(filePath))
        //     .on('change', filePath => this.processFile(filePath))
        //     .on('unlink', filePath => this.removeFile(filePath));
        
        logger.info('File watcher disabled to prevent continuous restarting');
    }

    async loadExistingDocuments() {
        try {
            const files = await fs.readdir(this.documentsPath);
            let processedCount = 0;
            
            for (const file of files) {
                const filePath = path.join(this.documentsPath, file);
                const ext = path.extname(filePath).toLowerCase();
                
                if (this.supportedFormats.includes(ext)) {
                    // Check if already processed
                    const existingDoc = Array.from(this.documents.values()).find(doc => 
                        doc.metadata.fileName === file && 
                        doc.metadata.filePath === filePath
                    );
                    
                    if (!existingDoc) {
                        await this.processFile(filePath);
                        processedCount++;
                    }
                }
            }
            
            logger.info(`Loaded ${processedCount} new documents, total: ${this.documents.size}`);
        } catch (error) {
            logger.error('Error loading existing documents:', error);
        }
    }

    async processFile(filePath) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            if (!this.supportedFormats.includes(ext)) {
                return;
            }

            const stats = await fs.stat(filePath);
            const fileName = path.basename(filePath);
            
            // Check if file is already processed
            const existingDoc = Array.from(this.documents.values()).find(doc => 
                doc.metadata.fileName === fileName && 
                doc.metadata.filePath === filePath
            );
            
            if (existingDoc) {
                logger.info(`File ${fileName} already processed, skipping`);
                return existingDoc;
            }
            
            const fileId = uuidv4();

            logger.info(`Processing file: ${fileName}`);

            let content = '';
            let metadata = {
                id: fileId,
                fileName,
                filePath,
                fileSize: stats.size,
                lastModified: stats.mtime,
                type: ext,
                processed: new Date()
            };

            switch (ext) {
                case '.pdf':
                    content = await this.processPDF(filePath);
                    break;
                case '.docx':
                    content = await this.processWord(filePath);
                    break;
                case '.txt':
                case '.md':
                    content = await this.processText(filePath);
                    break;
                default:
                    throw new Error(`Unsupported file type: ${ext}`);
            }

            // Extract additional metadata from content
            metadata = {
                ...metadata,
                ...this.extractMetadata(content, fileName)
            };

            const documentData = {
                content,
                metadata,
                chunks: this.chunkContent(content)
            };

            this.documents.set(fileId, documentData);

            // Add to RAG system if available
            if (this.ragSystem) {
                try {
                    await this.ragSystem.addDocument(fileId, documentData);
                    logger.info(`Added document ${fileName} to RAG system`);
                } catch (error) {
                    logger.error(`Error adding document ${fileName} to RAG system:`, error);
                }
            }

            logger.info(`Successfully processed: ${fileName} (${content.length} characters)`);
            return { fileId, metadata, content };

        } catch (error) {
            logger.error(`Error processing file ${filePath}:`, error);
            throw error;
        }
    }

    async processPDF(filePath) {
        try {
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text;
        } catch (error) {
            logger.error(`Error processing PDF ${filePath}:`, error);
            throw error;
        }
    }

    async processWord(filePath) {
        try {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } catch (error) {
            logger.error(`Error processing Word document ${filePath}:`, error);
            throw error;
        }
    }

    async processText(filePath) {
        try {
            return await fs.readFile(filePath, 'utf8');
        } catch (error) {
            logger.error(`Error processing text file ${filePath}:`, error);
            throw error;
        }
    }

    extractMetadata(content, fileName) {
        const lines = content.split('\n');
        const wordCount = content.split(/\s+/).length;
        
        // Try to extract common personal information patterns
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        const datePattern = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g;

        const emails = content.match(emailPattern) || [];
        const phones = content.match(phonePattern) || [];
        const dates = content.match(datePattern) || [];

        return {
            lineCount: lines.length,
            wordCount,
            characterCount: content.length,
            extractedEmails: [...new Set(emails)],
            extractedPhones: [...new Set(phones)],
            extractedDates: [...new Set(dates)],
            preview: content.substring(0, 200) + (content.length > 200 ? '...' : '')
        };
    }

    chunkContent(content, chunkSize = 1000, overlap = 200) {
        const chunks = [];
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        let currentChunk = '';
        let chunkIndex = 0;

        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
                chunks.push({
                    index: chunkIndex++,
                    content: currentChunk.trim(),
                    length: currentChunk.length
                });

                // Create overlap for better context
                const words = currentChunk.split(' ');
                const overlapWords = words.slice(-Math.floor(overlap / 5)); // Rough estimate
                currentChunk = overlapWords.join(' ') + ' ' + sentence;
            } else {
                currentChunk += sentence + '. ';
            }
        }

        // Add the last chunk
        if (currentChunk.trim().length > 0) {
            chunks.push({
                index: chunkIndex,
                content: currentChunk.trim(),
                length: currentChunk.length
            });
        }

        return chunks;
    }

    async processUpload(req, res) {
        return new Promise((resolve, reject) => {
            this.upload.single('document')(req, res, async (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!req.file) {
                    reject(new Error('No file uploaded'));
                    return;
                }

                try {
                    const result = await this.processFile(req.file.path);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    removeFile(filePath) {
        // Find and remove document by file path
        for (const [id, doc] of this.documents) {
            if (doc.metadata.filePath === filePath) {
                this.documents.delete(id);
                logger.info(`Removed document: ${doc.metadata.fileName}`);
                break;
            }
        }
    }

    async deleteDocument(documentId) {
        const document = this.documents.get(documentId);
        if (document) {
            try {
                await fs.remove(document.metadata.filePath);
                this.documents.delete(documentId);
                logger.info(`Deleted document: ${document.metadata.fileName}`);
            } catch (error) {
                logger.error(`Error deleting document ${documentId}:`, error);
                throw error;
            }
        }
    }

    listDocuments() {
        return Array.from(this.documents.values()).map(doc => ({
            id: doc.metadata.id,
            fileName: doc.metadata.fileName,
            fileSize: doc.metadata.fileSize,
            type: doc.metadata.type,
            processed: doc.metadata.processed,
            wordCount: doc.metadata.wordCount,
            preview: doc.metadata.preview
        }));
    }

    getDocument(documentId) {
        return this.documents.get(documentId);
    }

    getAllDocuments() {
        return this.documents;
    }

    searchDocuments(query) {
        const results = [];
        const queryLower = query.toLowerCase();

        for (const [id, doc] of this.documents) {
            const content = doc.content.toLowerCase();
            if (content.includes(queryLower)) {
                const relevanceScore = (content.match(new RegExp(queryLower, 'g')) || []).length;
                results.push({
                    documentId: id,
                    fileName: doc.metadata.fileName,
                    relevanceScore,
                    preview: this.getContextAroundMatch(doc.content, query)
                });
            }
        }

        return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    getContextAroundMatch(content, query, contextLength = 200) {
        const index = content.toLowerCase().indexOf(query.toLowerCase());
        if (index === -1) return '';

        const start = Math.max(0, index - contextLength / 2);
        const end = Math.min(content.length, index + query.length + contextLength / 2);
        
        return '...' + content.substring(start, end) + '...';
    }
}

module.exports = DocumentProcessor; 