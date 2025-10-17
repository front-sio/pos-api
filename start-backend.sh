#!/bin/bash
# =================================================================
# Start all POS backend microservices + gateway in background
# Logs will be saved in each service folder
# =================================================================

# Exit on any error
set -e

BASE_DIR=$(pwd)

echo "Starting POS backend services..."

services=(
  "auth-service"
  "products-service"
  "customers-service"
  "sales-service"
  "invoices-service"
  "returns-service"
  "expenses-service"
  "reports-service"
  "supplier-service"
)

# Start all microservices
for service in "${services[@]}"; do
  echo "Starting $service..."
  cd "$BASE_DIR/$service"
  nohup pnpm start > "$service.log" 2>&1 &
done

# Start gateway
echo "Starting gateway..."
cd "$BASE_DIR"
nohup node server.js > gateway.log 2>&1 &

echo "All services and gateway started!"
echo "Check individual logs for each service (e.g., auth-service/auth-service.log) or gateway.log"
