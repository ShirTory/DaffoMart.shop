# DaffoMart: commit and push to GitHub.
# Run from the project folder in PowerShell:
#   .\push-to-github.ps1 -Repo "https://github.com/YOUR-USER/Daffomart-main.git"
# If the repo is already connected (git remote origin exists), just run:  .\push-to-github.ps1
param(
  [string]$Repo = "",
  [string]$Branch = "main",
  [string]$Message = "Fix security leaks, order stock race, add 404/error pages, UI polish"
)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host "Git is not installed. Install it from https://git-scm.com/download/win and run again." -ForegroundColor Red; exit 1 }

if (-not (Test-Path ".git")) { git init | Out-Null; Write-Host "Initialized new git repository." }
git checkout -B $Branch 2>$null | Out-Null

$hasOrigin = (git remote) -contains "origin"
if ($Repo -ne "") {
  if ($hasOrigin) { git remote set-url origin $Repo } else { git remote add origin $Repo }
} elseif (-not $hasOrigin) {
  Write-Host "No GitHub repo set. Run: .\push-to-github.ps1 -Repo `"https://github.com/YOUR-USER/YOUR-REPO.git`"" -ForegroundColor Yellow; exit 1
}

# Safety: never commit secrets
foreach ($f in @(".env", ".env.local")) { if (git ls-files --error-unmatch $f 2>$null) { git rm --cached $f | Out-Null; Write-Host "Removed $f from git tracking." -ForegroundColor Yellow } }

# Safety: refuse to push without a .gitignore (it keeps .env.local, node_modules and .data/ out of GitHub)
if (-not (Test-Path ".gitignore")) { Write-Host ".gitignore is missing - refusing to push." -ForegroundColor Red; exit 1 }

git add -A
# Safety net: even if a secret slipped past .gitignore, unstage it
foreach ($f in @(".env", ".env.local", ".env.production")) { git reset -q HEAD -- $f 2>$null }
if (-not (git status --porcelain)) { Write-Host "Nothing new to commit." } else { git commit -m $Message | Out-Null; Write-Host "Committed." }

git push -u origin $Branch
if ($LASTEXITCODE -ne 0) {
  Write-Host "`nPush was rejected (remote has other commits). If you want this version to replace it, run:" -ForegroundColor Yellow
  Write-Host "  git push -u origin $Branch --force-with-lease" -ForegroundColor Yellow
  exit 1
}
Write-Host "`nDone. Netlify will redeploy automatically if the repo is connected." -ForegroundColor Green
