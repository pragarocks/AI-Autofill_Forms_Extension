const fs = require('fs-extra');
const path = require('path');
const { JSONFilePreset } = require('lowdb/node');

const logger = require('../utils/logger');

class DatabaseInitializer {
    constructor() {
        this.vectorDbPath = process.env.VECTOR_DB_PATH || './data/vector_db';
        this.documentsPath = process.env.DOCUMENTS_PATH || './documents';
        this.dbFile = path.join(this.vectorDbPath, 'vectors.json');
    }

    async initialize() {
        try {
            console.log('🚀 Initializing AI AutoFill database...');
            
            // Create necessary directories
            await this.createDirectories();
            
            // Initialize vector database
            await this.initializeVectorDB();
            
            // Create sample documents directory
            await this.createSampleDocuments();
            
            console.log('✅ Database initialization complete!');
            console.log('\nNext steps:');
            console.log('1. Add your API keys to .env file');
            console.log('2. Upload documents via the extension or API');
            console.log('3. Start the server with: npm run dev');
            
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            process.exit(1);
        }
    }

    async createDirectories() {
        const directories = [
            this.vectorDbPath,
            this.documentsPath,
            './logs',
            './data',
            './samples'
        ];

        for (const dir of directories) {
            await fs.ensureDir(dir);
            console.log(`📁 Created directory: ${dir}`);
        }
    }

    async initializeVectorDB() {
        try {
            console.log('🗄️  Creating vector database...');

            // Initialize LowDB with default data structure
            const defaultData = {
                documents: [],
                document_chunks: []
            };

            const db = await JSONFilePreset(this.dbFile, defaultData);
            console.log('✅ Vector database initialized');
            console.log('✅ Document storage structure created');
            console.log('✅ Document chunks storage structure created');
        } catch (error) {
            console.error('Error initializing vector database:', error);
            throw error;
        }
    }

    async createSampleDocuments() {
        const sampleDir = './samples';
        
        // Create a sample resume
        const sampleResume = `
John Smith
Software Engineer
Email: john.smith@email.com
Phone: (555) 123-4567
Address: 123 Main Street, San Francisco, CA 94105

EXPERIENCE:
Senior Software Engineer at Tech Corp (2020-Present)
- Developed web applications using React and Node.js
- Led a team of 5 developers on major product features
- Implemented automated testing and CI/CD pipelines

Software Engineer at StartupXYZ (2018-2020)
- Built scalable backend services using Python and PostgreSQL
- Designed RESTful APIs and microservices architecture
- Collaborated with cross-functional teams on product development

EDUCATION:
Bachelor of Science in Computer Science
University of California, Berkeley (2014-2018)
GPA: 3.8/4.0

SKILLS:
- Programming Languages: JavaScript, Python, Java, TypeScript
- Frameworks: React, Node.js, Express, Django, Spring Boot
- Databases: PostgreSQL, MongoDB, Redis
- Cloud Platforms: AWS, Google Cloud Platform
- Tools: Git, Docker, Kubernetes, Jenkins

CERTIFICATIONS:
- AWS Certified Solutions Architect (2021)
- Google Cloud Professional Developer (2020)
`;

        const samplePersonalInfo = `
Personal Information Document

Full Name: John Smith
Date of Birth: March 15, 1992
Social Security Number: [REDACTED]
Emergency Contact: Jane Smith (spouse) - (555) 987-6543

Address:
123 Main Street
San Francisco, CA 94105
United States

Education History:
- University of California, Berkeley
  Bachelor of Science in Computer Science (2014-2018)
  GPA: 3.8/4.0
  
- San Francisco High School (2010-2014)
  High School Diploma, Valedictorian

Professional References:
1. Sarah Johnson - Former Manager at Tech Corp
   Email: sarah.johnson@techcorp.com
   Phone: (555) 111-2222
   
2. Michael Brown - Team Lead at StartupXYZ
   Email: m.brown@startupxyz.com
   Phone: (555) 333-4444

Insurance Information:
- Health Insurance: Blue Cross Blue Shield
- Policy Number: BC123456789
- Group Number: 12345

Banking Information:
- Bank: First National Bank
- Account Type: Checking
- Routing Number: 123456789
`;

        await fs.writeFile(path.join(sampleDir, 'sample_resume.txt'), sampleResume.trim());
        await fs.writeFile(path.join(sampleDir, 'personal_info.txt'), samplePersonalInfo.trim());
        
        console.log('📄 Sample documents created in ./samples/');
        console.log('   - sample_resume.txt');
        console.log('   - personal_info.txt');
        console.log('\n💡 You can copy these to ./documents/ to test the system');
    }

    async checkHealth() {
        try {
            // Check if database file exists and is accessible
            const dbExists = await fs.pathExists(this.dbFile);
            if (!dbExists) {
                return { status: 'error', message: 'Database file not found' };
            }

            // Try to read and parse the database
            const db = await JSONFilePreset(this.dbFile, { documents: [], document_chunks: [] });
            const documentCount = db.data.documents.length;
            
            return { 
                status: 'healthy', 
                message: `Database operational with ${documentCount} documents`
            };

        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }
}

// Run initialization if called directly
if (require.main === module) {
    const initializer = new DatabaseInitializer();
    initializer.initialize();
}

module.exports = DatabaseInitializer; 