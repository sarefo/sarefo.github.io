@echo off
rem Start the Audio Bridge server (exits by itself if already running, and
rem shuts down shortly after the panel window is closed).
start "" pyw -3.13 "%~dp0audiobridge_server.py"
timeout /t 1 /nobreak >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:8400/ --window-size=460,420
