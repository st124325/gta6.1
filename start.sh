#!/usr/bin/env bash
PORT=8080

# Check if port 8080 is free, else use 8081
if lsof -i :$PORT >/dev/null 2>&1; then
  PORT=8081
fi

echo "=========================================================="
echo " 🚗 GTA V Web Edition (MVP) запуск..."
echo " Открытие в браузере: http://localhost:$PORT"
echo " Нажмите Ctrl+C для остановки."
echo "=========================================================="

(sleep 1 && xdg-open "http://localhost:$PORT" 2>/dev/null || sensible-browser "http://localhost:$PORT" 2>/dev/null) &
python3 -m http.server $PORT --directory /home/artem/game
