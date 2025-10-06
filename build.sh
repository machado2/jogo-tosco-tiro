#!/bin/bash

# Build script for Jogo Tosco Tiro
# Simple build automation for Linux/Unix systems

set -e  # Exit on error

# Default values
CLEAN=0
RUN=0
CONFIG="Release"
BUILD_DIR="build"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--clean)
            CLEAN=1
            shift
            ;;
        -r|--run)
            RUN=1
            shift
            ;;
        -d|--debug)
            CONFIG="Debug"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -c, --clean    Clean build directory before building"
            echo "  -r, --run      Run the game after building"
            echo "  -d, --debug    Build in Debug mode (default: Release)"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h for help"
            exit 1
            ;;
    esac
done

echo "=== Jogo Tosco Tiro Build Script ==="

# Clean if requested
if [ $CLEAN -eq 1 ]; then
    echo "Cleaning build directory..."
    rm -rf "$BUILD_DIR"
fi

# Create build directory
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Install Conan dependencies
echo "Installing dependencies with Conan..."
if ! command -v conan &> /dev/null; then
    echo "Error: Conan is not installed. Please install Conan first."
    exit 1
fi

conan install .. --build=missing -s build_type=$CONFIG

# Configure with CMake
echo "Configuring with CMake..."
if ! command -v cmake &> /dev/null; then
    echo "Error: CMake is not installed. Please install CMake first."
    exit 1
fi

cmake .. -DCMAKE_TOOLCHAIN_FILE=conan_toolchain.cmake -DCMAKE_BUILD_TYPE=$CONFIG

# Build
echo "Building..."
cmake --build . --config $CONFIG

# Copy resources
echo "Copying resources..."
if [ -d "bin" ]; then
    cp ../*.bmp bin/ 2>/dev/null || true
else
    cp ../*.bmp . 2>/dev/null || true
fi

echo "Build completed successfully!"

# Run if requested
if [ $RUN -eq 1 ]; then
    echo "Running the game..."
    if [ -f "bin/tiro" ]; then
        ./bin/tiro
    elif [ -f "tiro" ]; then
        ./tiro
    else
        echo "Error: Could not find executable"
        exit 1
    fi
fi