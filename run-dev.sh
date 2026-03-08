#!/usr/bin/env bash
# Run from your own terminal (where npm is on PATH): ./run-dev.sh
# Or: bash run-dev.sh
cd "$(dirname "$0")"
npm install && npm run dev
