# ship.ps1 — deploy + backup in one. Run from your web repo root instead of `vercel deploy`.
#
# WHY: bare `vercel deploy` (what was used daily for 2 months) uploads to Vercel but never
# pushes to GitHub — so your source lived only locally + on Vercel, and a deleted local
# branch nearly cost you a week on July 30. This pushes to GitHub, which auto-deploys via
# the Action AND backs up your source in the same step. Deploy and safety, one command.
#
#   .\ship.ps1                 # commit + push (auto message)
#   .\ship.ps1 "fix takeoff"   # commit + push with your message

param([string]$m = "ship: $(Get-Date -Format 'yyyy-MM-dd HH:mm')")

$ErrorActionPreference = "Stop"
git add -A
# commit only if there are changes; still push so a prior local commit reaches GitHub
try { git commit -m $m } catch { Write-Host "No new changes to commit — pushing existing commits." }
git push origin main

Write-Host ""
Write-Host "Pushed to main. GitHub Actions is deploying to production now," -ForegroundColor Green
Write-Host "and your source is safely on GitHub. Watch: https://github.com/DROCK1069/saguaro-crm/actions" -ForegroundColor Green
