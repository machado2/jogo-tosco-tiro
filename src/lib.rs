//! Library crate for modularizing the game. This will host domain plugins and shared types.

pub mod audio;
pub mod constants;
pub mod core;
pub mod input;
pub mod ui;
pub mod world;
pub mod gameplay {
    pub mod combat;
    pub mod components;
    pub mod enemy;
    pub mod player;
}
pub mod effects;
pub mod physics;
pub mod rendering;
pub mod util;

use bevy::prelude::*;

/// Aggregates all domain plugins. Initially empty; we'll migrate systems incrementally.
pub struct GamePlugin;

impl Plugin for GamePlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins((
            core::CorePlugin,
            world::WorldPlugin,
            input::InputPlugin,
            rendering::RenderingPlugin,
            gameplay::player::PlayerPlugin,
            gameplay::combat::CombatPlugin,
            physics::PhysicsPlugin,
            gameplay::enemy::EnemyPlugin,
            audio::AudioPlugin,
            ui::UiPlugin,
            effects::EffectsPlugin,
        ));
    }
}
