@echo off
title Adai POS System
echo ================================
echo   Iniciando Adai POS System
echo ================================
echo.

:: Verificar si el puerto 3001 ya esta en uso (servidor ya corriendo)
netstat -an | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [INFO] El servidor ya esta corriendo en http://localhost:3001
    echo [INFO] No se abrira otra pestana del navegador.
    echo [INFO] Si necesitas recargar, presiona F5 en el navegador.
    echo.
    pause
    exit /b
)

:: Si no esta corriendo, iniciar servidor y abrir navegador
cd server
echo Iniciando servidor...
start "" cmd /c "title Adai POS - Servidor && npm start"
echo Esperando a que el servidor este listo...
timeout /t 4 /nobreak >nul
echo Abriendo navegador...
start http://localhost:3001
echo.
echo Servidor iniciado. Puede cerrar esta ventana.
echo Para detener el servidor, cierre la ventana del servidor.
