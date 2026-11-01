# ============================================================
#  Генератор Markdown-отчёта по структуре папки
#  PowerShell 5.1
#  ВАЖНО: сохранить файл в кодировке UTF-8 with BOM!
#  cd "C:\Users\MI\opencode"
#  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#  .\report.ps1
# ============================================================

# --- Настройки ---
$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
if ([string]::IsNullOrEmpty($RootPath)) {
    $RootPath = (Get-Location).Path
}

# Если задана переменная окружения — используем её
if ($env:ANALYZE_PATH) { $RootPath = $env:ANALYZE_PATH }

$OutputDir = Join-Path $RootPath "_Reports"
$MdFile    = Join-Path $OutputDir "structure_report.md"
$DateStr   = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

if (-not (Test-Path $RootPath)) {
    Write-Host "Папка не найдена: $RootPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

Write-Host "Сканирую: $RootPath" -ForegroundColor Cyan

$files = Get-ChildItem -Path $RootPath -Recurse -File -Force |
         Where-Object { $_.FullName -notlike "*\_Reports\*" }

# --- Функция форматирования размера ---
function Format-Size {
    param([long]$Bytes)
    if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }
    return "$Bytes B"
}

# --- Экранирование Markdown (только |, без обратного апострофа) ---
function Esc-Md {
    param([string]$Text)
    if ($null -eq $Text) { return "" }
    return $Text.Replace("|", "\|")
}

# ============================================================
#  СБОР ДАННЫХ
# ============================================================

$totalFiles = $files.Count
$totalBytes = ($files | Measure-Object -Property Length -Sum).Sum
if ($null -eq $totalBytes) { $totalBytes = 0 }

$byExt = $files | Group-Object Extension | Sort-Object { ($_.Group | Measure-Object Length -Sum).Sum } -Descending
$top10 = $files | Sort-Object Length -Descending | Select-Object -First 10

$topFolders = Get-ChildItem -Path $RootPath -Directory -Force |
              Where-Object { $_.Name -ne "_Reports" }

$rootFiles = Get-ChildItem -Path $RootPath -File -Force

# ============================================================
#  ФОРМИРОВАНИЕ MARKDOWN
# ============================================================

$md = New-Object System.Collections.Generic.List[string]

$md.Add("# Структура папки: $(Split-Path $RootPath -Leaf)")
$md.Add("")
$md.Add("**Полный путь:** ``$RootPath``")
$md.Add("")
$md.Add("**Дата отчёта:** $DateStr")
$md.Add("")
$md.Add("---")
$md.Add("")

# --- Общая сводка ---
$md.Add("## Общая сводка")
$md.Add("")
$md.Add("| Показатель | Значение |")
$md.Add("|---|---|")
$md.Add("| Всего файлов | $totalFiles |")
$md.Add("| Общий размер | $(Format-Size $totalBytes) |")
$md.Add("| Папок верхнего уровня | $($topFolders.Count) |")
$md.Add("| Файлов в корне | $($rootFiles.Count) |")
$md.Add("")
$md.Add("---")
$md.Add("")

# --- Разбивка по форматам ---
$md.Add("## Разбивка по форматам")
$md.Add("")
$md.Add("| Формат | Файлов | Размер | % от объёма |")
$md.Add("|---|---:|---:|---:|")
foreach ($g in $byExt) {
    $extName = if ($g.Name) { $g.Name.ToLower() } else { "(без)" }
    $count   = $g.Count
    $bytes   = ($g.Group | Measure-Object Length -Sum).Sum
    $pct     = if ($totalBytes -gt 0) { "{0:N1}%" -f ($bytes / $totalBytes * 100) } else { "0%" }
    $md.Add("| ``$extName`` | $count | $(Format-Size $bytes) | $pct |")
}
$md.Add("")
$md.Add("---")
$md.Add("")

# --- Топ-10 ---
$md.Add("## Топ-10 крупнейших файлов")
$md.Add("")
$md.Add("| # | Размер | Файл |")
$md.Add("|---:|---:|---|")
$i = 1
foreach ($f in $top10) {
    $rel = Esc-Md ($f.FullName.Replace($RootPath, "."))
    $md.Add("| $i | $(Format-Size $f.Length) | ``$rel`` |")
    $i++
}
$md.Add("")
$md.Add("---")
$md.Add("")

