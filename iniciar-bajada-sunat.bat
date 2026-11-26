@echo off
cd /d "%~dp0"
title Bajada SUNAT
call pnpm dev:bajada
echo.
echo El programa se detuvo. El mensaje de arriba es el motivo.
pause
