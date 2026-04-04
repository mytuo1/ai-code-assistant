#!/bin/bash
export FORCE_COLOR=1
export TERM=xterm-256color
export COLORTERM=truecolor
script -q -c "bun run src/main.tsx" /dev/null