# --- По папкам верхнего уровня ---
$md.Add("## Разбивка по папкам верхнего уровня")
$md.Add("")
$md.Add("| Папка | Файлов | Размер |")
$md.Add("|---|---:|---:|")
foreach ($folder in $topFolders) {
    $subFiles = Get-ChildItem -Path $folder.FullName -Recurse -File -Force -ErrorAction SilentlyContinue
    $cnt  = $subFiles.Count
    $size = if ($cnt -gt 0) { ($subFiles | Measure-Object Length -Sum).Sum } else { 0 }
    $name = Esc-Md $folder.Name
    $md.Add("| ``$name`` | $cnt | $(Format-Size $size) |")
}
if ($rootFiles.Count -gt 0) {
    $size = ($rootFiles | Measure-Object Length -Sum).Sum
    $md.Add("| ``(файлы в корне)`` | $($rootFiles.Count) | $(Format-Size $size) |")
}
$md.Add("")
$md.Add("---")
$md.Add("")

# --- Дерево ---
$md.Add("## Дерево файлов")
$md.Add("")
$md.Add('```text')

function Add-Tree {
    param(
        [string]$Path,
        [string]$Indent = ""
    )

    $items = Get-ChildItem -Path $Path -Force |
             Where-Object { $_.FullName -notlike "*\_Reports*" } |
             Sort-Object @{Expression={$_.PSIsContainer}; Descending=$true}, Name

    for ($i = 0; $i -lt $items.Count; $i++) {
        $item   = $items[$i]
        $isLast = ($i -eq $items.Count - 1)
        $branch = if ($isLast) { "└── " } else { "├── " }

        if ($item.PSIsContainer) {
            $md.Add("$Indent$branch[$($item.Name)]")
            $newIndent = $Indent + $(if ($isLast) { "    " } else { "│   " })
            Add-Tree -Path $item.FullName -Indent $newIndent
        }
        else {
            $size = Format-Size $item.Length
            $ext  = if ($item.Extension) { $item.Extension.ToLower() } else { "(без)" }
            $md.Add("$Indent$branch$($item.Name)  —  $size  [$ext]")
        }
    }
}

Add-Tree -Path $RootPath
$md.Add('```')
$md.Add("")

# --- Полный список файлов ---
$md.Add("---")
$md.Add("")
$md.Add("## Полный список файлов")
$md.Add("")
$md.Add("| Файл | Формат | Размер | Изменён |")
$md.Add("|---|---|---:|---|")
foreach ($f in ($files | Sort-Object FullName)) {
    $rel  = Esc-Md ($f.FullName.Replace($RootPath, "."))
    $ext  = if ($f.Extension) { $f.Extension.ToLower() } else { "(без)" }
    $size = Format-Size $f.Length
    $mod  = $f.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
    $md.Add("| ``$rel`` | ``$ext`` | $size | $mod |")
}
$md.Add("")

$md.Add("---")
$md.Add("")
$md.Add("*Отчёт сгенерирован автоматически скриптом PowerShell 5.1.*")

# ============================================================
#  СОХРАНЕНИЕ
# ============================================================

$md | Out-File -FilePath $MdFile -Encoding UTF8

# ============================================================
#  ВЫВОД В КОНСОЛЬ
# ============================================================
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Yellow
Write-Host "ГОТОВО. Отчёт сохранён:" -ForegroundColor Yellow
Write-Host "  $MdFile" -ForegroundColor White
Write-Host ("=" * 60) -ForegroundColor Yellow
Write-Host ""
Write-Host "Краткая сводка:" -ForegroundColor Cyan
Write-Host "  Всего файлов: $totalFiles"
Write-Host "  Общий размер: $(Format-Size $totalBytes)"
Write-Host ""
Write-Host "По форматам:" -ForegroundColor Cyan
foreach ($g in $byExt | Select-Object -First 10) {
    $extName = if ($g.Name) { $g.Name.ToLower() } else { "(без)" }
    $bytes   = ($g.Group | Measure-Object Length -Sum).Sum
    Write-Host ("  {0,-12} {1,5} файл(ов)  {2,12}" -f $extName, $g.Count, (Format-Size $bytes))
}
Write-Host ""