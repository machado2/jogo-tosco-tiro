use bevy::prelude::*;

#[derive(Resource, Default)]
pub struct Score(pub i32);

#[derive(Resource, Default)]
pub struct FrameCounter(pub u64);

#[derive(Resource, Default)]
pub struct EnemyPopulation(pub u32);

#[derive(Resource, Default)]
pub struct Shake {
    pub frames: i32,
    pub intensity: f32,
}

#[derive(Resource, Default)]
pub struct Muted(pub bool);
