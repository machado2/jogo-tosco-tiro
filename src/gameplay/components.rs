use bevy::prelude::*;

#[derive(Component, Deref, DerefMut)]
pub struct Velocity(pub Vec2);

#[derive(Component)]
pub struct Collider {
    pub w: f32,
    pub h: f32,
}

#[derive(Component)]
pub struct Health {
    pub hp: i32,
    pub max: i32,
}

#[derive(Component)]
pub struct Charge {
    pub value: f32,
    pub max: f32,
}

#[derive(Component)]
pub struct Lifetime {
    pub timer: Timer,
}

#[derive(Component)]
pub struct TrailTimer(pub Timer);

#[derive(Component)]
pub struct LaserFollowPlayer;
