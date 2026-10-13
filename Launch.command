#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  print 'Node.js is required to start Point Cloud Studio.'
  read '?Press Return to close.'
  exit 1
fi
node launch.mjs
