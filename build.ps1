# PowerShell script to package Chrome and Firefox builds for No Shorts Ext
# Usage: Run from extension root directory



# Get and increment version from manifest.chrome.json
$chromeManifest = Get-Content './manifest.chrome.json' -Raw | ConvertFrom-Json
$verParts = $chromeManifest.version.Split('.')
$verParts[2] = [string]([int]$verParts[2] + 1)
$newVersion = "$($verParts[0]).$($verParts[1]).$($verParts[2])"
$version = $newVersion -replace '\.', '_'

# Update version in manifest.chrome.json
$chromeManifest.version = $newVersion
$chromeManifest | ConvertTo-Json -Depth 10 | Set-Content './manifest.chrome.json'

# Update version in manifest.firefox.json
$firefoxManifest = Get-Content './manifest.firefox.json' -Raw | ConvertFrom-Json
$firefoxManifest.version = $newVersion
$firefoxManifest | ConvertTo-Json -Depth 10 | Set-Content './manifest.firefox.json'




# Chrome build
Copy-Item './manifest.chrome.json' './manifest.json' -Force
$chromeZip = "./builds/${version}.chrome.zip"
if (Test-Path $chromeZip) { Remove-Item $chromeZip }
Compress-Archive -Path './src', './manifest.json' -DestinationPath $chromeZip
Remove-Item './manifest.json'




# Firefox build
Copy-Item './manifest.firefox.json' './manifest.json' -Force
$firefoxZip = "./builds/${version}.firefox.zip"
if (Test-Path $firefoxZip) { Remove-Item $firefoxZip }
Compress-Archive -Path './src', './manifest.json' -DestinationPath $firefoxZip
Remove-Item './manifest.json'

Write-Host 'Builds created:'
Write-Host $chromeZip
Write-Host $firefoxZip
