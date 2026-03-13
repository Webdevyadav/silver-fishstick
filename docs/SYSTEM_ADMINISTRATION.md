# RosterIQ AI Agent - System Administration Guide

## Table of Contents

1. [System Overview](#system-overview)
2. [Installation and Deployment](#installation-and-deployment)
3. [Configuration](#configuration)
4. [User Management](#user-management)
5. [Monitoring and Maintenance](#monitoring-and-maintenance)
6. [Backup and Recovery](#backup-and-recovery)
7. [Security](#security)
8. [Performance Tuning](#performance-tuning)
9. [Troubleshooting](#troubleshooting)
10. [Upgrade Procedures](#upgrade-procedures)

## System Overview

### Architecture Components

RosterIQ consists of the following components:

```
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer                         │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
│  API Server  │  │  API Server │  │  API Server │
│  (Node.js)   │  │  (Node.js)  │  │  (Node.js)  │
└───────┬──────┘  └──────┬──────┘  └──────┬──────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
│   DuckDB     │  │   SQLite    │  │    Redis    │
│  (Analytics) │  │  (Memory)   │  │   (Cache)   │
└──────────────┘  └─────────────┘  └─────────────┘
```

### System Requirements

**Minimum Requirements**:
- CPU: 4 cores
- RAM: 8 GB
- Storage: 50 GB SSD
- OS: Ubuntu 20.04 LTS or later, Windows Server 2019+

**Recommended for Production**:
- CPU: 8+ cores
- RAM: 16+ GB
- Storage: 200+ GB SSD (NVMe preferred)
- OS: Ubuntu 22.04 LTS
- Network: 1 Gbps

### Dependencies

- Node.js 18.x or later
- npm 9.x or later
- DuckDB 0.9.x or later
- SQLite 3.40.x or later
- Redis 7.x or later
- Docker 24.x (for containerized deployment)

## Installation and Deployment

### Docker Deployment (Recommended)

**Step 1: Clone Repository**

```bash
git clone https://github.com/your-org/rosteriq-ai-agent.git
cd rosteriq-ai-agent
```

**Step 2: Configure Environment**

```bash
cp .env.example .env
nano .env
```

Required environment variables:

```bash
# Application
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
DUCKDB_PATH=/data/rosteriq.duckdb
SQLITE_PATH=/data/memory.sqlite
REDIS_URL=redis://redis:6379

# Authentication
JWT_SECRET=your-secure-secret-key-min-32-chars
JWT_EXPIRATION=24h

# External Services
GEMINI_API_KEY=your-gemini-api-key
WEB_SEARCH_API_KEY=your-search-api-key
EMBEDDING_API_KEY=your-embedding-api-key

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
METRICS_PORT=9090

# Security
ENABLE_RATE_LIMITING=true
ENABLE_CORS=true
ALLOWED_ORIGINS=https://your-domain.com

# Data
CSV_DATA_PATH=/data/csv
BACKUP_PATH=/backups
```

**Step 3: Build and Deploy**

```bash
# Build Docker images
docker-compose build

# Start services
docker-compose up -d

# Verify deployment
docker-compose ps
docker-compose logs -f api
```

**Step 4: Initialize Database**

```bash
# Run database migrations
docker-compose exec api npm run db:migrate

# Load initial data
docker-compose exec api npm run data:load

# Verify data
docker-compose exec api npm run data:verify
```

**Step 5: Create Admin User**

```bash
docker-compose exec api npm run user:create -- \
  --email admin@healthcare.com \
  --role admin \
  --name "System Administrator"
```

### Manual Deployment

**Step 1: Install Dependencies**

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install build tools
sudo apt-get install -y build-essential python3
```

**Step 2: Install Application**

```bash
# Clone and install
git clone https://github.com/your-org/rosteriq-ai-agent.git
cd rosteriq-ai-agent
npm install --production

# Build application
npm run build
```

**Step 3: Configure System Service**

Create `/etc/systemd/system/rosteriq.service`:

```ini
[Unit]
Description=RosterIQ AI Agent
After=network.target redis.service

[Service]
Type=simple
User=rosteriq
WorkingDirectory=/opt/rosteriq
Environment=NODE_ENV=production
EnvironmentFile=/opt/rosteriq/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=rosteriq

[Install]
WantedBy=multi-user.target
```

**Step 4: Start Service**

```bash
sudo systemctl daemon-reload
sudo systemctl enable rosteriq
sudo systemctl start rosteriq
sudo systemctl status rosteriq
```

