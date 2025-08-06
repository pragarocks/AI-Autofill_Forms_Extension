#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🤖 AI AutoFill Setup Script');
console.log('============================\n');

async function setup() {
    try {
        // Step 1: Check Node.js version
        console.log('1️⃣ Checking Node.js version...');
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion < 16) {
            console.error('❌ Node.js 16+ is required. Current version:', nodeVersion);
            process.exit(1);
        }
        console.log('✅ Node.js version:', nodeVersion);

        // Step 2: Check if .env file exists
        console.log('\n2️⃣ Checking environment configuration...');
        if (!fs.existsSync('.env')) {
            if (fs.existsSync('config.example.env')) {
                fs.copyFileSync('config.example.env', '.env');
                console.log('✅ Created .env file from template');
                console.log('⚠️  Please edit .env file and add your API keys!');
            } else {
                console.log('❌ config.example.env not found');
            }
        } else {
            console.log('✅ .env file already exists');
        }

        // Step 3: Install dependencies
        console.log('\n3️⃣ Installing dependencies...');
        try {
            execSync('npm install', { stdio: 'inherit' });
            console.log('✅ Dependencies installed successfully');
        } catch (error) {
            console.error('❌ Failed to install dependencies');
            throw error;
        }

        // Step 4: Initialize database
        console.log('\n4️⃣ Initializing database...');
        try {
            execSync('node src/setup/init-db.js', { stdio: 'inherit' });
            console.log('✅ Database initialized');
        } catch (error) {
            console.error('❌ Database initialization failed');
            throw error;
        }

        // Step 5: Create sample documents
        console.log('\n5️⃣ Setting up sample documents...');
        if (fs.existsSync('samples')) {
            console.log('✅ Sample documents available in ./samples/');
            console.log('💡 Copy them to ./documents/ to test the system');
        }

        // Success message
        console.log('\n🎉 Setup Complete!');
        console.log('==================\n');
        
        console.log('Next steps:');
        console.log('1. Edit .env file and add your API keys:');
        console.log('   - OPENAI_API_KEY (for OpenAI GPT)');
        console.log('   - GOOGLE_API_KEY (for Google Gemini)');
        console.log('   - ANTHROPIC_API_KEY (for Claude)');
        console.log('   (You need at least one API key)\n');
        
        console.log('2. Start the server:');
        console.log('   npm run dev\n');
        
        console.log('3. Install the browser extension:');
        console.log('   - Open Chrome and go to chrome://extensions/');
        console.log('   - Enable "Developer mode"');
        console.log('   - Click "Load unpacked" and select the "extension" folder\n');
        
        console.log('4. Test with sample documents:');
        console.log('   cp samples/* documents/\n');
        
        console.log('🔗 Server will be available at: http://localhost:3000');
        console.log('📖 Read README.md for detailed usage instructions');

    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('- Ensure you have Node.js 16+ installed');
        console.log('- Check your internet connection for npm packages');
        console.log('- Try running: npm cache clean --force');
        console.log('- Check the error log above for specific issues');
        process.exit(1);
    }
}

// Run setup
setup(); 