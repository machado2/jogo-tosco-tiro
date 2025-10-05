#!/usr/bin/env pwsh
param(
  [int]$Port = 8080
)
$ErrorActionPreference = 'Stop'

function Test-Command($Name) {
  $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

# Resolve repo root based on script location
$ScriptDir = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
$RepoRoot = $ScriptDir
if (-not (Test-Path (Join-Path $RepoRoot 'index.html')) -and (Test-Path (Join-Path $ScriptDir '..' 'index.html'))) {
  $RepoRoot = (Resolve-Path (Join-Path $ScriptDir '..')).Path
}
Set-Location $RepoRoot

Write-Host '==> Checando pré-requisitos...'
if (-not (Test-Command 'rustup')) {
  Write-Error 'rustup não encontrado. Instale Rust via https://rustup.rs e tente novamente.'
}

Write-Host '==> Adicionando target wasm32-unknown-unknown (idempotente)...'
try { rustup target add wasm32-unknown-unknown | Out-Null } catch { }

if (-not (Test-Command 'trunk')) {
  if (Test-Command 'cargo') {
    Write-Host '==> Instalando trunk (cargo install trunk)...'
    cargo install trunk
  } else {
    Write-Error 'trunk não encontrado e cargo ausente. Instale Rust/cargo e tente novamente.'
  }
}

if (-not (Test-Command 'npx')) {
  Write-Error 'npx não encontrado. Instale Node.js (https://nodejs.org) e tente novamente.'
}

Write-Host '==> Compilando web + WASM (release) com Trunk...'
trunk build --release

if (-not (Test-Path 'dist')) {
  Write-Error "Diretório de saída 'dist' não encontrado após build."
}

Write-Host '==> Copiando assets estáticos para dist...'
New-Item -ItemType Directory -Force -Path 'dist/assets' | Out-Null
if (Test-Path 'assets') { Copy-Item -Recurse -Force 'assets/*' 'dist/assets/' -ErrorAction SilentlyContinue }
if (Test-Path 'favicon.png') { Copy-Item -Force 'favicon.png' 'dist/favicon.png' -ErrorAction SilentlyContinue }

Write-Host "==> Servindo './dist' via npx serve na porta $Port"
Write-Host "Abra: http://localhost:$Port/"
# Use -s to serve single-page app routing
& npx serve -s dist -l $Port