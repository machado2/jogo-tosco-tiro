//! Main entry point for the game.
//! This file contains minimal setup code - most game logic is in domain-specific modules.

use bevy::prelude::*;
use bevy_egui::EguiPlugin;

// Game modules
use jogo_tosco_tiro::constants::*;
use jogo_tosco_tiro::core::{EnemyPopulation, FrameCounter, GamePhase, Muted, Score, Shake};
use jogo_tosco_tiro::effects::Trail;
use jogo_tosco_tiro::gameplay::components::{Charge, Collider, Health};
use jogo_tosco_tiro::gameplay::enemy::{WaveConfig, WaveManager};
use jogo_tosco_tiro::gameplay::player::Player;
use jogo_tosco_tiro::input::CursorPos;
use jogo_tosco_tiro::rendering::{spawn_engine_glow, spawn_ship_visual, ShipBounds};

/// Initial game setup: spawns player and initializes resources
fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<bevy::render::mesh::Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    // Initialize game resources
    commands.insert_resource(Score(0));
    commands.insert_resource(FrameCounter(0));
    commands.insert_resource(EnemyPopulation(0));
    commands.insert_resource(CursorPos::default());
    commands.insert_resource(Shake::default());
    commands.insert_resource(Muted(true));
    commands.insert_resource(jogo_tosco_tiro::audio::AudioEngine::new());

    // Configure wave progression
    let wave_configs = vec![
        WaveConfig {
            scout_count: 8,
            heavy_count: 1,
            bomber_count: 0,
            drone_count: 1,
            spawn_interval: 0.80,
            score_threshold: 0,
        },
        WaveConfig {
            scout_count: 12,
            heavy_count: 2,
            bomber_count: 1,
            drone_count: 1,
            spawn_interval: 0.60,
            score_threshold: 50,
        },
        WaveConfig {
            scout_count: 16,
            heavy_count: 3,
            bomber_count: 2,
            drone_count: 2,
            spawn_interval: 0.50,
            score_threshold: 150,
        },
        WaveConfig {
            scout_count: 20,
            heavy_count: 4,
            bomber_count: 3,
            drone_count: 3,
            spawn_interval: 0.45,
            score_threshold: 300,
        },
        WaveConfig {
            scout_count: 24,
            heavy_count: 5,
            bomber_count: 4,
            drone_count: 4,
            spawn_interval: 0.40,
            score_threshold: 500,
        },
        WaveConfig {
            scout_count: 28,
            heavy_count: 6,
            bomber_count: 5,
            drone_count: 5,
            spawn_interval: 0.35,
            score_threshold: 750,
        },
        WaveConfig {
            scout_count: 32,
            heavy_count: 8,
            bomber_count: 6,
            drone_count: 6,
            spawn_interval: 0.30,
            score_threshold: 1000,
        },
    ];
    commands.insert_resource(WaveManager {
        current_wave: 0,
        enemies_remaining: 0,
        wave_timer: 0.0,
        wave_configs,
        enemies_spawned_this_wave: 0,
    });

    // Spawn player entity
    let player_pos = Vec3::new(0.0, -160.0, 10.0);
    let mut player_entity = commands.spawn((
        SpatialBundle {
            transform: Transform::from_translation(player_pos),
            ..default()
        },
        Player,
        Collider {
            w: SIZE_PLAYER.x,
            h: SIZE_PLAYER.y,
        }, // Will be adjusted after ship mesh is built
        Health {
            hp: MAX_HEALTH,
            max: MAX_HEALTH,
        },
        Trail {
            positions: Vec::new(),
            max_length: 15,
            color: Color::rgb(0.3, 0.6, 1.5),
        },
        Charge {
            value: MAX_CHARGE,
            max: MAX_CHARGE,
        },
        Name::new("Player"),
        jogo_tosco_tiro::gameplay::player::PlayerCooldowns {
            shoot: Timer::from_seconds(0.0, TimerMode::Once),
            special: Timer::from_seconds(0.0, TimerMode::Once),
        },
    ));

    // Build ship visual and update collider with actual bounds
    let mut ship_bounds: Option<ShipBounds> = None;
    let pid = player_entity.id();
    player_entity.with_children(|c| {
        let b = spawn_ship_visual(
            c,
            &mut meshes,
            &mut materials,
            SIZE_PLAYER,
            12345,
            Color::rgb(0.2, 0.5, 0.9),
        );
        ship_bounds = Some(b);
        spawn_engine_glow(c, &mut meshes, &mut materials, 0.8);
    });
    drop(player_entity);
    if let Some(b) = ship_bounds {
        if let Some(mut ecmd) = commands.get_entity(pid) {
            ecmd.insert(Collider {
                w: b.width_units * SIZE_PLAYER.x,
                h: b.height_units * SIZE_PLAYER.y,
            });
        }
    }
}

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Jogo Tosco de dar Tiro (Rust + Bevy)".into(),
                resolution: (SCREEN_WIDTH, SCREEN_HEIGHT).into(),
                resizable: true,
                ..default()
            }),
            ..default()
        }))
        .add_plugins(EguiPlugin)
        .add_plugins(jogo_tosco_tiro::GamePlugin) // All game systems are registered via this plugin
        .insert_state(GamePhase::Running)
        .add_systems(Startup, setup)
        .run();
}
