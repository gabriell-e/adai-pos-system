@echo off
title Adai POS System
echo ================================
echo   Iniciando Adai POS System
echo ================================
echo.
cd server
start http://localhost:3001
echo Abriendo http://localhost:3001 ...
echo.
npm start
pause
