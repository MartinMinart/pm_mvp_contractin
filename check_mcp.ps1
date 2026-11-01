# check_mcp.ps1 — проверка MCP-серверов для OpenCode на Windows

Write-Host "=== 1. Проверка путей ===" -ForegroundColor Cyan

$fsPath = "C:\Users\MI\AppData\Local\npm-cache\_npx\a3241bba59c344f5\node_modules\@modelcontextprotocol\server-filesystem\dist\index.js"
Write-Host "filesystem index.js: $(Test-Path $fsPath)"

$duckdb = Get-Command uvx -ErrorAction SilentlyContinue
Write-Host "uvx: $(if ($duckdb) { $duckdb.Source } else { 'NOT FOUND' })"

$node = Get-Command node -ErrorAction SilentlyContinue
Write-Host "node: $(if ($node) { $node.Source } else { 'NOT FOUND' })"

Write-Host "`n=== 2. Прямой запуск filesystem (5 сек) ===" -ForegroundColor Cyan
if (Test-Path $fsPath) {
    $job = Start-Job -ScriptBlock {
        param($p)
        & node $p "." 2>&1
    } -ArgumentList $fsPath
    Start-Sleep -Seconds 5
    $out = Receive-Job $job -Keep
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -Force -ErrorAction SilentlyContinue
    if ($out -match "running on stdio|allowed directories") {
        Write-Host "✅ filesystem стартует" -ForegroundColor Green
    } else {
        Write-Host "❌ filesystem НЕ стартует. Вывод:" -ForegroundColor Red
        $out | Select-Object -First 10
    }
} else {
    Write-Host "❌ Путь к filesystem не существует. Нужен новый npm install -g" -ForegroundColor Red
}

Write-Host "`n=== 3. Прямой запуск duckdb (5 сек) ===" -ForegroundColor Cyan
if ($duckdb) {
    $job = Start-Job -ScriptBlock {
        & uvx mcp-server-motherduck --db-path analytics.duckdb --read-write 2>&1
    }
    Start-Sleep -Seconds 5
    $out = Receive-Job $job -Keep
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -Force -ErrorAction SilentlyContinue
    if ($out -match "running|ready|stdio") {
        Write-Host "✅ duckdb стартует" -ForegroundColor Green
    } else {
        Write-Host "⚠️ duckdb: вывод не распознан (может работать). Первые строки:" -ForegroundColor Yellow
        $out | Select-Object -First 5
    }
} else {
    Write-Host "❌ uvx не найден. Установи: pip install uv" -ForegroundColor Red
}

Write-Host "`n=== 4. opencode mcp list ===" -ForegroundColor Cyan
opencode mcp list 2>&1

Write-Host "`n=== 5. opencode plugin list ===" -ForegroundColor Cyan
opencode plugin list 2>&1