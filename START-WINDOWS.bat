@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm >nul 2>nul
if errorlevel 1 goto missing_npm
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto unsupported_node

if not exist "node_modules" (
  echo Installing website dependencies...
  call npm ci
  if errorlevel 1 goto install_failed
)

if "%PORT%"=="" set PORT=3000
echo Checking PTK website on port %PORT%...
powershell -NoProfile -Command "try { $response = Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%/admin/login' -UseBasicParsing -TimeoutSec 2; if ($response.Content -match 'Sign in to the control centre') { exit 0 } } catch { }; exit 1"
if not errorlevel 1 goto open_admin
echo Starting PTK website on http://localhost:%PORT%
start "PTK Website Server" cmd.exe /k call "%~dp0RUN-PTK-SERVER.bat"
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(30); do { try { $response=Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%/healthz' -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200) { exit 0 } } catch { }; Start-Sleep -Seconds 1 } while ((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 goto server_failed

:open_admin
start "" "http://localhost:%PORT%/admin/login"
exit /b

:missing_node
echo Node.js is required. Install the current LTS version from https://nodejs.org/
pause
exit /b 1

:missing_npm
echo npm was not found. Reinstall Node.js with npm included, then try again.
pause
exit /b 1

:unsupported_node
echo Node.js 22 or newer is required. Install the current LTS version from https://nodejs.org/
pause
exit /b 1

:install_failed
echo Dependency installation failed. Check your internet connection and try again.
pause
exit /b 1

:server_failed
echo The PTK server did not become healthy. Check the PTK Website Server window for startup errors.
pause
exit /b 1
