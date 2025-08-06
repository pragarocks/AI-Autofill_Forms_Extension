# 🚀 Deployment Guide - Setting Up on Different Systems

This guide helps you deploy the AI AutoFill project on different systems, especially for using powerful external machines for local LLM inference.

## 📋 Deployment Scenarios

### **Scenario 1: Same System (Current Setup)**
- Development and LLM inference on the same machine
- Uses built-in Python transformers or external local tools

### **Scenario 2: External LLM System** 
- Development system: Your current laptop/workstation
- LLM system: Powerful desktop/server with more RAM/GPU
- Connection: HTTP API between systems

### **Scenario 3: Git-based Deployment**
- Push code to Git repository
- Clone and run on different systems
- Maintain context and configuration

## 🔧 **Method 1: Git Repository Setup (Recommended)**

### **Step 1: Prepare Current System for Git**

1. **Initialize Git repository:**
```bash
git init
git add .
git commit -m "Initial AI AutoFill project setup"
```

2. **Create repository on GitHub/GitLab:**
   - Go to GitHub.com → New Repository
   - Name: `ai-autofill-system`
   - Don't initialize with README (we already have files)

3. **Push to remote:**
```bash
git remote add origin https://github.com/yourusername/ai-autofill-system.git
git branch -M main
git push -u origin main
```

### **Step 2: Deploy on External System**

1. **Clone repository:**
```bash
git clone https://github.com/yourusername/ai-autofill-system.git
cd ai-autofill-system
```

2. **Install Node.js dependencies:**
```bash
npm install
```

3. **Set up configuration:**
```bash
# Copy and edit startup script
cp start.bat.template start.bat        # Windows
cp start.sh.template start.sh          # Linux/macOS
chmod +x start.sh                      # Linux/macOS only

# Edit the startup script with your settings
```

4. **Choose your LLM setup** (pick one):

**Option A: LM Studio (Easiest for external systems)**
```bash
# Download and install LM Studio
# Load a model (e.g., Llama 2, Mistral, etc.)
# Enable server mode in LM Studio

# In your startup script:
set LM_STUDIO_URL=http://localhost:1234/v1
```

**Option B: Built-in Python LLM**
```bash
python setup_local_llm.py
# Set LOCAL_LLM_ENABLED=true in startup script
```

**Option C: llama.cpp server**
```bash
# Compile and run llama.cpp with server
./llama.cpp/server -m your-model.gguf --host 0.0.0.0 --port 8080

# In startup script:
set LLAMACPP_URL=http://localhost:8080
```

## 🌐 **Method 2: External LLM Server Setup**

### **For the External System (Powerful machine):**

1. **Set up LM Studio:**
   - Download from: https://lmstudio.ai/
   - Load a powerful model (Llama 2 70B, Mistral 7B, etc.)
   - Enable "Server" mode
   - Note the server URL (usually `http://localhost:1234`)

2. **Make server accessible:**
```bash
# If systems are on same network, find IP:
ipconfig          # Windows
ifconfig          # Linux/macOS

# Server will be: http://192.168.1.XXX:1234/v1
```

### **For the Development System:**

1. **Update configuration:**
```bash
# In start.bat or start.sh:
set LM_STUDIO_URL=http://192.168.1.XXX:1234/v1
```

2. **Test connection:**
```bash
curl http://192.168.1.XXX:1234/v1/models
```

## 📁 **Project Structure for Deployment**

```
ai-autofill-system/
├── 📄 README.md                 # Main documentation
├── 📄 DEPLOYMENT_GUIDE.md       # This file
├── 📄 LOCAL_LLM_GUIDE.md        # Local LLM setup
├── 📄 package.json              # Node.js dependencies
├── 📄 .gitignore               # Git ignore rules
├── 📁 src/                     # Main application code
├── 📁 extension/               # Browser extension
├── 📁 documents/               # RAG documents
├── 📄 start.bat.template       # Windows startup template
├── 📄 start.sh.template        # Unix startup template
└── 📄 setup_local_llm.py       # Python LLM setup
```

## ⚙️ **Configuration Templates**

### **For Development System (minimal resources):**
```bash
# Use cloud APIs primarily
GOOGLE_API_KEY=your_api_key_here
LOCAL_LLM_ENABLED=false

# Point to external LLM
LM_STUDIO_URL=http://192.168.1.100:1234/v1
```

### **For External LLM System (powerful machine):**
```bash
# Can use local models
GOOGLE_API_KEY=your_api_key_here  # Backup
LOCAL_LLM_ENABLED=true
LOCAL_LLM_MODEL=microsoft/DialoGPT-medium

# Run LM Studio locally
LM_STUDIO_URL=http://localhost:1234/v1
```

## 🔄 **Update Process**

### **When you make changes:**

1. **From development system:**
```bash
git add .
git commit -m "Updated feature X"
git push origin main
```

2. **On external system:**
```bash
git pull origin main
npm install  # If package.json changed
# Restart the server
```

## 🐛 **Troubleshooting**

### **Common Issues:**

**"Connection refused" errors:**
- Check if external LLM server is running
- Verify IP address and port
- Check firewall settings

**"Module not found" errors:**
- Run `npm install` after pulling updates
- Check Node.js version compatibility

**Git authentication issues:**
- Use personal access tokens instead of passwords
- Set up SSH keys for easier access

### **Network Configuration:**

**For same-network systems:**
```bash
# Allow through Windows Firewall
netsh advfirewall firewall add rule name="LM Studio" dir=in action=allow protocol=TCP localport=1234

# Linux firewall
sudo ufw allow 1234
```

**For remote systems:**
- Consider VPN or SSH tunneling for security
- Don't expose LLM servers to public internet

## 🎯 **Recommended Setups**

### **Setup 1: Development + Powerful Desktop**
- **Development**: Laptop with browser extension development
- **LLM**: Desktop with LM Studio and large models
- **Connection**: Local network HTTP API

### **Setup 2: Cloud Development + Local LLM**
- **Development**: Cloud IDE or remote development
- **LLM**: Local workstation for privacy
- **Connection**: VPN or SSH tunnel

### **Setup 3: All-in-One Powerful System**
- **Everything**: Single powerful system
- **Benefits**: No network latency, simpler setup
- **Trade-offs**: All resources on one machine

## 📈 **Performance Tips**

1. **Use LM Studio** for external systems (easiest setup)
2. **Enable GPU acceleration** when available
3. **Choose appropriate model sizes** for your hardware
4. **Monitor resource usage** on both systems
5. **Use wired connections** for better stability

## 🔒 **Security Considerations**

- **Local network only**: Don't expose LLM APIs to internet
- **API keys**: Keep cloud API keys secure and in `.env` files
- **VPN access**: Use VPN for remote system access
- **Firewall**: Only open necessary ports

---

## 🚀 **Quick Start Commands**

### **For Development System:**
```bash
git clone your-repo-url
cd ai-autofill-system
npm install
cp start.bat.template start.bat
# Edit start.bat with your config
start.bat
```

### **For External LLM System:**
```bash
git clone your-repo-url
cd ai-autofill-system
npm install
# Install LM Studio and load a model
# Enable server mode in LM Studio
cp start.bat.template start.bat
# Edit: set LM_STUDIO_URL=http://localhost:1234/v1
start.bat
```

**You now have a complete deployment strategy that preserves all context and allows easy setup on different systems! 🎉** 