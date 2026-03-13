#!/bin/bash

echo "Setting up AI Agent Framework..."

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file - please add your API keys"
fi

# Create necessary directories
mkdir -p data
mkdir -p chroma_db
mkdir -p logs

echo "Setup complete! Next steps:"
echo "1. Add API keys to .env file"
echo "2. Run: cd api && uvicorn main:app --reload"
