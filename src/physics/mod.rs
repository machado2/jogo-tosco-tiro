use bevy::prelude::*;

pub struct PhysicsPlugin;
impl Plugin for PhysicsPlugin {
    fn build(&self, _app: &mut App) {
        // Will manage movement integration and constraints.
    }
}
