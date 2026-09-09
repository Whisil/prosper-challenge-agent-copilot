# Prosper Challenge — run everything from the repo root.
# Dependencies are managed with uv (https://docs.astral.sh/uv/).

PROJECT := backend
UV_CACHE_DIR ?= $(CURDIR)/.uv-cache
RUNNER_HOST ?= 127.0.0.1

.PHONY: help install run backend-test frontend-install frontend-dev frontend-build frontend-lint frontend-test frontend-typecheck clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Create the venv and install dependencies (from uv.lock)
	UV_CACHE_DIR=$(UV_CACHE_DIR) uv sync --directory $(PROJECT)

run: ## Run the voice agent (then open http://localhost:7860/client)
	UV_CACHE_DIR=$(UV_CACHE_DIR) uv run --directory $(PROJECT) python bot.py --host $(RUNNER_HOST)

backend-test: ## Run backend tests
	UV_CACHE_DIR=$(UV_CACHE_DIR) uv run --directory $(PROJECT) pytest

frontend-install: ## Install frontend dependencies with pnpm
	pnpm --dir frontend install

frontend-dev: ## Run the frontend development server
	pnpm --dir frontend dev

frontend-build: ## Build the frontend for production
	pnpm --dir frontend build

frontend-lint: ## Lint frontend source files
	pnpm --dir frontend lint

frontend-test: ## Run frontend tests
	pnpm --dir frontend test

frontend-typecheck: ## Type-check frontend source files
	pnpm --dir frontend typecheck

clean: ## Remove the venv and Python caches
	rm -rf $(PROJECT)/.venv
	find $(PROJECT) -type d -name __pycache__ -prune -exec rm -rf {} +
