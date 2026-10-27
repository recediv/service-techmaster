$ErrorActionPreference = 'Stop'
$demoProjectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$demoServeScript = [System.IO.Path]::GetFullPath((Join-Path $demoProjectRoot 'scripts/serve.mjs'))
$demoPidFile = Join-Path $demoProjectRoot '.local/demo.pid'

if (-not (Test-Path -LiteralPath $demoPidFile -PathType Leaf)) {
    Write-Output 'Нет .local/demo.pid: фоновой запуск этого сайта не зарегистрирован. Другие процессы не изменены.'
    return
}
$demoProcessId = 0
if (-not [int]::TryParse((Get-Content -LiteralPath $demoPidFile -Raw).Trim(), [ref]$demoProcessId) -or $demoProcessId -le 0) {
    throw 'Некорректный .local/demo.pid. Процессы не изменены.'
}
$demoCandidate = Get-CimInstance Win32_Process -Filter "ProcessId = $demoProcessId"
if (-not $demoCandidate) {
    Remove-Item -LiteralPath $demoPidFile -Force
    Write-Output 'Сервер уже остановлен; устаревший PID удалён.'
    return
}
$demoScriptPattern = [regex]::Escape($demoServeScript)
$demoCommandLineMatches = $demoCandidate.CommandLine -and [regex]::IsMatch(
    $demoCandidate.CommandLine.Replace('/', '\'),
    '^\s*(?:"[^"]+"|\S+)\s+(?:"' + $demoScriptPattern + '"|' + $demoScriptPattern + ')(?=\s|$)',
    'IgnoreCase'
)
if ($demoCandidate.Name -notmatch '^node(?:\.exe)?$' -or -not $demoCommandLineMatches) {
    throw 'PID относится к другому процессу или его команда не подтверждена. Процесс не остановлен; .local/demo.pid сохранён.'
}

Stop-Process -Id $demoProcessId -ErrorAction Stop
Remove-Item -LiteralPath $demoPidFile -Force
Write-Output 'Сайт остановлен.'
