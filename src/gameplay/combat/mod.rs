use crate::constants::{
    POINTS_ENEMY, POINTS_METEOR, POINTS_SPECIAL, SCREEN_HEIGHT, SCREEN_WIDTH, SIZE_MISSILE,
};
use crate::core::{GamePhase, Muted, Score, Shake};
use crate::effects::emit_burst;
use crate::gameplay::components::{Collider, Health, LaserFollowPlayer, TrailTimer, Velocity};
use crate::gameplay::enemy::{Enemy, EnemyKind};
use crate::gameplay::player::Player;
use bevy::math::primitives::Rectangle;
use bevy::prelude::*;
use bevy::render::mesh::Mesh;
use bevy::sprite::{MaterialMesh2dBundle, Mesh2dHandle};
use rand::Rng;
use std::collections::HashSet;

#[derive(Component)]
pub struct DamageVignette {
    pub timer: Timer,
    pub intensity: f32,
}

#[derive(Component)]
pub struct FlashEffect {
    pub timer: Timer,
}

pub struct CombatPlugin;
impl Plugin for CombatPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(
            Update,
            (
                follow_laser_to_player,
                move_bullets,
                collisions_and_damage,
                update_flash_effects,
                update_damage_vignette,
            )
                .run_if(in_state(GamePhase::Running)),
        );
    }
}

#[derive(Component)]
pub struct Bullet {
    pub friendly: bool,
    pub damage: i32,
    pub laser: bool,
}

pub fn spawn_missile(
    commands: &mut Commands,
    meshes: &mut Assets<bevy::render::mesh::Mesh>,
    materials: &mut Assets<ColorMaterial>,
    pos: Vec2,
    vel: Vec2,
    friendly: bool,
) {
    // Mesh procedural para o míssil: flecha para aliados, losango para inimigos
    let mesh = if friendly {
        crate::rendering::mesh_arrow()
    } else {
        crate::rendering::mesh_diamond()
    };
    let mesh_h = meshes.add(mesh);
    let color = if friendly {
        Color::rgb(0.9, 0.9, 0.9)
    } else {
        Color::rgb(1.0, 0.4, 0.4)
    };
    let mat_h = materials.add(ColorMaterial { color, ..default() });
    let ang = vel.y.atan2(vel.x);
    let mut e = commands.spawn((
        MaterialMesh2dBundle {
            mesh: Mesh2dHandle(mesh_h),
            material: mat_h,
            transform: Transform::from_translation(Vec3::new(pos.x, pos.y, 4.0))
                .with_scale(Vec3::new(SIZE_MISSILE.x, SIZE_MISSILE.y, 1.0))
                .with_rotation(Quat::from_rotation_z(ang - std::f32::consts::FRAC_PI_2)),
            ..default()
        },
        Bullet {
            friendly,
            damage: 1,
            laser: false,
        },
        Collider {
            w: SIZE_MISSILE.x,
            h: SIZE_MISSILE.y,
        },
        Velocity(Vec2::new(vel.x, vel.y)),
        TrailTimer(Timer::from_seconds(0.045, TimerMode::Repeating)),
        Name::new(if friendly { "Missile(F)" } else { "Missile(E)" }),
    ));
    // halo glow como filho, alongado
    e.with_children(|c| {
        let gmesh = meshes.add(Mesh::from(Rectangle {
            half_size: Vec2::new(0.6, 1.2),
            }));
        let gcolor = if friendly {
            Color::rgba(1.0, 1.8, 2.0, 0.6)
        } else {
            Color::rgba(2.0, 1.0, 0.8, 0.6)
        };
        let gmat = materials.add(ColorMaterial {
            color: gcolor,
            ..default()
        });
        c.spawn(MaterialMesh2dBundle {
            mesh: Mesh2dHandle(gmesh),
            material: gmat,
            transform: Transform::from_scale(Vec3::new(1.0, 1.0, 1.0)),
            ..default()
        });
    });
}

