#!/bin/bash

echo "Running AI Agent System Tests..."

# Activate virtual environment
source venv/bin/activate

# Run unit tests
echo "Running unit tests..."
pytest tests/test_agents.py tests/test_tools.py -v

# Run integration tests
echo "Running integration tests..."
pytest tests/test_integration.py -v

# Generate coverage report
echo "Generating coverage report..."
pytest --cov=agents --cov=tools --cov=rag --cov-report=html

echo "Tests complete! Coverage report: htmlcov/index.html"
