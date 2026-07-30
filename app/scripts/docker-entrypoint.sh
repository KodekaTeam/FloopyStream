#!/bin/sh
set -eu

echo "Running database migrations..."
npm run migrate

exec "$@"
