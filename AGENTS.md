# AGENTS.md

## Commands

- **Setup**: `cargo build`
- **Build**: `cargo build --release`
- **Lint**: `cargo clippy`
- **Test**: `cargo test`
- **Run**: `cargo run` (dev), `cargo run --release` (optimized)

## Tech Stack

- **Language**: Rust (edition 2021)
- **Game Engine**: Bevy 0.13 (ECS-based game engine)
- **UI**: bevy_egui 0.26
- **Audio**: rodio 0.17 (procedural sound generation)
- **Build**: Cargo

## Architecture

- Single-file main.rs with ECS pattern
- Systems: player control, enemy AI, collision detection, audio
- Resources: Score, FrameCounter, EnemyPopulation, AudioEngine
- Components: Player, Enemy, Laser, Meteor, etc.

## Code Style

- Standard Rust formatting (use `cargo fmt`)
- 4-space indentation
- Portuguese comments/identifiers for legacy compatibility
