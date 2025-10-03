# AGENTS.md

## Commands

### Setup
```bash
cargo build
```

### Build
```bash
cargo build --release
```

### Lint
```bash
cargo clippy
```

### Test
```bash
cargo test
```

### Run Dev
```bash
cargo run
```

## Tech Stack
- **Language**: Rust (2021 edition)
- **Game Engine**: Bevy 0.13 (ECS-based)
- **UI**: bevy_egui
- **Audio**: rodio (procedural audio generation)
- **Graphics**: 2D sprite rendering with Bevy's MaterialMesh2dBundle

## Architecture
- Single-file architecture in `src/main.rs`
- ECS pattern: Components, Systems, Resources
- Procedurally generated graphics and audio
- Multi-threaded audio engine using channels

## Code Style
- Follow standard Rust conventions
- Use Bevy's ECS patterns (Components, Resources, Systems)
- Portuguese comments preserved in original code sections
