# RoadTrip Co-Pilot — Deployment Makefile
# Manages deployment of the Claude Code bot to superapp-core VM.

-include ../.env
export

PROJECT       ?= flare-network-sandbox
APP_VM_NAME   ?= superapp-core
REMOTE_DIR    ?= /opt/roadtrip
REPO_URL      ?= $(ROADTRIP_REPO)

# Helper: find VM zone
ZONE = $(shell gcloud compute instances list --project=$(PROJECT) --filter="name=$(APP_VM_NAME)" --format="value(zone)" 2>/dev/null)

# ── Deploy ────────────────────────────────────────────────────────────

.PHONY: deploy setup start stop status ssh logs help

deploy: ## Pull latest code on VM and install deps
	@if [ -z "$(ZONE)" ]; then echo "VM '$(APP_VM_NAME)' not found"; exit 1; fi; \
	echo "Deploying to $(APP_VM_NAME)..."; \
	gcloud compute ssh $(APP_VM_NAME) --zone=$(ZONE) --project=$(PROJECT) --tunnel-through-iap \
		-- "bash $(REMOTE_DIR)/deploy/deploy.sh"

setup: ## First-time VM setup (clone repo, install deps)
	@if [ -z "$(ZONE)" ]; then echo "VM '$(APP_VM_NAME)' not found"; exit 1; fi; \
	if [ -z "$(REPO_URL)" ]; then echo "Set ROADTRIP_REPO in .env or environment"; exit 1; fi; \
	echo "Copying setup script..."; \
	gcloud compute scp setup-vm.sh $(APP_VM_NAME):~/roadtrip-setup.sh \
		--zone=$(ZONE) --project=$(PROJECT) --tunnel-through-iap; \
	echo "Running setup on VM..."; \
	gcloud compute ssh $(APP_VM_NAME) --zone=$(ZONE) --project=$(PROJECT) --tunnel-through-iap \
		-- "ROADTRIP_REPO=$(REPO_URL) bash ~/roadtrip-setup.sh"

start: ## Create and activate the roadtrip session
	@if [ -z "$(ZONE)" ]; then echo "VM '$(APP_VM_NAME)' not found"; exit 1; fi; \
	echo "Starting roadtrip bot on $(APP_VM_NAME)..."; \
	gcloud compute ssh $(APP_VM_NAME) --zone=$(ZONE) --project=$(PROJECT) --tunnel-through-iap \
		-- "bash $(REMOTE_DIR)/deploy/start.sh"

stop: ## Stop the roadtrip session
	@if [ -z "$(ZONE)" ]; then echo "VM '$(APP_VM_NAME)' not found"; exit 1; fi; \
	gcloud compute ssh $(APP_VM_NAME) --zone=$(ZONE) --project=$(PROJECT) --tunnel-through-iap \
		-- 'SESSIONS=$$(curl -sf localhost:9001/sessions); \
		    SID=$$(echo "$$SESSIONS" | python3 -c "import json,sys; ss=json.load(sys.stdin); print(next((s[\"id\"] for s in ss if s[\"name\"]==\"roadtrip\"),\"\"))"); \
		    if [ -n "$$SID" ]; then curl -sf -X POST "localhost:9001/sessions/$$SID/stop"; echo "Stopped session $$SID"; \
		    else echo "No roadtrip session found"; fi'

status: ## Check health of all services
	@if [ -z "$(ZONE)" ]; then echo "VM '$(APP_VM_NAME)' not found"; exit 1; fi; \
	gcloud compute ssh $(APP_VM_NAME) --zone=$(ZONE) --project=$(PROJECT) --tunnel-through-iap \
		-- 'printf "Session manager: "; curl -sf http://localhost:9001/health 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin).get(\"status\",\"?\"))" || echo "DOWN"; \
		    printf "Voice channel (9002): "; curl -sf http://localhost:9002/health 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin).get(\"status\",\"?\"))" || echo "DOWN"; \
		    printf "Claude session: "; tmux list-sessions -F "#{session_name}" 2>/dev/null | grep -q "^session-" && echo "RUNNING" || echo "DOWN"'

ssh: ## SSH into the VM
	@if [ -z "$(ZONE)" ]; then echo "VM '$(APP_VM_NAME)' not found"; exit 1; fi; \
	gcloud compute ssh $(APP_VM_NAME) --project=$(PROJECT) --zone=$(ZONE) --tunnel-through-iap

logs: ## Attach to the tmux session (view Claude Code output)
	@if [ -z "$(ZONE)" ]; then echo "VM '$(APP_VM_NAME)' not found"; exit 1; fi; \
	gcloud compute ssh $(APP_VM_NAME) --zone=$(ZONE) --project=$(PROJECT) --tunnel-through-iap \
		-- 'SN=$$(tmux list-sessions -F "#{session_name}" 2>/dev/null | grep "^session-" | head -1); \
		    if [ -n "$$SN" ]; then tmux attach -t "$$SN"; else echo "No active session"; fi'

# ── Help ──────────────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
