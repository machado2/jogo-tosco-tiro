use crate::core::GamePhase;
use crate::gameplay::components::{Charge, Lifetime};
use crate::gameplay::player::Player;
use bevy::math::primitives::Rectangle;
use bevy::prelude::*;
use bevy::render::mesh::Mesh;
use bevy::sprite::{MaterialMesh2dBundle, Mesh2dHandle};
use rand::Rng;

pub struct EffectsPlugin;
impl Plugin for EffectsPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (
                lifetime_cleanup,
                update_particles,
                update_trails,
                player_trail,
                engine_flame_pulse,
            )
                .run_if(in_state(GamePhase::Running)),
        );
    }
}

#[derive(Component)]
pub struct Particle2D {
    pub vel: Vec2,
    pub life: f32,
    pub total: f32,
    pub start: Color,
    pub end: Color,
    pub spin: f32,
}

#[derive(Component)]
pub struct Trail {
    pub positions: Vec<Vec2>,
    pub max_length: usize,
    pub color: Color,
}

#[derive(Component)]
pub struct TrailSegment {
    pub index: usize,
    pub parent_entity: Entity,
}

#[derive(Component)]
pub struct EngineFlame {
    pub timer: Timer,
}

#[derive(Component)]
struct ToDespawn;

pub fn emit_burst(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<ColorMaterial>,
    pos: Vec2,
    color: Color,
    count: usize,
    speed: std::ops::Range<f32>,
    size: std::ops::Range<f32>,
) {
    let mut rng = rand::thread_rng();
    for _ in 0..count {
        let ang = rng.gen::<f32>() * std::f32::consts::TAU;
        let spd = rng.gen_range(speed.start..speed.end);
        let vx = ang.cos() * spd;
        let vy = ang.sin() * spd;
        let sz = rng.gen_range(size.start..size.end);
        let life = rng.gen_range(0.35..0.65);
        let mesh = meshes.add(Mesh::from(Rectangle {
            half_size: Vec2::splat(0.5),
            }));
        let mat = materials.add(ColorMaterial {
            color: Color::rgba(color.r() * 1.6, color.g() * 1.6, color.b() * 1.6, 0.95),
            ..default()
        });
        commands.spawn((
            MaterialMesh2dBundle {
                mesh: Mesh2dHandle(mesh),
                material: mat,
                transform: Transform::from_translation(Vec3::new(pos.x, pos.y, 7.0))
                    .with_scale(Vec3::splat(sz)),
                ..default()
            },
            Particle2D {
                vel: Vec2::new(vx, vy),
                life,
                total: life,
                start: color * 1.2,
                end: Color::rgba(0.0, 0.0, 0.0, 0.0),
                spin: rng.gen_range(-6.0..6.0),
            },
        ));
    }
}

fn lifetime_cleanup(
    time: Res<Time>,
    mut commands: Commands,
    mut q: Query<(Entity, &mut Lifetime)>,
) {
    for (e, mut lt) in &mut q {
        lt.timer.tick(time.delta());
        if lt.timer.finished() {
            if let Some(ecmd) = commands.get_entity(e) {
                ecmd.despawn_recursive();
            }
        }
    }
}

fn update_particles(
    time: Res<Time>,
    mut commands: Commands,
    mut q: Query<(
        Entity,
        &mut Transform,
        &mut Particle2D,
        &Handle<ColorMaterial>,
    )>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    let dt = time.delta_seconds();
    for (e, mut t, mut p, mat_h) in &mut q {
        p.life -= dt;
        if p.life <= 0.0 {
            if let Some(mut ecmd) = commands.get_entity(e) {
                ecmd.insert(ToDespawn);
            }
            continue;
        }
        // update pos/vel
        t.translation.x += p.vel.x * dt;
        t.translation.y += p.vel.y * dt;
        p.vel *= 0.96;
        // spin / scale fade
        t.rotate_z(p.spin * dt);
        let k = 1.0 - (p.life / p.total);
        let s = (1.0 - k * 0.8).max(0.1);
        t.scale = Vec3::splat(s);
        // color lerp
        if let Some(m) = materials.get_mut(mat_h) {
            let c = Color::rgba(
                p.start.r() * (1.0 - k) + p.end.r() * k,
                p.start.g() * (1.0 - k) + p.end.g() * k,
                p.start.b() * (1.0 - k) + p.end.b() * k,
                (1.0 - k) * 0.9,
            );
            m.color = c;
        }
    }
}

