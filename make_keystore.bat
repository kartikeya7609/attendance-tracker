@echo off
setlocal

set KEYSTORE_PATH=android\app\my-release-key.keystore
set KEY_ALIAS=my-key-alias
set KEY_PASS=password

echo Searching for keytool...

:: Try to find keytool in common locations
if exist "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" (
    set "KEYTOOL=C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
    goto :FOUND
)
if exist "C:\Program Files\Android\Android Studio\jre\bin\keytool.exe" (
    set "KEYTOOL=C:\Program Files\Android\Android Studio\jre\bin\keytool.exe"
    goto :FOUND
)
for /d %%i in ("C:\Program Files\Java\jdk*") do (
    if exist "%%i\bin\keytool.exe" (
        set "KEYTOOL=%%i\bin\keytool.exe"
        goto :FOUND
    )
)

echo Error: Could not find keytool.exe.
echo Please ensure Android Studio or Java JDK is installed in default locations.
exit /b 1

:FOUND
echo Found keytool at: "%KEYTOOL%"
echo Generating keystore...

"%KEYTOOL%" -genkey -v -keystore "%KEYSTORE_PATH%" -alias %KEY_ALIAS% -keyalg RSA -keysize 2048 -validity 10000 -storepass %KEY_PASS% -keypass %KEY_PASS% -dname "CN=Attendance Tracker, OU=App, O=Attendance, L=City, ST=State, C=US"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo SUCCESS! Keystore created at: %KEYSTORE_PATH%
    echo ========================================================
    echo.
    echo SHA-1 FINGERPRINT (ADD TO FIREBASE):
    "%KEYTOOL%" -list -v -keystore "%KEYSTORE_PATH%" -alias %KEY_ALIAS% -storepass %KEY_PASS% | findstr "SHA1:"
    echo.
) else (
    echo Failed to generate keystore.
)

endlocal
