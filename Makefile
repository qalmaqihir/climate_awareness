# Climate Awareness GB — dev tasks
.DEFAULT_GOAL := help
.PHONY: help setup hooks lint lint-all fmt test test-agents test-web \
        typecheck security audit up down logs clean pre-push

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} \
	  /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ---------------- One-time developer setup ----------------
setup: ## Install pre-commit + git commit template
	pip install --user pre-commit || pipx install pre-commit
	pre-commit install --install-hooks
	pre-commit install --hook-type commit-msg
	pre-commit install --hook-type pre-push
	git config commit.template .gitmessage
	@echo "Setup complete. Commit template + hooks installed."

hooks: ## Re-install / update hook binaries
	pre-commit autoupdate
	pre-commit install --install-hooks

# ---------------- Lint / format ----------------
lint: ## Run pre-commit on staged files
	pre-commit run

lint-all: ## Run pre-commit on all files
	pre-commit run --all-files

fmt: ## Auto-format everything
	@if [ -d agents ]; then cd agents && uv run ruff format . && uv run ruff check --fix .; fi
	@if [ -d web ]; then cd web && pnpm exec prettier --write . && pnpm exec eslint --fix . || true; fi

typecheck: ## Type-check agents (mypy) + web (tsc)
	@if [ -d agents ]; then cd agents && uv run mypy .; fi
	@if [ -d web ]; then cd web && pnpm typecheck; fi

# ---------------- Tests ----------------
test: test-agents test-web ## Run all tests

test-agents: ## Python tests + coverage
	@if [ -d agents ]; then cd agents && uv run pytest; else echo "agents/ not present, skip"; fi

test-web: ## JS/TS tests
	@if [ -d web ]; then cd web && pnpm test -- --run; else echo "web/ not present, skip"; fi

# ---------------- Security ----------------
security: ## Run gitleaks on repo
	pre-commit run gitleaks --all-files

audit: ## Dependency vuln audit
	@if [ -d agents ]; then cd agents && uv run pip-audit || true; fi
	@if [ -d web ]; then cd web && pnpm audit --audit-level=high || true; fi

# ---------------- Pre-push gate ----------------
pre-push: lint-all typecheck test security ## Full local gate before push

# ---------------- Docker ----------------
up: ## docker compose up -d
	docker compose up -d

down: ## docker compose down
	docker compose down

logs: ## Tail service logs
	docker compose logs -f --tail=100

# ---------------- Housekeeping ----------------
clean: ## Remove caches
	find . -type d \( -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache -o -name .mypy_cache -o -name htmlcov \) -prune -exec rm -rf {} + 2>/dev/null || true
	find . -type f \( -name .coverage -o -name coverage.xml \) -delete 2>/dev/null || true
