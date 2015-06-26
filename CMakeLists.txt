set (CMAKE_C_FLAGS "-Werror -Wall")
set (CMAKE_CXX_FLAGS "-Werror -Wall")
add_executable(tiro jogo.cpp tiro.cpp)
INCLUDE(FindPkgConfig)

PKG_SEARCH_MODULE(SDL2 REQUIRED sdl2)
INCLUDE_DIRECTORIES(${SDL2_INCLUDE_DIRS})
TARGET_LINK_LIBRARIES(tiro ${SDL2_LIBRARIES})
