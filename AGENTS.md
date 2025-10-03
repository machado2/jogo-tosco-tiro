# Agent Guide

## Commands

**Setup**: `cargo build`

**Build**: `cargo build --release`

**Lint**: `cargo clippy`

**Test**: `cargo test`

**Dev**: `cargo run`

## Tech Stack

- **Rust** (2021 edition) with **Bevy 0.13** game engine
- **bevy_egui** for UI, **rodio** for audio
- Single-file game at `src/main.rs` (~90s shooter remake)

## Structure

- `src/main.rs`: All game logic (ECS systems, components, resources)
- `assets/`: Game assets (sprites, audio)
- Uses Bevy's ECS architecture with systems, components, and resources

## Code Style

- Portuguese comments in original code (preserve existing style)
- Constants in SCREAMING_SNAKE_CASE at top of file
- Component structs use derive macros, systems use Bevy queries
- No rustfmt config; use default Rust formatting
