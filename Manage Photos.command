#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
photo_project="${0:A:h}"
for photo_python in /usr/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3; do
  if [[ -x "$photo_python" ]] && "$photo_python" -c 'import PIL' >/dev/null 2>&1; then
    exec "$photo_python" "$photo_project/tools/photo-editor/server.py" "$@"
  fi
done
print "The photo editor needs Python 3 with Pillow installed."
print "Press Return to close."
read
