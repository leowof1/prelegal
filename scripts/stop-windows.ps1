# Stop and remove the Prelegal container.
docker rm -f prelegal 2>$null | Out-Null
Write-Host "Prelegal stopped"
