cmake_minimum_required(VERSION 2.8.12)

include(${CMAKE_BINARY_DIR}/conanbuildinfo.cmake)
conan_basic_setup()

add_executable(tiro jogo.cpp tiro.cpp)

target_link_libraries(tiro ${CONAN_LIBS})
