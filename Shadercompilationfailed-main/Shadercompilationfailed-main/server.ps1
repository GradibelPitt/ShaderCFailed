# Shader Compilation Failed: the game's little web server, for a PC without Node.js.
# start_game.bat runs this (with the Windows PowerShell every Windows 10/11 has) when there is no node; it does what server.js does:
# serves the files in source/ at http://127.0.0.1:8080, and opens the game in the browser. Closing its window stops it.
param([int]$Port = 8080)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'source'))
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'; '.mjs' = 'application/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
  '.svg' = 'image/svg+xml'; '.ogg' = 'audio/ogg'; '.mp3' = 'audio/mpeg'; '.wav' = 'audio/wav'; '.wasm' = 'application/wasm'
  '.glsl' = 'text/plain'; '.vert' = 'text/plain'; '.frag' = 'text/plain'; '.ico' = 'image/x-icon'; '.woff2' = 'font/woff2'
}
$listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } catch {
  Write-Host "Port $Port is already in use by another program. Close it and start the game again."
  exit 1
}
Write-Host "Server running at http://127.0.0.1:$Port"
Start-Process "http://127.0.0.1:$Port/"
$ascii = [System.Text.Encoding]::ASCII
while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    # a browser opens spare connections it may never use: wait a moment for a request, and drop the connection if none comes
    $waited = 0
    while ($client.Available -eq 0 -and $waited -lt 300) { Start-Sleep -Milliseconds 10; $waited += 10 }
    if ($client.Available -eq 0) { continue }
    $buf = New-Object byte[] 16384
    $n = $stream.Read($buf, 0, $buf.Length)
    $req = $ascii.GetString($buf, 0, $n)
    $first = ($req -split "`r`n")[0]
    $urlPath = '/'
    if ($first -match '^[A-Z]+ (\S+)') { $urlPath = [System.Uri]::UnescapeDataString(($matches[1] -split '\?')[0]) }
    if ($urlPath -eq '/') { $urlPath = '/index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root ($urlPath.TrimStart('/') -replace '/', '\')))
    if ($file.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
      $body = [System.IO.File]::ReadAllBytes($file)
      $type = $mime[[System.IO.Path]::GetExtension($file).ToLower()]
      if (-not $type) { $type = 'application/octet-stream' }
      $head = "HTTP/1.1 200 OK`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
    } else {
      $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
      $head = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
    }
    $hb = $ascii.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    $stream.Write($body, 0, $body.Length)
    $stream.Flush()
  } catch {
    # a connection the browser gave up on: carry on with the next one
  } finally {
    $client.Close()
  }
}
