#!/bin/bash
# start_server.sh

set -e  # exit if anything fails

# Ensure NVM and Node 20 are active
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 20

# Install dependencies (safe even if already installed)
npm install

# Start server with nodemon (auto-restarts on file changes)
npm start