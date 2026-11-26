@echo off
cd /d "%~dp0"
title Bajada SUNAT - deja esta ventana abierta
echo Deja esta ventana abierta. El contador pide el XML desde Planillas.
echo La primera vez se abre el navegador para entrar con Google.
echo.
call pnpm sunat:escuchar
echo.
echo El programa se detuvo. El mensaje de arriba es el motivo.
pause
