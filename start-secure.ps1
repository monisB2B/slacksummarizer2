Write-Host "Starting Slack Summarizer with HTTPS..." -ForegroundColor Cyan

Write-Host "Checking for required certificates..." -ForegroundColor Yellow
if (-not (Test-Path ".\certs\cert.pem")) {
    Write-Host "No certificates found. Generating self-signed certificates..." -ForegroundColor Yellow
    node generate-certs.js
}
else {
    Write-Host "Certificates found. Using existing certificates." -ForegroundColor Green
}

Write-Host "Starting secure server..." -ForegroundColor Cyan
node secure-server.js