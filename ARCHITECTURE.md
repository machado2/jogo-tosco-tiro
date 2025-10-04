# Game Architecture Documentation

## Overview

This game has been modularized into a clean, plugin-based architecture using the Bevy engine. The main entry point (`main.rs`) is minimal and delegates all functionality to domain-specific modules.

## Module Structure

### Core Modules

#### `main.rs` (88 lines)
- **Purpose**: Application entry point
- **Responsibilities**:
  - Window configuration
  - Plugin registration
  - Initial resource setup (scores, wave config)
  - Player entity spawning
- **What it doesn't contain**: No game logic, no systems (except startup setup)

### Domain Modules

#### `constants` - Game Constants
- Screen dimensions
- Player/enemy sizes
- Health and charge values
- Speed configurations

#### `core` - Core Game Systems
- **Plugin**: `CorePlugin`
- **Systems**:
  - `track_frames` - Frame counting
  - `camera_shake` - Screen shake effects
  - `check_game_over` - Game state transitions
  - `restart_on_click` - Game restart logic
- **Resources**: `GamePhase`, `Score`, `FrameCounter`, `EnemyPopulation`, `Shake`, `Muted`

#### `input` - Input Handling
- **Plugin**: `InputPlugin`
- **Systems**: `update_cursor_pos` - Mouse position tracking
- **Resources**: `CursorPos`

#### `world` - World/Environment
- **Plugin**: `WorldPlugin`
- **Systems**:
  - `spawn_camera` - Camera setup
  - `spawn_starfield` - Background stars
  - `spawn_vignette` - Screen borders
- **Components**: `Star`

#### `audio` - Audio Engine
- **Plugin**: `AudioPlugin`
- **Systems**: `audio_player` - Audio synthesis and playback
- **Resources**: `AudioEngine`
- **Features**: Procedural sound synthesis, wave generation

#### `ui` - User Interface
- **Plugin**: `UiPlugin`
- **Systems**: `ui_system` - HUD rendering with egui
- **Features**:
  - Health and charge bars with animations
  - Score display
  - Game state overlays (Paused, Game Over)
  - Mute indicator

#### `rendering` - Procedural Mesh Generation
- **Plugin**: `RenderingPlugin`
- **Functions**:
  - `mesh_triangle`, `mesh_diamond`, `mesh_arrow`, `mesh_hexagon` - Ship hull meshes
  - `spawn_ship_visual` - Complete ship construction with wings, cockpit, antenna
  - `spawn_engine_glow` - Engine flame effect spawning
- **Types**: `ShipBounds` - Ship collision bounds

#### `effects` - Visual Effects
- **Plugin**: `EffectsPlugin`
- **Systems**:
  - `update_particles` - Particle system
  - `update_trails` - Trail rendering
  - `player_trail` - Player trail spawning
  - `engine_flame_pulse` - Engine animation
  - `update_flash_effects` - Screen flash effects
  - `update_damage_vignette` - Damage indicator
- **Components**: `Particle2D`, `Trail`, `TrailSegment`, `EngineFlame`, `FlashEffect`, `DamageVignette`

#### `physics` - Physics Systems
- **Plugin**: `PhysicsPlugin`
- **Systems**: `apply_velocity` - Simple velocity-based movement

### Gameplay Modules

#### `gameplay::player` - Player Systems
- **Plugin**: `PlayerPlugin`
- **Systems**:
  - `player_control` - Player movement and input
  - `player_shoot` - Shooting mechanics
  - `special_attack` - Special attack system
- **Components**: `Player`, `PlayerCooldowns`

#### `gameplay::enemy` - Enemy Systems
- **Plugin**: `EnemyPlugin`
- **Systems**:
  - `enemy_spawner` - Wave-based enemy spawning
  - `enemy_behavior` - 13 different movement patterns
