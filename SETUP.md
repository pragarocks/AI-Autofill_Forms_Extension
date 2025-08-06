# 🚀 Quick Setup Guide

## Step 1: Get Your API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key

## Step 2: Install Dependencies
```bash
npm install
```

## Step 3: Configure Startup Script

### Windows Users:
1. Copy `start.bat.template` to `start.bat`
2. Open `start.bat` in a text editor
3. Replace `YOUR_API_KEY_HERE` with your actual API key
4. Save the file

### Unix/Linux/macOS Users:
1. Copy `start.sh.template` to `start.sh`
2. Open `start.sh` in a text editor
3. Replace `YOUR_API_KEY_HERE` with your actual API key
4. Make it executable: `chmod +x start.sh`

## Step 4: Add Your Documents
1. Create a `documents` folder (if it doesn't exist)
2. Add your PDFs, Word documents, or text files
3. The system will process them automatically

## Step 5: Start the Server

### Windows:
Double-click `start.bat`

### Unix/Linux/macOS:
```bash
./start.sh
```

## Step 6: Load the Extension
1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `extension` folder from this project

## Step 7: Test
1. Visit http://localhost:3000/test-form
2. Try filling out the form fields
3. Press Enter to see AI suggestions

## 🎉 You're Ready!
Your AI AutoFill extension is now ready to use on any website with forms!

## Need Help?
- Check the main [README.md](README.md) for detailed documentation
- Review the troubleshooting section for common issues
- Check server logs for error messages 