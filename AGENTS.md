# Agent Instructions

## Commands

- **Setup**: `cargo build` (dependencies auto-download)
- **Build**: `cargo build` (debug) or `cargo build --release` (optimized)
- **Lint**: `cargo clippy`
- **Format**: `cargo fmt`
- **Test**: `cargo test`
- **Run**: `cargo run` (launches game window)

## Tech Stack

- **Rust**: Game engine in Rust using Bevy 0.13 (ECS-based game framework)
- **Bevy**: Entity-Component-System architecture with sprite rendering, bloom effects
- **bevy_egui**: In-game UI (pause menu, game over screen)
- **Procedural Audio**: `rodio` for runtime audio synthesis (explosions, lasers, beeps)
- **Output**: Native desktop app (not web-based despite README mentioning Babylon.js from earlier version)

## Structure

- `src/main.rs`: Complete game implementation (player, enemies, bullets, particles, audio, collision, scoring)
- `assets/`: Game assets (favicon, etc.)
- Build artifacts in `target/` (gitignored)

## Code Conventions

- Uses Bevy ECS patterns: Components, Systems, Resources, States
- Procedural generation for meshes (triangles, diamonds) and audio (synthesizers)
- 640×480 game window, world coords centered at origin
- Comment sparingly; prefer clear naming
