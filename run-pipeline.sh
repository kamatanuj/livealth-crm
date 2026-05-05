#!/bin/bash
# Livealth Leads Pipeline - Cron Wrapper Script
# Sources .env file and runs the pipeline

cd "$(dirname "$0")"

# Source .env file if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    echo "✅ Sourced .env file"
else
    echo "⚠️ No .env file found, using environment variables"
fi

# Check required variables
if [ -z "$ELEVENLABS_API_KEY" ]; then
    echo "❌ ELEVENLABS_API_KEY not set"
    exit 1
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN not set. Please add to .env file or set environment variable"
    exit 1
fi

# Run the pipeline
echo "🚀 Starting Livealth Leads Pipeline..."
node fetch-leads.js
