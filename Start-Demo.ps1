$ErrorActionPreference = 'Stop'
$demoProjectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$demoServeScript = [System.IO.Path]::GetFullPath((Join-Path $demoProjectRoot 'scripts/serve.mjs'))
$demoOutputIndex = Join-Path $demoProjectRoot 'out/index.html'
$demoLocalDirectory = Join-Path $demoProjectRoot '.local'
$demoPidFile = Join-Path $demoLocalDirectory 'demo.pid'

function Test-OwnDemoProcess($Candidate) {
    if (-not $Candidate -or $Candidate.Name -notmatch '^node(?:\.exe)?$' -or -not $Candidate.CommandLine) { return $false }
    $demoCommandLine = $Candidate.CommandLine.Replace('/', '\')
    $demoScriptPattern = [regex]::Escape($demoServeScript)
    return [regex]::IsMatch($demoCommandLine, '^\s*(?:"[^"]+"|\S+)\s+(?:"' + $demoScriptPattern + '"|' + $demoScriptPattern + ')(?=\s|$)', 'IgnoreCase')
}

if (-not (Test-Path -LiteralPath $demoOutputIndex -PathType Leaf)) {
    throw 'Нет out/index.html. Сначала соберите проект вручную; этот скрипт не выполняет сборку.'
}
if (-not (Test-Path -LiteralPath $demoServeScript -PathType Leaf)) { throw 'Не найден scripts/serve.mjs.' }
$demoNodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path $demoLocalDirectory | Out-Null

$demoRecordedProcess = $null
if (Test-Path -LiteralPath $demoPidFile -PathType Leaf) {
    $demoRecordedId = 0
    if (-not [int]::TryParse((Get-Content -LiteralPath $demoPidFile -Raw).Trim(), [ref]$demoRecordedId) -or $demoRecordedId -le 0) {
        throw 'Некорректный .local/demo.pid. Проверьте файл вручную; процессы не изменены.'
    }
    $demoCandidate = Get-CimInstance Win32_Process -Filter "ProcessId = $demoRecordedId"
    if (Test-OwnDemoProcess $demoCandidate) { $demoRecordedProcess = $demoCandidate }
    else { Remove-Item -LiteralPath $demoPidFile -Force }
}

$demoListeners = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
if ($demoListeners.Count -gt 0) {
    $demoListenerIds = @($demoListeners.OwningProcess | Select-Object -Unique)
    if ($demoListenerIds.Count -eq 1) {
        $demoListener = Get-CimInstance Win32_Process -Filter "ProcessId = $($demoListenerIds[0])"
        if (Test-OwnDemoProcess $demoListener) {
            Set-Content -LiteralPath $demoPidFile -Value $demoListener.ProcessId -Encoding Ascii
            Write-Output 'Сайт уже работает: http://localhost:3000'
            return
        }
    }
    throw 'Порт 3000 занят другим процессом. Он не был остановлен или изменён.'
}
if ($demoRecordedProcess) {
    throw 'Процесс этого сайта уже запущен, но порт 3000 пока не открыт. Проверьте .local/demo.*.log или выполните Stop-Demo.ps1.'
}

$demoHadPortVariable = Test-Path Env:PORT
$demoPreviousPort = $env:PORT
try {
    $env:PORT = '3000'
    $demoProcess = Start-Process -FilePath $demoNodeExecutable -ArgumentList ('"' + $demoServeScript + '"') `
        -WorkingDirectory $demoProjectRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $demoLocalDirectory 'demo.stdout.log') `
        -RedirectStandardError (Join-Path $demoLocalDirectory 'demo.stderr.log')
} finally {
    if ($demoHadPortVariable) { $env:PORT = $demoPreviousPort }
    else { Remove-Item Env:PORT -ErrorAction SilentlyContinue }
}
Set-Content -LiteralPath $demoPidFile -Value $demoProcess.Id -Encoding Ascii

$demoDeadline = [DateTime]::UtcNow.AddSeconds(10)
do {
    $demoProcess.Refresh()
    if ($demoProcess.HasExited) { throw 'Сервер завершился при запуске. Проверьте .local/demo.stderr.log.' }
    $demoReadyListeners = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
    if ($demoReadyListeners.OwningProcess -contains $demoProcess.Id) {
        Write-Output 'Сайт запущен: http://localhost:3000'
        Write-Output 'Остановка: .\Stop-Demo.ps1'
        return
    }
    Start-Sleep -Milliseconds 200
} while ([DateTime]::UtcNow -lt $demoDeadline)
throw 'Сервер не открыл порт 3000 за 10 секунд. Проверьте .local/demo.*.log; для остановки используйте Stop-Demo.ps1.'
