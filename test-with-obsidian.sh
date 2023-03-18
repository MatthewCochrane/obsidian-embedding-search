#!/bin/bash

# Set the path to your Obsidian vault
OBSIDIAN_VAULT_PATH="$1"

# Build the plugin
npm run build

# Copy the plugin files to the Obsidian vault
echo "${OBSIDIAN_VAULT_PATH}"
mkdir -p "$OBSIDIAN_VAULT_PATH/.obsidian/plugins/obsidian-embedding-search/"
cp main.js "$OBSIDIAN_VAULT_PATH/.obsidian/plugins/obsidian-embedding-search/"
cp manifest.json "$OBSIDIAN_VAULT_PATH/.obsidian/plugins/obsidian-embedding-search/"

echo "Plugin successfully built and copied to the Obsidian vault."
