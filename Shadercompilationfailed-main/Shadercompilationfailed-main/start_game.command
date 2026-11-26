#!/bin/bash
# 棋格幻境 Checkered Paradox: start the game on a Mac (the Mac version of start_game.bat).
# Double-click this file in Finder. It starts a small local server and opens the game in your browser.
# If double-clicking does not work, see "Mac 打开说明.txt" next to this file. The surest way: open Terminal, type  bash  and a space,
# drag this file into the window, press Return.

cd "$(dirname "$0")" || exit 1
PORT=8080
URL="http://127.0.0.1:$PORT"

# open the browser a moment after the server has started
open_browser() { sleep 1.5; open "$URL"; }

# Python 3 that really runs. On a Mac without the developer tools, /usr/bin/python3 is only a stub that pops up an installer: skip it then.
have_python3() {
  local p; p="$(command -v python3 2>/dev/null)" || return 1
  if [ "$p" = "/usr/bin/python3" ] && ! xcode-select -p >/dev/null 2>&1; then return 1; fi
  "$p" -c 'import http.server' >/dev/null 2>&1
}

echo "Starting Shader Compilation Failed at $URL"
echo "(keep this window open while you play; close it to stop the game)"
echo

if command -v node >/dev/null 2>&1; then
  open_browser &
  node server.js
elif have_python3; then
  echo "Node.js not found, using Python 3."
  open_browser &
  python3 -m http.server "$PORT" --bind 127.0.0.1 --directory source
elif command -v ruby >/dev/null 2>&1 && ruby -e 'require "webrick"' >/dev/null 2>&1; then
  echo "Node.js and Python 3 not found, using Ruby."
  open_browser &
  ruby -run -e httpd source -p "$PORT" -b 127.0.0.1
else
  echo "No way to run a local server was found on this Mac."
  echo "Install Node.js (the LTS version) from https://nodejs.org , then double-click this file again."
  open "https://nodejs.org" 2>/dev/null
fi

echo
read -n 1 -s -r -p "Press any key to close this window..."
echo
