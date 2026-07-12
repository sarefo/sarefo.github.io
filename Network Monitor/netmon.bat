@echo off
rem Start the local port-info server (exits by itself if already running,
rem and shuts down ~90s after the applet window is closed).
start "" pyw -3.13 "%~dp0netmon_server.py"
timeout /t 1 /nobreak >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:8399/ --window-size=340,520
