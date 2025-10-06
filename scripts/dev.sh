#!/usr/bin/env bash

# Stop on error
set -e

echo "Installing dependencies..."
npm install

echo "Setting up database..."
npx prisma migrate dev --name init

echo "Starting development server..."
npm run dev