fn follow_laser_to_player(
    mut sets: ParamSet<(
        Query<&Transform, With<Player>>,
        Query<&mut Transform, (With<Bullet>, With<LaserFollowPlayer>)>,
    )>,
) {
    let player_x = sets.p0().get_single().ok().map(|t| t.translation.x);
    if let Some(px) = player_x {
        for mut t in sets.p1().iter_mut() {
            t.translation.x = px;
        }
    }
}

fn move_bullets(
    time: Res<Time>,
    mut commands: Commands,
    mut q: Query<(
        Entity,
        &mut Transform,
        &Velocity,
        &Bullet,
        Option<&mut TrailTimer>,
    )>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    for (e, mut t, v, b, trail) in &mut q {
        if b.laser {
            // laser sobe um pouco (o Lifetime remove depois)
            t.translation.y += -700.0 * time.delta_seconds();
        } else {
            t.translation += Vec3::new(v.x, v.y, 0.0) * time.delta_seconds();
            if let Some(mut timer) = trail {
                timer.0.tick(time.delta());
                if timer.0.just_finished() {
                    let c = if b.friendly {
                        Color::rgb(1.0, 1.0, 1.0)
                    } else {
                        Color::rgb(1.0, 0.3, 0.3)
                    };
                    emit_burst(
                        &mut commands,
                        &mut meshes,
                        &mut materials,
                        Vec2::new(t.translation.x, t.translation.y),
                        c,
                        1,
                        30.0..90.0,
                        0.008..0.02,
                    );
                }
            }
        }
        if t.translation.x < -SCREEN_WIDTH / 2.0 - 10.0
            || t.translation.x > SCREEN_WIDTH / 2.0 + 10.0
            || t.translation.y < -SCREEN_HEIGHT / 2.0 - 10.0
            || t.translation.y > SCREEN_HEIGHT / 2.0 + 10.0
        {
            if let Some(ecmd) = commands.get_entity(e) {
                ecmd.despawn_recursive();
            }
        }
    }
}

