use crate::constants::*;
use crate::core::{GamePhase, Score};
use crate::effects::Trail;
use crate::gameplay::combat::spawn_missile;
use crate::gameplay::components::{Collider, Health};
use crate::gameplay::player::Player;
use bevy::prelude::*;
use bevy::render::mesh::Mesh;
use rand::prelude::*;

pub struct EnemyPlugin;
impl Plugin for EnemyPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (enemy_spawner, enemy_behavior).run_if(in_state(GamePhase::Running)),
        );
    }
}

#[derive(Component)]
pub struct Enemy {
    pub movement: u8,
    pub distance: i32,
    pub phase: f32,
    pub speed: f32,
    pub shoot_time: i32,
    pub kind: EnemyKind,
    pub circular_center: Vec2,
    pub circular_radius: f32,
    pub circular_angle: f32,
    pub dash_timer: f32,
    pub dash_cooldown: f32,
    pub dash_state: u8,
    pub formation_anchor: Vec2,
    pub formation_offset: Vec2,
}

#[derive(Clone, Copy)]
pub enum EnemyKind {
    Basic,
    Meteor,
    Special,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum EnemyType {
    Scout,
    Heavy,
    Bomber,
    Drone,
}

#[derive(Clone)]
pub struct WaveConfig {
    pub scout_count: u32,
    pub heavy_count: u32,
    pub bomber_count: u32,
    pub drone_count: u32,
    pub spawn_interval: f32,
    pub score_threshold: i32,
}

#[derive(Resource)]
pub struct WaveManager {
    pub current_wave: usize,
    pub enemies_remaining: u32,
    pub wave_timer: f32,
    pub wave_configs: Vec<WaveConfig>,
    pub enemies_spawned_this_wave: u32,
}

#[derive(Component, Clone, Copy)]
pub enum FiringPattern {
    Single,
    Spread {
        bullet_count: u32,
        spread_angle: f32,
    },
    Aimed,
    Burst {
        bullet_count: u32,
        burst_delay: f32,
    },
}

use crate::rendering::{spawn_ship_visual, ShipBounds};

fn enemy_spawner(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
    time: Res<Time>,
    mut wave_manager: ResMut<WaveManager>,
    score: Res<Score>,
    enemy_query: Query<&Enemy>,
) {
    let active_enemies = enemy_query.iter().count() as u32;
    wave_manager.enemies_remaining = active_enemies;

    if wave_manager.enemies_remaining == 0
        && wave_manager.enemies_spawned_this_wave > 0
        && wave_manager.current_wave + 1 < wave_manager.wave_configs.len()
    {
        let next_wave = &wave_manager.wave_configs[wave_manager.current_wave + 1];
        if score.0 >= next_wave.score_threshold {
            wave_manager.current_wave += 1;
            wave_manager.enemies_spawned_this_wave = 0;
            wave_manager.wave_timer = 0.0;
        }
    }

    if wave_manager.current_wave >= wave_manager.wave_configs.len() {
        return;
    }

    let current_config = &wave_manager.wave_configs[wave_manager.current_wave].clone();
    let total_enemies = current_config.scout_count
        + current_config.heavy_count
        + current_config.bomber_count
        + current_config.drone_count;

    if wave_manager.enemies_spawned_this_wave >= total_enemies {
        return;
    }

    wave_manager.wave_timer += time.delta_seconds();

    if wave_manager.wave_timer >= current_config.spawn_interval {
        wave_manager.wave_timer = 0.0;

        let spawns_this_tick = match wave_manager.current_wave {
            0 => 1,
            1 => 2,
            _ => 3,
        };

        for _ in 0..spawns_this_tick {
            if wave_manager.enemies_spawned_this_wave >= total_enemies {
                break;
            }

            let scouts_spawned = wave_manager
                .enemies_spawned_this_wave
                .min(current_config.scout_count);
            let heavies_spawned = (wave_manager
                .enemies_spawned_this_wave
                .saturating_sub(current_config.scout_count))
            .min(current_config.heavy_count);
            let bombers_spawned = (wave_manager
                .enemies_spawned_this_wave
                .saturating_sub(current_config.scout_count + current_config.heavy_count))
            .min(current_config.bomber_count);
            let drones_spawned = (wave_manager.enemies_spawned_this_wave.saturating_sub(
                current_config.scout_count
                    + current_config.heavy_count
                    + current_config.bomber_count,
            ))
            .min(current_config.drone_count);

            let enemy_type = if scouts_spawned < current_config.scout_count {
                EnemyType::Scout
            } else if heavies_spawned < current_config.heavy_count {
                EnemyType::Heavy
            } else if bombers_spawned < current_config.bomber_count {
                EnemyType::Bomber
            } else if drones_spawned < current_config.drone_count {
                EnemyType::Drone
            } else {
                break;
            };

            spawn_enemy_typed(&mut commands, &mut meshes, &mut materials, enemy_type);
            wave_manager.enemies_spawned_this_wave += 1;
        }
    }
}

fn spawn_enemy_typed(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<ColorMaterial>,
    enemy_type: EnemyType,
) {
    let mut rng = thread_rng();
    let x = rng.gen_range(-SCREEN_WIDTH / 2.0 + 30.0..SCREEN_WIDTH / 2.0 - 30.0);
    let y = rng.gen_range(140.0..180.0);

    let (size, hp, color, speed, kind, movement) = match enemy_type {
        EnemyType::Scout => (
            SIZE_ENEMY,
            3,
            Color::rgb(0.3, 1.0, 0.3),
            rng.gen_range(100.0..140.0),
            EnemyKind::Basic,
            rng.gen_range(4..7),
        ),
        EnemyType::Heavy => (
            Vec2::new(24.0, 24.0),
            12,
            Color::rgb(0.8, 0.3, 0.3),
            rng.gen_range(50.0..80.0),
            EnemyKind::Basic,
            rng.gen_range(0..4),
        ),
        EnemyType::Bomber => (
            Vec2::new(20.0, 18.0),
            6,
            Color::rgb(0.9, 0.6, 0.2),
            rng.gen_range(70.0..100.0),
            EnemyKind::Special,
            rng.gen_range(4..7),
        ),
        EnemyType::Drone => (
            Vec2::new(14.0, 14.0),
            4,
            Color::rgb(0.5, 0.5, 1.0),
            rng.gen_range(90.0..130.0),
            EnemyKind::Basic,
            7,
        ),
    };

    let trail_color = match kind {
        EnemyKind::Basic => Color::rgb(1.2, 0.3, 0.3),
        EnemyKind::Meteor => Color::rgb(0.8, 0.6, 0.4),
        EnemyKind::Special => Color::rgb(0.8, 0.5, 0.8),
    };

    info!(
        "Spawning enemy: {:?} at ({:.1}, {:.1})",
        enemy_type as u8, x, y
    );

    let mut e = commands.spawn((
        SpatialBundle {
            transform: Transform::from_translation(Vec3::new(x, y, 9.0)),
            ..default()
        },
        Enemy {
            movement,
            distance: rng.gen_range(20..70),
            phase: rng.gen_range(0.0..(std::f32::consts::TAU)),
            speed: speed / 100.0,
            shoot_time: rng.gen_range(20..120),
            kind,
            circular_center: Vec2::new(x, y),
            circular_radius: rng.gen_range(60.0..120.0),
            circular_angle: rng.gen_range(0.0..(std::f32::consts::TAU)),
            dash_timer: 0.0,
            dash_cooldown: 0.0,
            dash_state: 0,
            formation_anchor: Vec2::new(x, y),
            formation_offset: Vec2::new(rng.gen_range(-80.0..80.0), rng.gen_range(-60.0..60.0)),
        },
        Collider {
            w: size.x,
            h: size.y,
        },
        Health { hp, max: hp },
        Trail {
            positions: Vec::new(),
            max_length: 10,
            color: trail_color,
        },
        FiringPattern::Single,
        Name::new("Enemy"),
    ));
    let eid = e.id();
    let mut bounds: Option<ShipBounds> = None;
    e.with_children(|c| {
        let seed: u32 = rng.gen();
        let b = spawn_ship_visual(c, meshes, materials, size, seed, color);
        bounds = Some(b);
    });
    if let Some(b) = bounds {
        if let Some(mut ecmd) = commands.get_entity(eid) {
            ecmd.insert(Collider {
                w: b.width_units * size.x,
                h: b.height_units * size.y,
            });
        }
    }
}

fn enemy_behavior(
    time: Res<Time>,
    mut commands: Commands,
    mut q: Query<
        (
            Entity,
            &mut Transform,
            &mut Enemy,
            &Collider,
            &FiringPattern,
        ),
        Without<Player>,
    >,
    q_player: Query<&Transform, With<Player>>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    let player_t = q_player.get_single().ok().map(|t| t.translation);
    for (entity, mut t, mut e, col, pattern) in &mut q {
        let old = t.translation;
        // movimento
        match e.movement {
            0 => t.translation.y -= 60.0 * e.speed * time.delta_seconds(),
            1 => t.translation.y += 60.0 * e.speed * time.delta_seconds(),
            2 => t.translation.x -= 60.0 * e.speed * time.delta_seconds(),
            3 => t.translation.x += 60.0 * e.speed * time.delta_seconds(),
            4 => {
                t.translation.y -= 42.0 * e.speed * time.delta_seconds();
                e.phase += 0.1;
                t.translation.x += (e.phase).sin() * 1.5;
            }
            5 => {
                t.translation.x += 42.0 * e.speed * time.delta_seconds();
                e.phase += 0.1;
                t.translation.y += (e.phase).sin() * 1.5;
            }
            6 => {
                t.translation.y -= 72.0 * e.speed * time.delta_seconds();
                e.phase += 0.25;
                t.translation.x += (e.phase).sin() * 2.6;
            }
            7 => {
                if let Some(pt) = player_t {
                    let dx = pt.x - t.translation.x;
                    let dy = pt.y - t.translation.y;
                    let ang = dy.atan2(dx);
                    t.translation.x += ang.cos() * 0.6 * 60.0 * e.speed * time.delta_seconds();
                    t.translation.y += ang.sin() * 0.6 * 60.0 * e.speed * time.delta_seconds();
                    t.translation.x += (ang + std::f32::consts::FRAC_PI_2).cos() * 0.8;
                }
            }
            8 => {
                let angular_velocity = 2.0 * e.speed;
                e.circular_angle += angular_velocity * time.delta_seconds();
                t.translation.x = e.circular_center.x + e.circular_radius * e.circular_angle.cos();
                t.translation.y = e.circular_center.y + e.circular_radius * e.circular_angle.sin();
                e.circular_center.y -= 20.0 * e.speed * time.delta_seconds();
            }
            9 => {
                if let Some(pt) = player_t {
                    match e.dash_state {
                        0 => {
                            let dx = pt.x - t.translation.x;
                            let dy = pt.y - t.translation.y;
                            let dist = (dx * dx + dy * dy).sqrt().max(1.0);
                            let speed_mult = 3.0;
                            t.translation.x +=
                                (dx / dist) * 60.0 * e.speed * speed_mult * time.delta_seconds();
                            t.translation.y +=
                                (dy / dist) * 60.0 * e.speed * speed_mult * time.delta_seconds();
                            e.dash_timer += time.delta_seconds();
                            if e.dash_timer >= 0.5 {
                                e.dash_state = 1;
                                e.dash_timer = 0.0;
                            }
                        }
                        1 => {
                            let dx = pt.x - t.translation.x;
                            let dy = pt.y - t.translation.y;
                            let dist = (dx * dx + dy * dy).sqrt().max(1.0);
                            let speed_mult = 2.0;
                            t.translation.x -=
                                (dx / dist) * 60.0 * e.speed * speed_mult * time.delta_seconds();
                            t.translation.y -=
                                (dy / dist) * 60.0 * e.speed * speed_mult * time.delta_seconds();
                            e.dash_timer += time.delta_seconds();
                            if e.dash_timer >= 0.8 {
                                e.dash_state = 2;
                                e.dash_timer = 0.0;
                                e.dash_cooldown = thread_rng().gen_range(0.3..0.8);
                            }
                        }
                        _ => {
                            e.phase += 0.08;
                            t.translation.x += (e.phase).sin() * 1.2;
                            t.translation.y -= 30.0 * e.speed * time.delta_seconds();
                            e.dash_timer += time.delta_seconds();
                            if e.dash_timer >= e.dash_cooldown {
                                e.dash_state = 0;
                                e.dash_timer = 0.0;
                            }
                        }
                    }
                } else {
                    t.translation.y -= 60.0 * e.speed * time.delta_seconds();
                }
            }
            10 => {
                e.formation_anchor.y -= 35.0 * e.speed * time.delta_seconds();
                e.formation_anchor.x += (e.phase).sin() * 0.6;
                e.phase += 0.05;
                t.translation.x = e.formation_anchor.x + e.formation_offset.x;
                t.translation.y = e.formation_anchor.y + e.formation_offset.y;
            }
            11 => {
                e.formation_anchor.y -= 40.0 * e.speed * time.delta_seconds();
                let wave_offset = (e.phase).sin() * 0.5;
                e.phase += 0.06;
                t.translation.x = e.formation_anchor.x + e.formation_offset.x + wave_offset;
                t.translation.y = e.formation_anchor.y + e.formation_offset.y.abs();
            }
            12 => {
                e.formation_anchor.y -= 30.0 * e.speed * time.delta_seconds();
                e.phase += 1.5 * time.delta_seconds();
                let formation_radius = 50.0;
                let offset_angle = e.formation_offset.x / 100.0;
                t.translation.x =
                    e.formation_anchor.x + formation_radius * (e.phase + offset_angle).cos();
                t.translation.y =
                    e.formation_anchor.y + formation_radius * (e.phase + offset_angle).sin();
            }
            _ => {}
        }
        if e.distance > 0 {
            e.distance -= 1;
        } else {
            e.distance = thread_rng().gen_range(20..70);
            e.movement = thread_rng().gen_range(0..13);
            e.phase = 0.0;
        }

        // limites da tela
        if t.translation.y > SCREEN_HEIGHT / 2.0 - 20.0 {
            e.movement = 0;
            e.distance = 10;
        }
        if t.translation.y < -SCREEN_HEIGHT / 2.0 + 20.0 {
            e.movement = 1;
            e.distance = 10;
        }
        if t.translation.x > SCREEN_WIDTH / 2.0 - 20.0 {
            e.movement = 2;
            e.distance = 10;
        }
        if t.translation.x < -SCREEN_WIDTH / 2.0 + 20.0 {
            e.movement = 3;
            e.distance = 10;
        }

        // tiro de inimigo
        if !matches!(e.kind, EnemyKind::Meteor) {
            if e.shoot_time <= 0 {
                e.shoot_time = thread_rng().gen_range(20..180);
                let bx = t.translation.x;
                let by = t.translation.y - col.h / 2.0;
                fire_pattern(
                    &mut commands,
                    &mut meshes,
                    &mut materials,
                    Vec2::new(bx, by - 10.0),
                    *pattern,
                    player_t,
                );
            } else {
                e.shoot_time -= 1;
            }
        }

        // se sair muito da tela, remove
        if t.translation.y < -SCREEN_HEIGHT / 2.0 - 30.0
            || t.translation.x < -SCREEN_WIDTH / 2.0 - 30.0
            || t.translation.x > SCREEN_WIDTH / 2.0 + 30.0
        {
            if let Some(ecmd) = commands.get_entity(entity) {
                ecmd.despawn_recursive();
            }
            continue;
        }

        let _vx = t.translation.x - old.x;
        let _vy = t.translation.y - old.y;
        let _ = (_vx, _vy);
    }
}

fn fire_pattern(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<ColorMaterial>,
    pos: Vec2,
    pattern: FiringPattern,
    player_pos: Option<Vec3>,
) {
    match pattern {
        FiringPattern::Single => {
            spawn_missile(
                commands,
                meshes,
                materials,
                Vec2::new(pos.x - 9.0, pos.y),
                Vec2::new(0.0, -180.0),
                false,
            );
            spawn_missile(
                commands,
                meshes,
                materials,
                Vec2::new(pos.x + 9.0, pos.y),
                Vec2::new(0.0, -180.0),
                false,
            );
        }
        FiringPattern::Spread {
            bullet_count,
            spread_angle,
        } => {
            let half_angle = spread_angle / 2.0;
            let angle_step = if bullet_count > 1 {
                spread_angle / (bullet_count - 1) as f32
            } else {
                0.0
            };
            for i in 0..bullet_count {
                let angle = -std::f32::consts::FRAC_PI_2 - half_angle + angle_step * i as f32;
                let vel = Vec2::new(angle.cos() * 180.0, angle.sin() * 180.0);
                spawn_missile(commands, meshes, materials, pos, vel, false);
            }
        }
        FiringPattern::Aimed => {
            if let Some(target) = player_pos {
                let dx = target.x - pos.x;
                let dy = target.y - pos.y;
                let angle = dy.atan2(dx);
                let vel = Vec2::new(angle.cos() * 180.0, angle.sin() * 180.0);
                spawn_missile(commands, meshes, materials, pos, vel, false);
            } else {
                spawn_missile(
                    commands,
                    meshes,
                    materials,
                    pos,
                    Vec2::new(0.0, -180.0),
                    false,
                );
            }
        }
        FiringPattern::Burst {
            bullet_count,
            burst_delay: _,
        } => {
            for i in 0..bullet_count {
                let offset_x = (i as f32 - bullet_count as f32 / 2.0) * 8.0;
                spawn_missile(
                    commands,
                    meshes,
                    materials,
                    Vec2::new(pos.x + offset_x, pos.y),
                    Vec2::new(0.0, -180.0),
                    false,
                );
            }
        }
    }
}
