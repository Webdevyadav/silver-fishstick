#!/bin/bash

echo "Deploying AI Agent System..."

# Build Docker images
echo "Building Docker images..."
docker-compose -f docker/docker-compose.yml build

# Start services
echo "Starting services..."
docker-compose -f docker/docker-compose.yml up -d

# Wait for health check
echo "Waiting for services to be healthy..."
sleep 10

# Check health
curl -f http://localhost:8000/health || exit 1

echo "Deployment complete!"
echo "API: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "API Docs: http://localhost:8000/docs"