fn collisions_and_damage(
    mut commands: Commands,
    mut score: ResMut<Score>,
    mut shake: ResMut<Shake>,
    time: Res<Time>,
    mut sets: ParamSet<(
        Query<(Entity, &GlobalTransform, &Collider, &mut Health, &Enemy), Without<Player>>,
        Query<(
            Entity,
            &GlobalTransform,
            &Collider,
            &Bullet,
            Option<&Velocity>,
        )>,
    )>,
    q_player_info: Query<(&GlobalTransform, &Collider), With<Player>>,
    mut q_player_health: Query<(Entity, &mut Health), With<Player>>,
    audio: Res<crate::audio::AudioEngine>,
    muted: Res<Muted>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    // Snapshot bullets to avoid overlapping ParamSet borrows
    let bullets: Vec<(Entity, f32, f32, f32, f32, i32, bool, f32, f32)> = sets
        .p1()
        .iter()
        .map(|(e, t, c, b, v)| {
            let (vx, vy) = v.map(|vv| (vv.0.x, vv.0.y)).unwrap_or((0.0, 0.0));
            (
                e,
                t.translation().x,
                t.translation().y,
                c.w,
                c.h,
                b.damage,
                b.friendly,
                vx,
                vy,
            )
        })
        .collect();
    let mut removed_bullets: HashSet<Entity> = HashSet::new();
    let mut removed_enemies: HashSet<Entity> = HashSet::new();

    // friendly bullets x enemies
    let dt = time.delta_seconds();
    for (be, bx, by, bw, bh, dmg, _friendly, vx, vy) in bullets.iter().copied().filter(|b| b.6) {
        if removed_bullets.contains(&be) {
            continue;
        }
        let extra_w = vx.abs() * dt;
        let extra_h = vy.abs() * dt;
        for (ee, et, ec, mut eh, enemy) in sets.p0().iter_mut() {
            if removed_enemies.contains(&ee) {
                continue;
            }
            let ex = et.translation().x;
            let ey = et.translation().y;
            let dx = (bx - ex).abs() - (bw / 2.0 + extra_w) - (ec.w / 2.0);
            let dy = (by - ey).abs() - (bh / 2.0 + extra_h) - (ec.h / 2.0);
            if dx <= 0.0 && dy <= 0.0 {
                eh.hp -= dmg;
                if let Some(ecmd) = commands.get_entity(be) {
                    ecmd.despawn_recursive();
                }
                removed_bullets.insert(be);
                if eh.hp <= 0 {
                    score.0 += match enemy.kind {
                        EnemyKind::Basic => POINTS_ENEMY,
                        EnemyKind::Meteor => POINTS_METEOR,
                        EnemyKind::Special => POINTS_SPECIAL,
                    };
                    let (intensity, frames) = if matches!(enemy.kind, EnemyKind::Special) {
                        (3.0, 24)
                    } else {
                        (1.5, 8)
                    };
                    shake.intensity = intensity;
                    shake.frames = frames;
                    // Enhanced enemy destruction particles
                    emit_enemy_destruction_burst(
                        &mut commands,
                        &mut meshes,
                        &mut materials,
                        Vec2::new(ex, ey),
                    );
                    if let Some(ecmd) = commands.get_entity(ee) {
                        ecmd.despawn_recursive();
                    }
                    removed_enemies.insert(ee);
                    if !muted.0 {
                        audio.explosion();
                    }
                } else {
                    // Bullet impact particles
                    emit_bullet_impact_burst(
                        &mut commands,
                        &mut meshes,
                        &mut materials,
                        Vec2::new(bx, by),
                        true,
                    );
                }
                break;
            }
        }
    }

    // nave inimiga x nave do jogador (AABB)
    let mut player_ram_damage: i32 = 0;
    if let Ok((pt, pc)) = q_player_info.get_single() {
        let px = pt.translation().x;
        let py = pt.translation().y;
        for (ee, et, ec, mut eh, enemy) in sets.p0().iter_mut() {
            if removed_enemies.contains(&ee) {
                continue;
            }
            let ex = et.translation().x;
            let ey = et.translation().y;
            let dx = (px - ex).abs() - (pc.w / 2.0) - (ec.w / 2.0);
            let dy = (py - ey).abs() - (pc.h / 2.0) - (ec.h / 2.0);
            if dx <= 0.0 && dy <= 0.0 {
                // dano recíproco moderado
                let dmg_enemy = 3;
                let dmg_player = 5;
                eh.hp -= dmg_enemy;
                player_ram_damage += dmg_player;
                // efeitos
                let cx = (px + ex) * 0.5;
                let cy = (py + ey) * 0.5;
                emit_burst(
                    &mut commands,
                    &mut meshes,
                    &mut materials,
                    Vec2::new(cx, cy),
                    Color::rgb(1.0, 0.5, 0.2),
                    24,
                    120.0..200.0,
                    0.02..0.05,
                );
                shake.intensity = 3.0;
                shake.frames = 12;
                if !muted.0 {
                    audio.hit();
                }
                if eh.hp <= 0 {
                    // Enhanced enemy explosion
                    emit_enemy_destruction_burst(
                        &mut commands,
                        &mut meshes,
                        &mut materials,
                        Vec2::new(ex, ey),
                    );
                    if let Some(ecmd) = commands.get_entity(ee) {
                        ecmd.despawn_recursive();
                    }
                    removed_enemies.insert(ee);
                    score.0 += match enemy.kind {
                        EnemyKind::Basic => 5,
                        EnemyKind::Meteor => 1,
                        EnemyKind::Special => 20,
                    };
                    if !muted.0 {
                        audio.explosion();
                    }
                }
                // não continue checando esse inimigo este frame
            }
        }
    }
    // aplica dano por "ram" no player
    if player_ram_damage > 0 {
        if let Ok((pe, mut php)) = q_player_health.get_single_mut() {
            php.hp -= player_ram_damage;
            if php.hp <= 0 {
                if let Some(ecmd) = commands.get_entity(pe) {
                    ecmd.despawn_recursive();
                }
            }
        }
    }

    // enemy bullets x player (usar snapshot imutável do player)
    if let Ok((pt, pc)) = q_player_info.get_single() {
        let px = pt.translation().x;
        let py = pt.translation().y;
        for (be, bx, by, bw, bh, dmg, _friendly, vx, vy) in bullets.iter().copied().filter(|b| !b.6)
        {
            if removed_bullets.contains(&be) {
                continue;
            }
            let extra_w = vx.abs() * dt;
            let extra_h = vy.abs() * dt;
            let dx = (bx - px).abs() - (bw / 2.0 + extra_w) - (pc.w / 2.0);
            let dy = (by - py).abs() - (bh / 2.0 + extra_h) - (pc.h / 2.0);
            if dx <= 0.0 && dy <= 0.0 {
                shake.intensity = 2.0;
                shake.frames = 10;
                // Bullet impact on player
                emit_bullet_impact_burst(
                    &mut commands,
                    &mut meshes,
                    &mut materials,
                    Vec2::new(px, py),
                    false,
                );
                if let Some(ecmd) = commands.get_entity(be) {
                    ecmd.despawn_recursive();
                }
                removed_bullets.insert(be);
                if !muted.0 {
                    audio.hit();
                }

                // Spawn damage vignette
                let mesh = meshes.add(Mesh::from(Rectangle {
                    half_size: Vec2::splat(0.5),
                    }));
                let mat = materials.add(ColorMaterial {
                    color: Color::rgba(1.0, 0.0, 0.0, 0.5),
                    ..default()
                });
                commands.spawn((
                    MaterialMesh2dBundle {
                        mesh: Mesh2dHandle(mesh),
                        material: mat,
                        transform: Transform::from_translation(Vec3::new(0.0, 0.0, 100.0))
                            .with_scale(Vec3::new(SCREEN_WIDTH * 1.2, SCREEN_HEIGHT * 1.2, 1.0)),
                        ..default()
                    },
                    DamageVignette {
                        timer: Timer::from_seconds(0.6, TimerMode::Once),
                        intensity: 0.5,
                    },
                ));

                // aplica dano ao player
                if let Ok((pe, mut php)) = q_player_health.get_single_mut() {
                    php.hp -= dmg;
                    if php.hp <= 0 {
                        if let Some(ecmd) = commands.get_entity(pe) {
                            ecmd.despawn_recursive();
                        }
                    }
                }
            }
        }
    }
}

