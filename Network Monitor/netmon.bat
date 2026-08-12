@echo off
rem Start the local port-info server (exits by itself if already running,
rem and shuts down ~90s after the applet window is closed).
start "" pyw -3.13 "%~dp0netmon_server.py"
timeout /t 1 /nobreak >nul
rem NOTE: Chrome ignores --window-size when a browser session is already running
rem (it reuses that session and restores its own remembered bounds instead), so
rem this is only honored on a cold start. The page shrink-wraps itself to the
rem compact bar either way -- see fitCompactSize() in netmon.html.
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://127.0.0.1:8399/ --window-size=420,72
