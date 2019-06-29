cmake_minimum_required(VERSION 2.8.12)

set (CMAKE_C_FLAGS "-Werror -Wall")
set (CMAKE_CXX_FLAGS "-Werror -Wall")

include(${CMAKE_BINARY_DIR}/conanbuildinfo.cmake)
conan_basic_setup()

add_executable(tiro jogo.cpp tiro.cpp)

target_link_libraries(tiro ${CONAN_LIBS})
