# Build the Prelegal image and run it at http://localhost:8000 (a fresh database every start).
Set-Location (Join-Path $PSScriptRoot "..")

docker build -t prelegal .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker rm -f prelegal 2>$null | Out-Null
$envArgs = if (Test-Path .env) { @("--env-file", ".env") } else { @() }
docker run -d --name prelegal -p 8000:8000 @envArgs prelegal | Out-Null
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Prelegal is running at http://localhost:8000"
