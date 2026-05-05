#!/bin/bash
# Livealth CRM Auto-Update Script
# Fetches leads from ElevenLabs and updates GitHub

cd /root/.openclaw/workspace/livealth

# Source .env file for API keys
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check if GITHUB_TOKEN is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN not set. Please add to .env file"
    exit 1
fi

# Run the pipeline
echo "🚀 Starting Livealth leads update..."
node fetch-leads.js
