#!/usr/bin/env python3
"""
Local LLM using Hugging Face Transformers
No cmake, no external software - pure Python solution
"""

import json
import sys
import argparse
import torch
from transformers import (
    AutoTokenizer, 
    AutoModelForCausalLM, 
    pipeline,
    set_seed
)
import warnings

# Suppress warnings for cleaner output
warnings.filterwarnings("ignore")

class LocalLLM:
    def __init__(self, model_name="microsoft/DialoGPT-medium"):
        """
        Initialize local LLM with lightweight models
        
        Recommended models (Python-only, no cmake):
        - microsoft/DialoGPT-medium (conversational, ~1.5GB)
        - gpt2 (classic, ~500MB)
        - gpt2-medium (~1.4GB)
        - distilgpt2 (smaller, ~300MB)
        - TinyLlama/TinyLlama-1.1B-Chat-v1.0 (~1.1GB)
        """
        self.model_name = model_name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        print(f"Loading model: {model_name} on {self.device}", file=sys.stderr)
        
        try:
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                padding_side="left"
            )
            
            # Add padding token if not present
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # Load model with optimizations
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                device_map="auto" if self.device == "cuda" else None,
                low_cpu_mem_usage=True
            )
            
            # Move to device if not using device_map
            if self.device == "cpu":
                self.model = self.model.to(self.device)
            
            # Create generation pipeline
            self.generator = pipeline(
                "text-generation",
                model=self.model,
                tokenizer=self.tokenizer,
                device=0 if self.device == "cuda" else -1
            )
            
            print(f"Model loaded successfully!", file=sys.stderr)
            
        except Exception as e:
            print(f"Error loading model: {e}", file=sys.stderr)
            sys.exit(1)
    
    def generate_response(self, prompt, max_length=150, temperature=0.7, top_p=0.9):
        """Generate response from the local LLM"""
        try:
            # Set random seed for reproducibility
            set_seed(42)
            
            # Format prompt for better responses
            formatted_prompt = self._format_prompt(prompt)
            
            # Generate response
            with torch.no_grad():
                response = self.generator(
                    formatted_prompt,
                    max_length=max_length,
                    temperature=temperature,
                    top_p=top_p,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id,
                    num_return_sequences=1,
                    truncation=True
                )
            
            # Extract generated text
            generated_text = response[0]['generated_text']
            
            # Clean up the response
            cleaned_response = self._clean_response(generated_text, formatted_prompt)
            
            return cleaned_response
            
        except Exception as e:
            print(f"Error generating response: {e}", file=sys.stderr)
            return f"Error: Could not generate response - {str(e)}"
    
    def _format_prompt(self, prompt):
        """Format prompt based on model type"""
        if "DialoGPT" in self.model_name:
            return f"User: {prompt}\nBot:"
        elif "TinyLlama" in self.model_name or "chat" in self.model_name.lower():
            return f"<|user|>\n{prompt}\n<|assistant|>\n"
        else:
            # Generic format for GPT-2 style models
            return f"Question: {prompt}\nAnswer:"
    
    def _clean_response(self, generated_text, original_prompt):
        """Clean up the generated response"""
        # Remove the original prompt
        if generated_text.startswith(original_prompt):
            response = generated_text[len(original_prompt):].strip()
        else:
            response = generated_text.strip()
        
        # Stop at natural ending points
        stop_tokens = ["\nUser:", "\nQuestion:", "\n\n", "<|user|>", "<|endoftext|>"]
        for stop_token in stop_tokens:
            if stop_token in response:
                response = response.split(stop_token)[0]
        
        return response.strip()

def main():
    parser = argparse.ArgumentParser(description="Local LLM using Hugging Face Transformers")
    parser.add_argument("prompt", help="Input prompt for the LLM")
    parser.add_argument("--model", default="microsoft/DialoGPT-medium", 
                       help="Model name from Hugging Face")
    parser.add_argument("--max-length", type=int, default=150,
                       help="Maximum length of generated text")
    parser.add_argument("--temperature", type=float, default=0.7,
                       help="Temperature for sampling (0.0 to 1.0)")
    
    args = parser.parse_args()
    
    try:
        # Initialize LLM
        llm = LocalLLM(model_name=args.model)
        
        # Generate response
        response = llm.generate_response(
            args.prompt,
            max_length=args.max_length,
            temperature=args.temperature
        )
        
        # Output as JSON for Node.js integration
        result = {
            "text": response,
            "model": args.model,
            "prompt": args.prompt
        }
        
        print(json.dumps(result))
        
    except KeyboardInterrupt:
        print(json.dumps({"error": "Process interrupted"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main() 