@echo off
echo ================================
echo   Instalando Adai POS System
echo ================================

echo.
echo Instalando dependencias del servidor...
cd server
call npm install

echo.
set /p MODO="Instalar con datos de ejemplo? (s/n): "
if /i "%MODO%"=="s" (
  call npm run seed
  echo Datos de ejemplo cargados.
) else (
  call npm run seed:prod
  echo Sistema listo para produccion.
)

cd ..

echo.
echo Instalando dependencias del cliente...
cd client
call npm install
cd ..

echo.
echo ================================
echo   Instalacion completada!
echo   Ejecuta iniciar.bat para arrancar
echo ================================
pause