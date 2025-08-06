#!/usr/bin/env python3
"""
Setup script for local LLM using Hugging Face Transformers
This script installs all required dependencies for Python-only local LLM
"""

import subprocess
import sys
import os

def install_package(package):
    """Install a Python package using pip"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to install {package}: {e}")
        return False

def check_package(package_name):
    """Check if a package is already installed"""
    try:
        __import__(package_name)
        return True
    except ImportError:
        return False

def main():
    print("🤖 AI AutoFill - Local LLM Setup")
    print("Setting up Hugging Face Transformers for local LLM support...")
    print("This approach requires NO cmake, NO external software!")
    print("-" * 60)
    
    # Required packages
    packages = [
        "torch>=2.0.0",
        "transformers>=4.35.0", 
        "accelerate>=0.21.0",
        "sentencepiece>=0.1.99",
        "protobuf>=3.20.0",
        "safetensors>=0.3.0",
        "tokenizers>=0.14.0"
    ]
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Error: Python 3.8+ is required")
        sys.exit(1)
    
    print(f"✅ Python {sys.version} detected")
    
    # Install packages
    failed_packages = []
    for package in packages:
        package_name = package.split(">=")[0].split("==")[0]
        print(f"📦 Installing {package}...")
        
        if install_package(package):
            print(f"   ✅ {package_name} installed successfully")
        else:
            print(f"   ❌ Failed to install {package_name}")
            failed_packages.append(package)
    
    if failed_packages:
        print(f"\n❌ Failed to install: {', '.join(failed_packages)}")
        print("Please check your internet connection and try again.")
        sys.exit(1)
    
    # Test the installation
    print("\n🧪 Testing installation...")
    try:
        import torch
        import transformers
        print(f"   ✅ PyTorch {torch.__version__}")
        print(f"   ✅ Transformers {transformers.__version__}")
        
        # Check if CUDA is available (optional)
        if torch.cuda.is_available():
            print(f"   🚀 CUDA detected: {torch.cuda.get_device_name(0)}")
        else:
            print("   💻 Using CPU (CUDA not available)")
            
    except Exception as e:
        print(f"   ❌ Installation test failed: {e}")
        sys.exit(1)
    
    print("\n🎉 Local LLM setup complete!")
    print("\nRecommended models (will download automatically on first use):")
    print("  • distilgpt2 (~300MB) - Fastest, basic responses")  
    print("  • gpt2-medium (~1.4GB) - Good balance")
    print("  • microsoft/DialoGPT-medium (~1.5GB) - Best for conversations")
    
    print("\nNext steps:")
    print("1. Start your server with: node src/main.js")
    print("2. The system will automatically download models on first use")
    print("3. No cmake or external software required! 🎯")

if __name__ == "__main__":
    main() 