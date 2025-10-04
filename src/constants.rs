// Centralized constants extracted from main.rs
#![allow(dead_code)]

pub const SCREEN_WIDTH: f32 = 640.0;
pub const SCREEN_HEIGHT: f32 = 480.0;

pub const MAX_HEALTH: i32 = 100;
pub const MAX_CHARGE: f32 = 1000.0;
pub const CHARGE_REFILL_PER_SEC: f32 = 18.0; // ~0.3 per frame @60fps
pub const ENEMY_HEALTH: i32 = 5;
pub const POINTS_ENEMY: i32 = 5;
pub const POINTS_METEOR: i32 = 1;
pub const POINTS_SPECIAL: i32 = 20;

pub const SIZE_PLAYER: bevy::prelude::Vec2 = bevy::prelude::Vec2::new(16.0, 16.0);
pub const SIZE_ENEMY: bevy::prelude::Vec2 = bevy::prelude::Vec2::new(16.0, 16.0);
pub const SIZE_METEOR: bevy::prelude::Vec2 = bevy::prelude::Vec2::new(5.0, 5.0);
pub const SIZE_LASER: bevy::prelude::Vec2 = bevy::prelude::Vec2::new(2.0, 50.0);
pub const SIZE_MISSILE: bevy::prelude::Vec2 = bevy::prelude::Vec2::new(4.0, 4.0);
