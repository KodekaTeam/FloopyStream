@echo off
REM Start MediaFlow Live Server from correct directory

cd /d D:\KINGJS\floopystream\app
echo Starting MediaFlow Live from correct directory...
echo Working directory: %CD%
echo.
node server.js
