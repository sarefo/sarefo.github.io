@echo off
rem Start the local port-info server (exits by itself if already running,
rem and shuts down ~90s after the applet window is closed).
start "" pyw -3.13 "%~dp0netmon_server.py"
timeout /t 1 /nobreak >nul
rem Matches DEFAULT_SIZE.compact in netmon.html so a fresh start doesn't flash
rem at one size then jump to another. After the first manual resize the page
rem restores its own remembered size and this value stops mattering.
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:8399/ --window-size=560,150
