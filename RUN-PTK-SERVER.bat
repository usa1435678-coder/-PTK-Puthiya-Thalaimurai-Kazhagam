@echo off
setlocal
cd /d "%~dp0"
if "%PORT%"=="" set PORT=3000
echo PTK server running at http://localhost:%PORT%
call npm start
echo.
echo The PTK server has stopped. Read any error above, then restart with START-WINDOWS.bat.
pause
