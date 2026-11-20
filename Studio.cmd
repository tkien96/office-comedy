@echo off
rem Office Comedy Studio launcher (Windows). Does not install anything.
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Khong tim thay Node.js. Cai Node 24 roi chay lai.
  pause
  exit /b 1
)
if not exist "node_modules\esbuild\package.json" (
  echo Thieu dependency. Mo PowerShell trong thu muc du an va chay MOT LAN: npm install
  pause
  exit /b 1
)
if "%STUDIO_PORT%"=="" set STUDIO_PORT=5178
node studio\start.mjs --check-node
if errorlevel 1 (
  pause
  exit /b 1
)
node studio\build.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
rem Open the browser shortly after the server starts.
start "" /b cmd /c ""%SystemRoot%\System32\timeout.exe" /t 2 /nobreak >nul & start "" http://127.0.0.1:%STUDIO_PORT%"
node --env-file-if-exists=.env studio\start.mjs
echo.
echo Studio da dung.
pause