fn update_trails(
    mut commands: Commands,
    mut q: Query<(Entity, &GlobalTransform, &mut Trail)>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
    q_segments: Query<Entity, With<TrailSegment>>,
) {
    // Clean up old trail segments
    for seg_entity in q_segments.iter() {
        if let Some(ecmd) = commands.get_entity(seg_entity) {
            ecmd.despawn_recursive();
        }
    }

    for (entity, transform, mut trail) in q.iter_mut() {
        let current_pos = Vec2::new(transform.translation().x, transform.translation().y);

        // Add current position to trail
        trail.positions.push(current_pos);

        // Keep trail at max length
        if trail.positions.len() > trail.max_length {
            trail.positions.remove(0);
        }

        // Render trail segments with gradient
        let len = trail.positions.len();
        if len >= 2 {
            for i in 0..(len - 1) {
                let progress = i as f32 / len.max(1) as f32;
                let alpha = progress * 0.6;
                let scale_factor = 0.3 + progress * 0.7;

                let start = trail.positions[i];
                let end = trail.positions[i + 1];
                let mid = (start + end) * 0.5;
                let delta = end - start;
                let length = delta.length();

                if length > 0.1 {
                    let angle = delta.y.atan2(delta.x);

                    let mesh = meshes.add(Mesh::from(Rectangle {
                        half_size: Vec2::new(length * 0.5, 1.5),
                        }));
                    let color = Color::rgba(
                        trail.color.r() * (0.3 + progress * 0.7),
                        trail.color.g() * (0.3 + progress * 0.7),
                        trail.color.b() * (0.3 + progress * 0.7),
                        alpha,
                    );
                    let mat = materials.add(ColorMaterial { color, ..default() });

                    commands.spawn((
                        MaterialMesh2dBundle {
                            mesh: Mesh2dHandle(mesh),
                            material: mat,
                            transform: Transform::from_translation(Vec3::new(mid.x, mid.y, 3.0))
                                .with_rotation(Quat::from_rotation_z(angle))
                                .with_scale(Vec3::new(1.0, scale_factor, 1.0)),
                            ..default()
                        },
                        TrailSegment {
                            index: i,
                            parent_entity: entity,
                        },
                    ));
                }
            }
        }
    }
}

fn player_trail(
    time: Res<Time>,
    mut commands: Commands,
    q_player: Query<(&Transform, &Charge), With<Player>>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
    mut last: Local<Option<Vec2>>,
) {
    if let Ok((t, charge)) = q_player.get_single() {
        let pos = Vec2::new(t.translation.x, t.translation.y);
        if let Some(prev) = *last {
            let dp = pos - prev;
            let dist = dp.length();
            let speed = dist / time.delta_seconds().max(1e-3);
            if speed > 30.0 {
                let factor = (charge.value / charge.max).clamp(0.0, 1.0);
                let base = Color::rgba(0.3 + 0.5 * factor, 0.6 + 0.3 * factor, 1.2, 1.0);
                emit_burst(
                    &mut commands,
                    &mut meshes,
                    &mut materials,
                    pos,
                    base,
                    2,
                    60.0..120.0,
                    0.01..0.03,
                );
            }
        }
        *last = Some(pos);
    }
}

fn engine_flame_pulse(
    time: Res<Time>,
    mut q: Query<(&mut EngineFlame, &Handle<ColorMaterial>)>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    for (mut ef, mat_h) in &mut q {
        ef.timer.tick(time.delta());
        if ef.timer.just_finished() {
            if let Some(mat) = materials.get_mut(mat_h) {
                // pequeno pulso emissivo (simulado via cor)
                let t = (time.elapsed_seconds() * 6.0).sin() * 0.3 + 0.7;
                mat.color = Color::rgba(1.8 * t, 0.9 * t, 0.4 * t, 0.9);
            }
        }
    }
}
