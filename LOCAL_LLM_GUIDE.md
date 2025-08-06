# 🤖 Local LLM Setup Guide

This guide explains how to use **local Large Language Models** with your AI AutoFill system using **Hugging Face Transformers** - requiring **NO cmake, NO external software**, just Python!

## 🎯 Why Use Local LLM?

- **✅ Privacy**: Your data never leaves your machine
- **✅ Cost**: No API fees for token usage  
- **✅ Offline**: Works without internet connection (after model download)
- **✅ Control**: Full control over model behavior and responses
- **✅ Simple**: Pure Python solution, no compilation required

## 📋 Requirements

- **Python 3.8+** (you already have this)
- **~8GB RAM** (for medium models)
- **~2-5GB disk space** (for model storage)
- **Internet connection** (for initial model download only)

## 🚀 Quick Setup

### 1. Install Dependencies

Run the automated setup script:

```bash
# Windows
python setup_local_llm.py

# Linux/macOS  
python3 setup_local_llm.py
```

This installs:
- `torch` (PyTorch)
- `transformers` (Hugging Face)
- `accelerate` (optimization)
- Other required packages

### 2. Enable Local LLM

Edit your startup script:

**Windows (`start.bat`):**
```batch
set LOCAL_LLM_ENABLED=true
set LOCAL_LLM_MODEL=microsoft/DialoGPT-medium
```

**Linux/macOS (`start.sh`):**
```bash
export LOCAL_LLM_ENABLED="true"
export LOCAL_LLM_MODEL="microsoft/DialoGPT-medium"
```

### 3. Start the Server

```bash
# Windows
start.bat

# Linux/macOS
./start.sh
```

The first time will download the model (~1.5GB) automatically.

## 🔧 Available Models

| Model | Size | RAM Needed | Best For |
|-------|------|------------|----------|
| `distilgpt2` | ~300MB | 2GB | Fast, basic responses |
| `gpt2-medium` | ~1.4GB | 4GB | Good balance of speed/quality |
| `microsoft/DialoGPT-medium` | ~1.5GB | 4GB | **Recommended** - Best for conversations |

## ⚙️ Configuration Options

### Environment Variables

```bash
# Enable/disable local LLM
LOCAL_LLM_ENABLED=true

# Choose model (downloads automatically on first use)
LOCAL_LLM_MODEL=microsoft/DialoGPT-medium

# Optional: Set cache directory for models  
HF_HOME=/path/to/model/cache
```

### Model Performance Tips

**For Faster Responses:**
- Use `distilgpt2` (smallest, fastest)
- Lower `max_length` in generation

**For Better Quality:**
- Use `microsoft/DialoGPT-medium` (recommended)
- Higher `temperature` for more creative responses

**For Memory Efficiency:**
- Models are automatically quantized to 16-bit on GPU
- CPU models use 32-bit (slower but compatible)

## 🧪 Testing Local LLM

### Test the Python Script Directly

```bash
# Test basic generation
python src/local_llm/transformers_llm.py "Hello, what is your name?" --model distilgpt2

# Test with DialoGPT
python src/local_llm/transformers_llm.py "My name is John" --model microsoft/DialoGPT-medium --max-length 100
```

### Test Through the Web Interface

1. Start the server with local LLM enabled
2. Go to `http://localhost:3000/test-form`
3. Try auto-filling a form field
4. Check the console logs to see which LLM provider is being used

## 🔍 Troubleshooting

### Common Issues

**"Model not found" error:**
- Check your internet connection
- Model will download on first use (may take several minutes)

**"Out of memory" error:**
- Try a smaller model: `distilgpt2`
- Close other applications to free RAM
- Reduce `max_length` parameter

**"Python script failed" error:**
- Run the setup script again: `python setup_local_llm.py`
- Check Python version: `python --version` (needs 3.8+)

### Debug Mode

Enable verbose logging by setting:
```bash
export DEBUG_LLM=true
```

This will show detailed information about model loading and generation.

## 🎯 How It Works

1. **Node.js Server** receives form field requests
2. **LLM Service** checks if local LLM is available
3. **Python Script** (`transformers_llm.py`) loads the model and generates responses
4. **JSON Response** is sent back to the browser extension

### Fallback Strategy

The system automatically falls back between providers:
1. **Local LLM** (if enabled and working)
2. **Google Gemini API** (if API key is set)
3. **Error message** (if no providers available)

## 📊 Performance Comparison

| Provider | Speed | Cost | Privacy | Offline |
|----------|-------|------|---------|---------|
| Local LLM | Moderate | Free | ✅ | ✅ |
| Google Gemini | Fast | Pay-per-use | ❌ | ❌ |
| OpenAI GPT | Fast | Pay-per-use | ❌ | ❌ |

## 🔮 Future Enhancements

Planned improvements:
- **GPU acceleration** for faster inference
- **Model quantization** for lower memory usage
- **More model options** (LLaMA, Mistral, etc.)
- **Custom fine-tuning** on your personal data

## 🤝 Need Help?

If you encounter issues:
1. Check this guide's troubleshooting section
2. Run `python setup_local_llm.py` to verify installation
3. Check the console logs for error messages
4. Consider using the Google Gemini API as a backup

---

**Happy auto-filling! 🎉** 