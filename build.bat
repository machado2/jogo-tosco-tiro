@echo off
REM Script de Build Automatizado para Jogo Tosco Tiro
REM Batch Script

echo 🎮 Jogo Tosco Tiro - Build Script
echo =================================
echo.

REM Verificar se o Conan está instalado
where conan >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Conan não encontrado. Por favor, instale o Conan 2.x
    exit /b 1
)

REM Verificar se o CMake está instalado  
where cmake >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ CMake não encontrado. Por favor, instale o CMake
    exit /b 1
)

echo ✅ Conan e CMake encontrados

REM Configuração
set CONFIG=Release
if "%1"=="Debug" set CONFIG=Debug

REM Limpar build anterior se solicitado
if "%1"=="clean" (
    echo 🧹 Limpando build anterior...
    if exist build rmdir /s /q build
    echo ✅ Build anterior removido
)

REM Criar diretório de build
if not exist build (
    echo 📁 Criando diretório de build...
    mkdir build
)

REM Instalar dependências com Conan
echo 📦 Instalando dependências com Conan...
conan install . --build=missing --output-folder=build
if %errorlevel% neq 0 (
    echo ❌ Erro ao instalar dependências
    exit /b 1
)

REM Configurar com CMake  
echo 🔧 Configurando com CMake...
cmake -S . -B build -G "Visual Studio 17 2022" -DCMAKE_BUILD_TYPE=%CONFIG% -DCMAKE_TOOLCHAIN_FILE="build/conan_toolchain.cmake"
if %errorlevel% neq 0 (
    echo ❌ Erro ao configurar CMake
    exit /b 1
)

REM Compilar
echo 🔨 Compilando...
cmake --build build --config %CONFIG% --parallel
if %errorlevel% neq 0 (
    echo ❌ Erro durante compilação
    exit /b 1
)

REM Copiar arquivos de recursos
echo 📋 Copiando recursos...
set EXE_DIR=build\bin\%CONFIG%
if exist %EXE_DIR% (
    copy *.bmp %EXE_DIR% >nul
    echo ✅ Recursos copiados para %EXE_DIR%
)

echo.
echo 🎉 Build concluído com sucesso!
echo 📍 Executável: %EXE_DIR%\tiro.exe
echo.

REM Executar se solicitado
if "%1"=="run" (
    echo 🚀 Iniciando o jogo...
    %EXE_DIR%\tiro.exe
)

echo Use: build.bat run para compilar e executar
echo Use: build.bat clean para limpar e recompilar
echo Use: build.bat Debug para compilar em modo Debug