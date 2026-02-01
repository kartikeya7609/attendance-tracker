
# Find keytool
$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) {
    # Try common Android Studio locations
    $paths = @(
        "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe",
        "C:\Program Files\Android\Android Studio\jre\bin\keytool.exe",
        "C:\Program Files\Java\jdk*\bin\keytool.exe"
    )
    foreach ($path in $paths) {
        $found = Get-ChildItem $path -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $keytool = $found.FullName
            break
        }
    }
}

if (-not $keytool) {
    Write-Error "Could not find keytool.exe. Please ensure JDK/Android Studio is installed."
    exit 1
}

Write-Host "Found keytool at: $keytool"

# Generate Keystore
$keystorePath = "android\app\my-release-key.keystore"
$alias = "my-key-alias"
$password = "password"

& $keytool -genkey -v -keystore $keystorePath -alias $alias -keyalg RSA -keysize 2048 -validity 10000 -storepass $password -keypass $password -dname "CN=Attendance Tracker, OU=App, O=Organization, L=City, ST=State, C=US"

if ($?) {
    Write-Host "✅ Keystore created at: $keystorePath"
    Write-Host "🔑 Alias: $alias"
    Write-Host "🔒 Password: $password"
    
    # Get SHA-1
    Write-Host "`n----- SHA-1 FINGERPRINT (ADD TO FIREBASE) -----"
    & $keytool -list -v -keystore $keystorePath -alias $alias -storepass $password | Select-String "SHA1:"
    Write-Host "-----------------------------------------------"
} else {
    Write-Error "Failed to generate keystore"
}
