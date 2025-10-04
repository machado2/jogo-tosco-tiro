// Utility helpers will live here (math, types, builders).
#![allow(dead_code)]

use crate::constants::{SCREEN_HEIGHT, SCREEN_WIDTH};
use bevy::prelude::*;

pub fn clamp_to_screen(mut pos: Vec3, size: Vec2) -> Vec3 {
    let half_w = size.x / 2.0;
    let half_h = size.y / 2.0;
    pos.x = pos
        .x
        .clamp(-SCREEN_WIDTH / 2.0 + half_w, SCREEN_WIDTH / 2.0 - half_w);
    pos.y = pos
        .y
        .clamp(-SCREEN_HEIGHT / 2.0 + half_h, SCREEN_HEIGHT / 2.0 - half_h);
    pos
}
