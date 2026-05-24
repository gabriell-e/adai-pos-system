@echo off
title Adai POS System
echo ================================
echo   Iniciando Adai POS System
echo ================================
echo.
echo Iniciando servidor backend...
start "Adai Server" cmd /c "cd server && npm run dev"
echo.
echo Iniciando cliente frontend...
start "Adai Client" cmd /c "cd client && npm run dev"
echo.
echo ================================
echo   Servidor: http://localhost:3001
echo   Cliente:  http://localhost:5173
echo ================================
pause