- **Components**: `Enemy`, `EnemyKind`, `EnemyType`
- **Resources**: `WaveManager`, `WaveConfig`
- **Features**:
  - Multiple enemy types (Scout, Heavy, Bomber, Drone)
  - Complex movement patterns (circular, dash-retreat, formations)
  - Wave progression system

#### `gameplay::combat` - Combat Systems
- **Plugin**: `CombatPlugin`
- **Systems**:
  - `collisions_and_damage` - Collision detection and damage
  - `fire_pattern` - Firing patterns for enemies
- **Components**: `Bullet`, `FiringPattern`
- **Features**:
  - Multiple firing patterns (Single, Spread, Aimed, Burst)
  - Particle bursts on impact

#### `gameplay::components` - Shared Components
- `Velocity` - Movement velocity
- `Collider` - Collision box
- `Health` - Health tracking
- `Charge` - Special attack charge
- `Lifetime` - Entity lifetime
- `TrailTimer` - Trail spawning timer
- `LaserFollowPlayer` - Homing behavior

## Plugin Registration Order

The `GamePlugin` aggregates all domain plugins in this order:

1. `CorePlugin` - Core game systems and state
2. `WorldPlugin` - World setup (camera, environment)
3. `InputPlugin` - Input handling
4. `RenderingPlugin` - Rendering utilities
5. `PlayerPlugin` - Player logic
6. `CombatPlugin` - Combat systems
7. `PhysicsPlugin` - Physics simulation
8. `EnemyPlugin` - Enemy logic
9. `AudioPlugin` - Audio systems
10. `UiPlugin` - User interface
11. `EffectsPlugin` - Visual effects

## Code Metrics

### Before Modularization
- `main.rs`: ~1500+ lines
- All systems in one file
- Difficult to navigate and maintain

### After Modularization
- `main.rs`: **88 lines** (94% reduction!)
- Clean separation of concerns
- Each module has clear responsibilities
- Easy to test individual systems

## Architecture Benefits

### 1. **Separation of Concerns**
Each module has a single, well-defined responsibility. Changes to one module don't affect others.

### 2. **Testability**
Individual systems can be tested in isolation by mounting only the required plugins.

### 3. **Maintainability**
New developers can understand the codebase by reading module documentation and exploring one module at a time.

### 4. **Extensibility**
New features can be added as new plugins without modifying existing code.

### 5. **Reusability**
Modules like `audio`, `effects`, and `rendering` could be reused in other projects.

## Future Improvements

### Optional: Event-Driven Architecture
Currently, some systems communicate through direct queries. This could be improved with events:

- `DamageEvent` - When entities take damage
- `EnemyDestroyedEvent` - When enemies are destroyed
- `ShootEvent` - When shots are fired
- `ScoreEvent` - When score changes

Benefits:
- Further decoupling
- Easier to extend with new features
- Better for multiplayer/networking

### Performance Optimizations
- Spatial partitioning for collision detection
- Object pooling for bullets and particles
- LOD system for distant entities

### Additional Features
- Save/load system
- Settings menu
- Multiple game modes
- Power-ups system
- Boss battles

## Development Workflow

### Adding a New Feature

1. **Identify the appropriate module** - Determine which domain the feature belongs to
2. **Create components** - Add necessary components to `gameplay::components`
3. **Implement systems** - Add systems to the appropriate module
4. **Register in plugin** - Update the module's plugin to register new systems
5. **Test** - Build and verify the feature works

Example: Adding a shield power-up
```rust
// 1. Add to gameplay::components
pub struct Shield { pub active: bool, pub duration: Timer }

// 2. Add to gameplay::player
fn shield_system(time: Res<Time>, mut q: Query<&mut Shield>) { /* ... */ }

// 3. Register in PlayerPlugin
impl Plugin for PlayerPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, (player_control, player_shoot, shield_system));
    }
}
```

## Conclusion

This architecture provides a solid foundation for future development. The modular design makes the codebase easy to understand, maintain, and extend. Each module can evolve independently while maintaining clear interfaces with other modules.
