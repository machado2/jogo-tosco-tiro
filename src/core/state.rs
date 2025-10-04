use bevy::prelude::*;

#[derive(States, Debug, Clone, Copy, Eq, PartialEq, Hash, Default)]
pub enum GamePhase {
    #[default]
    Running,
    Paused,
    GameOver,
}
