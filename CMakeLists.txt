cmake_minimum_required(VERSION 3.15)
project(JogoToscoTiro 
    VERSION 1.0.0
    DESCRIPTION "Jogo de tiro simples com SDL2"
    LANGUAGES CXX
)

# Configurações modernas do CMake
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Configurações de build
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

# Configurações para Debug e Release
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY_DEBUG ${CMAKE_BINARY_DIR}/bin/Debug)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY_RELEASE ${CMAKE_BINARY_DIR}/bin/Release)

# Encontrar SDL2
find_package(SDL2 REQUIRED)

# Criar executável
add_executable(tiro 
    jogo.cpp 
    tiro.cpp
    jogo.h
    tiro.h
)

# Configurar includes
target_include_directories(tiro PRIVATE ${SDL2_INCLUDE_DIRS})

# Linkar bibliotecas
target_link_libraries(tiro 
    PRIVATE 
    SDL2::SDL2main 
    SDL2::SDL2
)

# Copiar arquivos de recursos (imagens BMP) para o diretório de saída
file(GLOB BMP_FILES "${CMAKE_SOURCE_DIR}/*.bmp")
file(COPY ${BMP_FILES} DESTINATION ${CMAKE_RUNTIME_OUTPUT_DIRECTORY})

# Mensagem informativa
message(STATUS "Configuração concluída!")
message(STATUS "Diretório de saída: ${CMAKE_RUNTIME_OUTPUT_DIRECTORY}")
