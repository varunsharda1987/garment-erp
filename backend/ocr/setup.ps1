# One-time setup of the CAD marker reader (like `npm ci`: run it by hand on the PC that serves the API,
# and again when requirements.txt changes). Deploys never touch backend/ocr: the live API runs
# read_marker.py straight from this folder, the way it reads backend/templates.
#
#   powershell -ExecutionPolicy Bypass -File backend\ocr\setup.ps1
#
# Creates backend\ocr\.venv (gitignored), installs the pinned packages — the PP-OCR models (~30 MB) ship
# inside the rapidocr package and are checksum-verified when loaded — and runs the self-test.
# Until this has run, every marker reads as "not checked" and saving asks for a reason — nothing breaks.

param([string]$Python = '')

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $Python) {
  $launcher = Get-Command py -ErrorAction SilentlyContinue
  if ($launcher) { $Python = (& py -3.13 -c 'import sys; print(sys.executable)') }
  if (-not $Python) { $Python = (Get-Command python -ErrorAction Stop).Source }
}
# No quotes inside the -c code: Windows PowerShell 5.1 strips them on the way to a native exe
$version = & $Python -c 'import sys; print(sys.version[:4])'
if ($version -ne '3.13') { throw "Python 3.13 is needed (found $version at $Python). Pass -Python <path to python.exe>." }

$venv = Join-Path $here '.venv'
if (-not (Test-Path (Join-Path $venv 'Scripts\python.exe'))) {
  Write-Host "Creating $venv"
  & $Python -m venv $venv
}
$venvPython = Join-Path $venv 'Scripts\python.exe'

Write-Host 'Installing packages (requirements.txt)'
& $venvPython -m pip install --disable-pip-version-check --quiet -r (Join-Path $here 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'pip install failed' }

Write-Host 'Self-test on the marker fixtures (first run downloads the OCR models)'
& $venvPython (Join-Path $here 'read_marker.py') --selftest
if ($LASTEXITCODE -ne 0) { throw 'The marker reader self-test failed — see the lines above.' }

Write-Host "CAD marker reader ready: $venvPython"
