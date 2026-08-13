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
"%ADB%" install -r "app\build\outputs\apk\debug\app-debug.apk"
