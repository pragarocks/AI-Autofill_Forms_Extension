const fs = require('fs-extra');
const path = require('path');
const { JSONFilePreset } = require('lowdb/node');
const { NlpManager } = require('node-nlp');

const logger = require('../utils/logger');

class RAGSystem {
    constructor() {
        this.vectorDbPath = process.env.VECTOR_DB_PATH || './data/vector_db';
        this.dbFile = path.join(this.vectorDbPath, 'vectors.json');
        this.nlpManager = new NlpManager({ languages: ['en'] });
        this.embeddingDimension = 384; // Typical dimension for sentence transformers
        this.initialized = false;
        this.db = null;
        
        // Ensure vector database directory exists
        fs.ensureDirSync(this.vectorDbPath);
    }

    async initialize() {
        try {
            await this.initializeDatabase();
            await this.initializeNLP();
            this.initialized = true;
            logger.info('RAG system initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize RAG system:', error);
            throw error;
        }
    }

    async initializeDatabase() {
        try {
            // Initialize LowDB with default data structure
            const defaultData = {
                documents: [],
                document_chunks: []
            };

            this.db = await JSONFilePreset(this.dbFile, defaultData);
            logger.info('LowDB database initialized');
        } catch (error) {
            logger.error('Failed to initialize database:', error);
            throw error;
        }
    }

    async initializeNLP() {
        // Initialize NLP manager for text processing and basic embeddings
        await this.nlpManager.train();
        logger.info('NLP manager initialized');
    }

