#!/usr/bin/env bash

# bindings.sh - Generate Wrangler CLI bindings from environment variables
# This script outputs binding flags for wrangler pages dev

BINDINGS=""

# Function to add a binding if the environment variable exists
add_binding() {
  local var_name="$1"
  local value="${!var_name}"
  if [ -n "$value" ]; then
    BINDINGS="$BINDINGS --binding ${var_name}=${value}"
  fi
}

# Add common environment variables as bindings
# API Keys and Configuration
add_binding "OPENAI_API_KEY"
add_binding "ANTHROPIC_API_KEY"
add_binding "GOOGLE_GENERATIVE_AI_API_KEY"
add_binding "GROQ_API_KEY"
add_binding "HUGGINGFACE_API_KEY"
add_binding "OLLAMA_API_BASE_URL"
add_binding "LMSTUDIO_API_BASE_URL"
add_binding "TOGETHER_API_KEY"
add_binding "XAI_API_KEY"
add_binding "COHERE_API_KEY"
add_binding "DEEPSEEK_API_KEY"
add_binding "MISTRAL_API_KEY"
add_binding "OPENROUTER_API_KEY"

# Backend Configuration
add_binding "VITE_BACKEND_URL"

# Optional Configuration
add_binding "DEFAULT_NUM_CTX"
add_binding "VITE_LOG_LEVEL"

# Output the bindings (trim leading space if exists)
echo "${BINDINGS# }"
