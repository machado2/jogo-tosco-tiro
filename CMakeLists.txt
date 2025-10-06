cmake_minimum_required(VERSION 3.15)
project(JogoToscoTiro)

find_package(SDL2 REQUIRED)

add_executable(tiro jogo.cpp tiro.cpp)

target_link_libraries(tiro SDL2::SDL2main SDL2::SDL2)