// Enhanced burst for enemy destruction
fn emit_enemy_destruction_burst(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<ColorMaterial>,
    pos: Vec2,
) {
    let mut rng = rand::thread_rng();
    // Large bright particles
    for _ in 0..25 {
        let ang = rng.gen::<f32>() * std::f32::consts::TAU;
        let spd = rng.gen_range(180.0..320.0);
        let vx = ang.cos() * spd;
        let vy = ang.sin() * spd;
        let sz = rng.gen_range(0.04..0.08);
        let life = rng.gen_range(0.5..0.8);
        let mesh = meshes.add(Mesh::from(Rectangle {
            half_size: Vec2::splat(0.5),
            }));
        let color = Color::rgb(1.0, 0.6, 0.2);
        let mat = materials.add(ColorMaterial {
            color: Color::rgba(color.r() * 2.0, color.g() * 2.0, color.b() * 1.8, 1.0),
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
            crate::effects::Particle2D {
                vel: Vec2::new(vx, vy),
                life,
                total: life,
                start: color * 1.5,
                end: Color::rgba(0.2, 0.0, 0.0, 0.0),
                spin: rng.gen_range(-8.0..8.0),
            },
        ));
    }
    // Fast small sparks
    for _ in 0..20 {
        let ang = rng.gen::<f32>() * std::f32::consts::TAU;
        let spd = rng.gen_range(300.0..450.0);
        let vx = ang.cos() * spd;
        let vy = ang.sin() * spd;
        let sz = rng.gen_range(0.015..0.03);
        let life = rng.gen_range(0.2..0.4);
        let mesh = meshes.add(Mesh::from(Rectangle {
            half_size: Vec2::splat(0.5),
            }));
        let color = Color::rgb(1.0, 0.9, 0.3);
        let mat = materials.add(ColorMaterial {
            color: Color::rgba(2.0, 2.0, 1.0, 1.0),
            ..default()
        });
        commands.spawn((
            MaterialMesh2dBundle {
                mesh: Mesh2dHandle(mesh),
                material: mat,
                transform: Transform::from_translation(Vec3::new(pos.x, pos.y, 7.5))
                    .with_scale(Vec3::splat(sz)),
                ..default()
            },
            crate::effects::Particle2D {
                vel: Vec2::new(vx, vy),
                life,
                total: life,
                start: color * 1.8,
                end: Color::rgba(0.0, 0.0, 0.0, 0.0),
                spin: rng.gen_range(-12.0..12.0),
            },
        ));
    }
}

