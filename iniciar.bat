@echo off
title Adai POS System
echo ================================
echo   Iniciando Adai POS System
echo ================================
echo.

cd server
echo Iniciando servidor...
start "" cmd /c "title Adai POS - Servidor && npm start"
echo Esperando a que el servidor este listo...
timeout /t 4 /nobreak >nul

:: Verificar si el servidor arranco
netstat -an | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo.
    echo ✅ Servidor corriendo en: http://localhost:3001
    echo    Abrilo en tu navegador manualmente.
    echo.
) else (
    echo.
    echo ⚠️  El servidor no respondio. Revisa la consola del servidor.
    echo.
)
pause
