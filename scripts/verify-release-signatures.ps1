#Requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$AllowUnsigned,
  [switch]$RequireDist
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dllPath = Join-Path (Join-Path (Join-Path $root "assets") "dll") "wexin_hook.dll"
$distDir = Join-Path $root "dist"
if (-not (Test-Path -LiteralPath $dllPath -PathType Leaf)) {
  throw "Missing assets/dll/wexin_hook.dll"
}

$executables = @()
if (Test-Path -LiteralPath $distDir -PathType Container) {
  $executables = @(Get-ChildItem -LiteralPath $distDir -Filter "*.exe" -File -Recurse)
}
if ($RequireDist -and $executables.Count -eq 0) {
  throw "No packaged EXE was found under dist/"
}

$targets = @((Get-Item -LiteralPath $dllPath)) + $executables
$failed = @()
foreach ($target in $targets) {
  $signature = Get-AuthenticodeSignature -LiteralPath $target.FullName
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $target.FullName).Hash.ToLowerInvariant()
  $relative = $target.FullName.Substring($root.Length).TrimStart([char[]]"\/")
  Write-Host ($relative + " | SHA-256 " + $hash + " | Authenticode " + $signature.Status)
  if ($signature.Status -ne "Valid") { $failed += $relative }
}

if ($failed.Count -gt 0) {
  $message = "Unsigned or invalid release artifacts: " + ($failed -join ", ")
  if ($AllowUnsigned) {
    Write-Warning $message
  } else {
    throw $message
  }
}