// Burst for bullet impacts
fn emit_bullet_impact_burst(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<ColorMaterial>,
    pos: Vec2,
    friendly: bool,
) {
    let mut rng = rand::thread_rng();
    let base_color = if friendly {
        Color::rgb(0.5, 0.9, 1.0)
    } else {
        Color::rgb(1.0, 0.3, 0.3)
    };
    for _ in 0..12 {
        let ang = rng.gen::<f32>() * std::f32::consts::TAU;
        let spd = rng.gen_range(80.0..180.0);
        let vx = ang.cos() * spd;
        let vy = ang.sin() * spd;
        let sz = rng.gen_range(0.015..0.035);
        let life = rng.gen_range(0.15..0.35);
        let mesh = meshes.add(Mesh::from(Rectangle {
            half_size: Vec2::splat(0.5),
            }));
        let mat = materials.add(ColorMaterial {
            color: Color::rgba(
                base_color.r() * 1.5,
                base_color.g() * 1.5,
                base_color.b() * 1.5,
                0.9,
            ),
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
            crate::effects::Particle2D {
                vel: Vec2::new(vx, vy),
                life,
                total: life,
                start: base_color * 1.3,
                end: Color::rgba(0.0, 0.0, 0.0, 0.0),
                spin: rng.gen_range(-10.0..10.0),
            },
        ));
    }

    // Flash effect on bullet impact
    let mesh = meshes.add(Mesh::from(Rectangle {
        half_size: Vec2::splat(0.5),
        }));
    let mat = materials.add(ColorMaterial {
        color: Color::rgba(3.0, 3.0, 3.0, 1.0),
        ..default()
    });
    commands.spawn((
        MaterialMesh2dBundle {
            mesh: Mesh2dHandle(mesh),
            material: mat,
            transform: Transform::from_translation(Vec3::new(pos.x, pos.y, 8.0))
                .with_scale(Vec3::splat(0.12)),
            ..default()
        },
        FlashEffect {
            timer: Timer::from_seconds(0.08, TimerMode::Once),
        },
    ));
}

fn update_flash_effects(
    time: Res<Time>,
    mut commands: Commands,
    mut q: Query<(Entity, &mut FlashEffect, &Handle<ColorMaterial>)>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    for (e, mut flash, mat_h) in &mut q {
        flash.timer.tick(time.delta());
        let progress = flash.timer.fraction();
        let alpha = 1.0 - progress;

        if let Some(mat) = materials.get_mut(mat_h) {
            mat.color = Color::rgba(3.0 * alpha, 3.0 * alpha, 3.0 * alpha, alpha);
        }

        if flash.timer.finished() {
            if let Some(ecmd) = commands.get_entity(e) {
                ecmd.despawn_recursive();
            }
        }
    }
}

fn update_damage_vignette(
    time: Res<Time>,
    mut commands: Commands,
    mut q: Query<(Entity, &mut DamageVignette, &Handle<ColorMaterial>)>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    for (e, mut vignette, mat_h) in &mut q {
        vignette.timer.tick(time.delta());
        let progress = vignette.timer.fraction();
        let alpha = vignette.intensity * (1.0 - progress);

        if let Some(mat) = materials.get_mut(mat_h) {
            mat.color = Color::rgba(1.0, 0.0, 0.0, alpha);
        }

        if vignette.timer.finished() {
            if let Some(ecmd) = commands.get_entity(e) {
                ecmd.despawn_recursive();
            }
        }
    }
}
