.PHONY: help install test run clean docker

help:
	@echo "AI Agent System - Available Commands:"
	@echo "  make install    - Install dependencies"
	@echo "  make test       - Run tests"
	@echo "  make run        - Run development server"
	@echo "  make docker     - Build and run with Docker"
	@echo "  make clean      - Clean generated files"
	@echo "  make cli        - Run CLI interface"

install:
	python -m venv venv
	. venv/bin/activate && pip install -r requirements.txt
	cd frontend && npm install

test:
	. venv/bin/activate && pytest tests/ -v

run:
	. venv/bin/activate && cd api && uvicorn main:app --reload &
	cd frontend && npm run dev

docker:
	docker-compose -f docker/docker-compose.yml up --build

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache
	rm -rf htmlcov
	rm -rf logs/*.log

cli:
	. venv/bin/activate && python cli/agent_cli.py
