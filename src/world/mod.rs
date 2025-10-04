use crate::constants::{SCREEN_HEIGHT, SCREEN_WIDTH};
use bevy::math::primitives::Rectangle;
use bevy::prelude::*;
use bevy::render::mesh::Mesh;
use bevy::sprite::{MaterialMesh2dBundle, Mesh2dHandle};
use rand::Rng;
use rand::SeedableRng;

#[derive(Component)]
pub struct Star {
    pub speed: f32,
}

pub struct WorldPlugin;
impl Plugin for WorldPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, spawn_world);
        app.add_systems(Update, starfield_update);
    }
}

fn starfield_update(mut q: Query<(&mut Transform, &Star)>) {
    let bottom = -SCREEN_HEIGHT / 2.0;
    let top = SCREEN_HEIGHT / 2.0;
    for (mut t, s) in &mut q {
        t.translation.y -= s.speed;
        if t.translation.y < bottom {
            t.translation.y = top;
            t.translation.x = rand::thread_rng().gen_range(-SCREEN_WIDTH / 2.0..SCREEN_WIDTH / 2.0);
        }
    }
}

fn spawn_world(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    // Vignette borders
    let edge_thickness = 40.0;
    let z_vignette = 99.0;
    let quad = meshes.add(Mesh::from(Rectangle {
        half_size: Vec2::splat(0.5),
        }));
    let mat_v = materials.add(ColorMaterial {
        color: Color::rgba(0.0, 0.0, 0.0, 0.18),
        ..default()
    });

    // Top
    commands.spawn(MaterialMesh2dBundle {
        mesh: Mesh2dHandle(quad.clone()),
        material: mat_v.clone(),
        transform: Transform::from_translation(Vec3::new(
            0.0,
            SCREEN_HEIGHT / 2.0 - edge_thickness / 2.0,
            z_vignette,
        ))
        .with_scale(Vec3::new(SCREEN_WIDTH, edge_thickness, 1.0)),
        ..default()
    });
    // Bottom
    commands.spawn(MaterialMesh2dBundle {
        mesh: Mesh2dHandle(quad.clone()),
        material: mat_v.clone(),
        transform: Transform::from_translation(Vec3::new(
            0.0,
            -SCREEN_HEIGHT / 2.0 + edge_thickness / 2.0,
            z_vignette,
        ))
        .with_scale(Vec3::new(SCREEN_WIDTH, edge_thickness, 1.0)),
        ..default()
    });
    // Left
    commands.spawn(MaterialMesh2dBundle {
        mesh: Mesh2dHandle(quad.clone()),
        material: mat_v.clone(),
        transform: Transform::from_translation(Vec3::new(
            -SCREEN_WIDTH / 2.0 + edge_thickness / 2.0,
            0.0,
            z_vignette,
        ))
        .with_scale(Vec3::new(edge_thickness, SCREEN_HEIGHT, 1.0)),
        ..default()
    });
    // Right
    commands.spawn(MaterialMesh2dBundle {
        mesh: Mesh2dHandle(quad),
        material: mat_v,
        transform: Transform::from_translation(Vec3::new(
            SCREEN_WIDTH / 2.0 - edge_thickness / 2.0,
            0.0,
            z_vignette,
        ))
        .with_scale(Vec3::new(edge_thickness, SCREEN_HEIGHT, 1.0)),
        ..default()
    });

    // Starfield
    let mut rng = rand::rngs::StdRng::seed_from_u64(42);
    let star_mesh = meshes.add(Mesh::from(Rectangle {
        half_size: Vec2::splat(0.5),
        }));
    for i in 0..180 {
        let use_blue = i % 6 == 0;
        let color = if use_blue {
            Color::rgb(0.6, 0.7, 1.0)
        } else {
            Color::WHITE
        };
        let mat = materials.add(color);
        let speed = rng.gen_range(0.15..0.5);
        commands.spawn((
            MaterialMesh2dBundle {
                mesh: Mesh2dHandle(star_mesh.clone()),
                material: mat,
                transform: Transform::from_translation(Vec3::new(
                    rng.gen_range(-SCREEN_WIDTH / 2.0..SCREEN_WIDTH / 2.0),
                    rng.gen_range(-SCREEN_HEIGHT / 2.0..SCREEN_HEIGHT / 2.0),
                    0.0,
                ))
                .with_scale(Vec3::splat(rng.gen_range(0.2..0.8))),
                ..default()
            },
            Star { speed },
        ));
    }
}