    // Simple embedding generation using basic text features
    // In production, you'd want to use a proper embedding model like sentence-transformers
    generateEmbedding(text) {
        // This is a simplified embedding - in production use sentence-transformers or similar
        const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
        const wordFreq = {};
        
        // Calculate word frequencies
        words.forEach(word => {
            wordFreq[word] = (wordFreq[word] || 0) + 1;
        });

        // Create a simple TF vector (you'd want TF-IDF or transformer embeddings in production)
        const embedding = new Array(this.embeddingDimension).fill(0);
        
        // Hash words to embedding positions and set values based on frequency
        Object.entries(wordFreq).forEach(([word, freq]) => {
            const hash = this.simpleHash(word) % this.embeddingDimension;
            embedding[hash] += freq / words.length; // Normalize by text length
        });

        // Apply simple normalization
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= magnitude;
            }
        }

        return embedding;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    // Calculate cosine similarity between two embeddings
    cosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async addDocument(documentId, document) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // Store document metadata
            await this.storeDocumentMetadata(documentId, document);

            // Process and store chunks with embeddings
            for (const chunk of document.chunks) {
                await this.addChunk(documentId, chunk);
            }

            logger.info(`Added document ${documentId} to RAG system with ${document.chunks.length} chunks`);
        } catch (error) {
            logger.error(`Error adding document ${documentId} to RAG system:`, error);
            throw error;
        }
    }

    async storeDocumentMetadata(documentId, document) {
        try {
            const documentData = {
                id: documentId,
                file_name: document.metadata.fileName,
                file_path: document.metadata.filePath,
                content_preview: document.metadata.preview,
                metadata: document.metadata,
                created_at: new Date().toISOString()
            };

            // Remove existing document if it exists
            await this.db.update(({ documents }) => {
                const index = documents.findIndex(doc => doc.id === documentId);
                if (index !== -1) {
                    documents.splice(index, 1);
                }
                documents.push(documentData);
            });

            await this.db.write();
        } catch (error) {
            logger.error('Error storing document metadata:', error);
            throw error;
        }
    }

    async addChunk(documentId, chunk) {
        try {
            const chunkId = `${documentId}_chunk_${chunk.index}`;
            const embedding = this.generateEmbedding(chunk.content);

            const chunkData = {
                id: chunkId,
                document_id: documentId,
                chunk_index: chunk.index,
                content: chunk.content,
                embedding: embedding, // Store as array instead of binary
                metadata: chunk,
                created_at: new Date().toISOString()
            };

            await this.db.update(({ document_chunks }) => {
                // Remove existing chunk if it exists
                const index = document_chunks.findIndex(c => c.id === chunkId);
                if (index !== -1) {
                    document_chunks.splice(index, 1);
                }
                document_chunks.push(chunkData);
            });

            await this.db.write();
        } catch (error) {
            logger.error('Error adding chunk:', error);
            throw error;
        }
    }

        async search(query, topK = 5) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            // Try multiple search strategies with more variations
            const searchQueries = [
                query,
                query.toLowerCase(),
                query.replace(/[_-]/g, ' '),
                query.split(' ').slice(0, 3).join(' '), // Use first 3 words
                query.split(' ').slice(0, 2).join(' '), // Use first 2 words
                query.replace(/[^a-zA-Z0-9\s]/g, ' ').trim(), // Remove special chars
                query.split(' ').filter(word => word.length > 2).join(' ') // Filter short words
            ];

            let bestResults = [];
            
            for (const searchQuery of searchQueries) {
                if (!searchQuery || searchQuery.trim().length === 0) continue;
                
                const queryEmbedding = this.generateEmbedding(searchQuery);
                const results = await this.findSimilarChunks(queryEmbedding, topK);
                
                // Merge results and keep best matches
                for (const result of results) {
                    const existing = bestResults.find(r => r.id === result.id);
                    if (!existing || result.similarity > existing.similarity) {
                        if (existing) {
                            bestResults = bestResults.filter(r => r.id !== result.id);
                        }
                        bestResults.push(result);
                    }
                }
            }
            
            // Sort by similarity and return top K
            const finalResults = bestResults
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, topK);

            logger.info(`RAG search for "${query}" returned ${finalResults.length} results`);
            return finalResults;
        } catch (error) {
            logger.error(`Error during RAG search for "${query}":`, error);
            throw error;
        }
    }

    async findSimilarChunks(queryEmbedding, topK) {
        try {
            const chunks = this.db.data.document_chunks;

            const similarities = chunks.map(chunk => {
                const embedding = chunk.embedding;
                const similarity = this.cosineSimilarity(queryEmbedding, embedding);

                return {
                    id: chunk.id,
                    documentId: chunk.document_id,
                    chunkIndex: chunk.chunk_index,
                    content: chunk.content,
                    similarity,
                    metadata: chunk.metadata || {}
                };
            });

            // Filter by minimum similarity threshold and sort
            const filteredResults = similarities
                .filter(result => result.similarity > 0.05) // Lower threshold for better matching
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, topK);

            return filteredResults;
        } catch (error) {
            logger.error('Error finding similar chunks:', error);
            throw error;
        }
    }

    async removeDocument(documentId) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            await this.db.update(({ documents, document_chunks }) => {
                // Remove document
                const docIndex = documents.findIndex(doc => doc.id === documentId);
                if (docIndex !== -1) {
                    documents.splice(docIndex, 1);
                }

                // Remove all chunks for this document
                for (let i = document_chunks.length - 1; i >= 0; i--) {
                    if (document_chunks[i].document_id === documentId) {
                        document_chunks.splice(i, 1);
                    }
                }
            });

            await this.db.write();
            logger.info(`Removed document ${documentId} from RAG system`);
        } catch (error) {
            logger.error(`Error removing document ${documentId}:`, error);
            throw error;
        }
    }

    async getDocumentInfo(documentId) {
        try {
            const document = this.db.data.documents.find(doc => doc.id === documentId);
            return document || null;
        } catch (error) {
            logger.error('Error getting document info:', error);
            throw error;
        }
    }

    async getAllDocuments() {
        try {
            return this.db.data.documents.map(doc => ({
                id: doc.id,
                file_name: doc.file_name,
                content_preview: doc.content_preview,
                created_at: doc.created_at
            }));
        } catch (error) {
            logger.error('Error getting all documents:', error);
            throw error;
        }
    }

    async getChunksByDocument(documentId) {
        try {
            const chunks = this.db.data.document_chunks
                .filter(chunk => chunk.document_id === documentId)
                .sort((a, b) => a.chunk_index - b.chunk_index)
                .map(chunk => ({
                    chunk_index: chunk.chunk_index,
                    content: chunk.content,
                    metadata: chunk.metadata || {}
                }));
            
            return chunks;
        } catch (error) {
            logger.error('Error getting chunks by document:', error);
            throw error;
        }
    }

    // Enhanced search with filters and metadata
    async advancedSearch(options) {
        const {
            query,
            topK = 5,
            documentTypes = null,
            dateRange = null,
            minSimilarity = 0.1
        } = options;

        const queryEmbedding = this.generateEmbedding(query);
        
        return new Promise((resolve, reject) => {
            let sqlQuery = `
                SELECT dc.id, dc.document_id, dc.chunk_index, dc.content, 
                       dc.embedding, dc.metadata as chunk_metadata,
                       d.file_name, d.metadata as doc_metadata
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                WHERE 1=1
            `;
            
            const params = [];
            
            if (documentTypes && documentTypes.length > 0) {
                const placeholders = documentTypes.map(() => '?').join(',');
                sqlQuery += ` AND d.file_name LIKE ANY (${placeholders})`;
                params.push(...documentTypes.map(type => `%.${type}`));
            }
            
            if (dateRange) {
                sqlQuery += ` AND d.created_at BETWEEN ? AND ?`;
                params.push(dateRange.start, dateRange.end);
            }

            this.db.all(sqlQuery, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const similarities = rows.map(row => {
                    const embeddingBuffer = new Float32Array(row.embedding.buffer);
                    const embedding = Array.from(embeddingBuffer);
                    const similarity = this.cosineSimilarity(queryEmbedding, embedding);

                    return {
                        id: row.id,
                        documentId: row.document_id,
                        fileName: row.file_name,
                        chunkIndex: row.chunk_index,
                        content: row.content,
                        similarity,
                        chunkMetadata: JSON.parse(row.chunk_metadata || '{}'),
                        docMetadata: JSON.parse(row.doc_metadata || '{}')
                    };
                });

                const filteredResults = similarities
                    .filter(result => result.similarity >= minSimilarity)
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, topK);

                resolve(filteredResults);
            });
        });
    }

    // Clean up resources
    async close() {
        if (this.db) {
            try {
                await this.db.write();
                logger.info('RAG database closed successfully');
            } catch (error) {
                logger.error('Error closing RAG database:', error);
            }
        }
    }
}

module.exports = RAGSystem; 