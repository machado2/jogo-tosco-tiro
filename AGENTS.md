# Agent Context

## Commands

- **Setup**: `cargo build` (installs dependencies automatically)
- **Build**: `cargo build --release`
- **Lint**: `cargo clippy`
- **Test**: `cargo test`
- **Dev Server**: `cargo run`

## Tech Stack

- **Language**: Rust 2021 edition
- **Game Engine**: Bevy 0.13 (ECS architecture)
- **UI**: bevy_egui
- **Audio**: rodio (procedural synthesis on separate thread)
- **Graphics**: 2D sprites with procedural meshes and bloom effects

## Repo Structure

- `src/main.rs`: Single-file game implementation with ECS components and systems
- `assets/`: Game assets (sprites, audio)
- `Cargo.toml`: Dependencies and build profiles

## Code Style

- Standard Rust conventions with snake_case
- Inline procedural audio synthesis functions
- Game uses Bevy's ECS: Resources for global state, Components for entity data, Systems for logic
- Portuguese comments in original code preserved
