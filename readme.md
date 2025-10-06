# This is a shooter I wrote on C++ in the late 90s

A simple 2D shooter game made with SDL2. Originally written in the late 90s, now updated to work with modern build tools.

## Building

### Requirements
- CMake 3.15+
- Conan package manager
- C++ compiler with C++17 support
- SDL2 development libraries (managed by Conan)

### Quick Build

**Windows:**
```batch
build.bat
```

**Linux/macOS:**
```bash
chmod +x build.sh
./build.sh
```

### Build Options
- `-c` or `--clean`: Clean build directory before building
- `-d` or `--debug`: Build in Debug mode (default: Release)
- `-r` or `--run`: Run the game after building
- `-h` or `--help`: Show help message

### Manual Build
If you prefer to build manually:
```bash
mkdir build
cd build
conan install .. --build=missing
cmake .. -DCMAKE_TOOLCHAIN_FILE=conan_toolchain.cmake
cmake --build .
```

### Running the Game
After building, the executable will be in `build/bin/Release/` (or `build/bin/Debug/` for debug builds).

## Gameplay video on youtube

[![youtube video](http://img.youtube.com/vi/CnxdW3qrZFM/0.jpg)](http://www.youtube.com/watch?v=CnxdW3qrZFM "Gameplay video")

## Screenshot

![screenshot](screenshot.png)

