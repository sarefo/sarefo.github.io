@echo off
rem Build the Audio Bridge Android client and install it on the connected phone.
rem Pins JAVA_HOME to Android Studio's JBR 21: the system Java (23) is rejected
rem by the Android Gradle Plugin. Uses the Gradle distribution already unpacked
rem in the wrapper cache -- no gradle on PATH needed.

setlocal
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "GRADLE=%USERPROFILE%\.gradle\wrapper\dists\gradle-8.11.1-bin\bpt9gzteqjrbo1mjrsomdt32c\gradle-8.11.1\bin\gradle.bat"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

cd /d "%~dp0android"
call "%GRADLE%" --console=plain assembleDebug || exit /b 1

echo.
echo Installing on connected device(s)...
rem Plain `adb install` errors out when more than one device is attached, so
rem install per serial. Also surface devices adb can see but cannot use yet
rem (unauthorized = accept the debugging prompt on the phone).
set FOUND=0
for /f "skip=1 tokens=1,2" %%D in ('"%ADB%" devices') do (
    if "%%E"=="device" (
        set FOUND=1
        echo   %%D
        "%ADB%" -s %%D install -r "app\build\outputs\apk\debug\app-debug.apk"
    ) else if not "%%E"=="" (
        echo   %%D skipped: state "%%E" -- check the phone's screen
    )
)
if "%FOUND%"=="0" (
    echo No usable device. On the phone: enable Developer options ^> USB
    echo debugging, turn OFF USB tethering, and accept the debugging prompt.
)
