@echo off
cd /d "%~dp0"
echo Deja esta ventana abierta. El contador pide el XML desde Planillas.
pnpm sunat:escuchar
pause
