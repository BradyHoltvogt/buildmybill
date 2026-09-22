# Minimal static file server for BuildMyBill.
# Uses a raw TcpListener so it needs no admin rights and no Node.js.
#   Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8321]
#
# Port resolution order: an explicit -Port wins, then the PORT environment
# variable, then 8321. The env var matters because parallel sessions (and the
# worktrees under .claude/worktrees) all serve this same app - a fixed port
# guarantees the second one to start collides with the first.
param([int]$Port = 0)

if ($Port -le 0) {
  $Port = if ($env:PORT -match '^\d+$') { [int]$env:PORT } else { 8321 }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "BuildMyBill serving $root at http://localhost:$Port/  (Ctrl+C to stop)"

$types = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".ico"  = "image/x-icon"
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    # A browser routinely opens more TCP connections than it ends up sending
    # requests on (speculative/pooled connections). This loop accepts and
    # handles one client at a time, so a connection nobody ever writes to
    # would otherwise block ReadLine() forever - and because Accept() is
    # never reached again, every later request queues up behind it and the
    # server looks completely hung, not just slow. Bound the read instead.
    $stream.ReadTimeout = 2000
    $reader = [System.IO.StreamReader]::new($stream)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) { $client.Close(); continue }

    $path = ($requestLine -split ' ')[1]
    $path = ($path -split '\?')[0]
    if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }

    # Resolve inside the served folder only; reject traversal attempts.
    $relative = $path.TrimStart('/') -replace '/', '\'
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $relative))

    if ($full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ctype = if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" }
      $header = "HTTP/1.1 200 OK`r`nContent-Type: $ctype`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    } else {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
    }

    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
  } catch {
    Write-Host "Request error: $($_.Exception.Message)"
  } finally {
    $client.Close()
  }
}
