# 🤖 AI AutoFill Browser Extension

An intelligent browser extension that automatically fills web forms using AI-powered suggestions based on your personal information and documents.

## ✨ Features

- **Smart Form Detection**: Automatically detects form fields and their types
- **AI-Powered Suggestions**: Uses Google Gemini AI to provide intelligent form suggestions
- **RAG Integration**: Retrieves relevant information from your local documents
- **One-Click Auto-Fill**: Press Enter to auto-fill form fields with AI suggestions
- **Privacy-First**: All processing happens locally, only API calls to Google Gemini
- **Multi-Format Support**: Works with PDFs, Word documents, and text files

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Google Gemini API key ([Get it here](https://makersuite.google.com/app/apikey))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-autofill
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure your API key**

   **Option A: Using the provided scripts (Recommended)**
   
   **Windows:**
   - Copy `start.bat.template` to `start.bat`
   - Edit `start.bat` and replace `YOUR_API_KEY_HERE` with your actual API key
   - Double-click `start.bat` to run the server
   
   **Unix/Linux/macOS:**
   - Copy `start.sh.template` to `start.sh`
   - Edit `start.sh` and replace `YOUR_API_KEY_HERE` with your actual API key
   - Make it executable: `chmod +x start.sh`
   - Run: `./start.sh`

   **Option B: Manual command**
   ```bash
   # Windows PowerShell
   $env:GOOGLE_API_KEY="your-api-key-here"; node src/main.js
   
   # Unix/Linux/macOS
   GOOGLE_API_KEY="your-api-key-here" node src/main.js
   ```

4. **Load the browser extension**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` folder from this project

5. **Add your documents**
   - Place your PDFs, Word documents, or text files in the `documents` folder
   - The system will automatically process them on startup

## 📁 Project Structure

```
ai-autofill/
├── src/                    # Source code
│   ├── main.js            # Server entry point
│   ├── services/          # Core services
│   └── extension/         # Browser extension files
├── documents/             # Your personal documents (PDFs, Word, text)
├── start.bat.template     # Windows startup script template
├── start.sh.template      # Unix/Linux startup script template
├── test-form.html        # Test form for development
└── README.md             # This file
```

## 🔧 Configuration

### Environment Variables

- `GOOGLE_API_KEY`: Your Google Gemini API key (required)
- `LOCAL_LLM_ENABLED`: Set to "false" for most users (optional)

### API Key Setup

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and replace `YOUR_API_KEY_HERE` in the startup script

## 🧪 Testing

1. **Start the server** using one of the methods above
2. **Visit the test form**: http://localhost:3000/test-form
3. **Try the extension** on any website with forms

## 🔍 Troubleshooting

### Common Issues

**"API key not found" error**
- Make sure you've replaced `YOUR_API_KEY_HERE` with your actual API key
- Verify the API key is valid at [Google AI Studio](https://makersuite.google.com/app/apikey)

**Extension not working**
- Ensure the server is running on port 3000
- Check that the extension is loaded in Chrome
- Try refreshing the webpage

**No suggestions appearing**
- Check that your documents are in the `documents` folder
- Verify the server logs show documents being processed
- Ensure your API key has sufficient quota

**Server won't start**
- Make sure Node.js is installed (v16 or higher)
- Run `npm install` to install dependencies
- Check that port 3000 is not in use

### Debug Endpoints

- **RAG Debug**: http://localhost:3000/api/debug/rag
- **Test Form**: http://localhost:3000/test-form

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

### Project Scripts

- `npm start`: Start the production server
- `npm run dev`: Start with nodemon for development
- `npm run setup`: Install dependencies and show setup instructions

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review the server logs for error messages
3. Open an issue on GitHub with detailed information 