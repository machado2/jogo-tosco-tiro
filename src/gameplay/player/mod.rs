use crate::constants::*;
use crate::core::{GamePhase, Muted, Score, Shake};
use crate::effects::emit_burst;
use crate::gameplay::combat::{spawn_missile, Bullet};
use crate::gameplay::components::{
    Charge, Collider, Health, LaserFollowPlayer, Lifetime, Velocity,
};
use crate::input::{CursorPos, InputActions};
use bevy::prelude::*;
use bevy::sprite::{MaterialMesh2dBundle, Mesh2dHandle};
use bevy::window::PrimaryWindow;

#[derive(Component)]
pub struct Player;

#[derive(Component)]
pub struct PlayerCooldowns {
    pub shoot: Timer,
    pub special: Timer,
}

pub struct PlayerPlugin;
impl Plugin for PlayerPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, player_control.run_if(in_state(GamePhase::Running)));
    }
}

#[allow(clippy::too_many_arguments)]
fn player_control(
    time: Res<Time>,
    cursor: Res<CursorPos>,
    actions: Res<InputActions>,
    mut commands: Commands,
    mut q_player: Query<
        (
            Entity,
            &mut Transform,
            &mut Health,
            &mut Charge,
            &Collider,
            &mut PlayerCooldowns,
        ),
        With<Player>,
    >,
    mut meshes: ResMut<Assets<bevy::render::mesh::Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
    score: Res<Score>,
    mut shake: ResMut<Shake>,
    audio: Res<crate::audio::AudioEngine>,
    muted: Res<Muted>,
    windows: Query<&Window, With<PrimaryWindow>>,
) {
    let Ok((_entity, mut t, mut hp, mut charge, col, mut cooldowns)) = q_player.get_single_mut()
    else {
        return;
    };

    let dt = time.delta();
    cooldowns.shoot.tick(dt);
    cooldowns.special.tick(dt);

    // movimento: segue cursor com velocidade limitada
    let target = cursor.world;
    let dx = target.x - t.translation.x;
    let dy = target.y - t.translation.y;
    let dist = (dx * dx + dy * dy).sqrt().max(1.0);
    let max_speed = 300.0; // px/s
    if dist > 20.0 {
        t.translation.x += dx * max_speed * time.delta_seconds() / dist;
        t.translation.y += dy * max_speed * time.delta_seconds() / dist;
    } else {
        t.translation.x = target.x;
        t.translation.y = target.y;
    }
    // dentro da janela atual
    if let Ok(window) = windows.get_single() {
        let half_w = col.w / 2.0;
        let half_h = col.h / 2.0;
        let w = window.width();
        let h = window.height();
        t.translation.x = t.translation.x.clamp(-w / 2.0 + half_w, w / 2.0 - half_w);
        t.translation.y = t.translation.y.clamp(-h / 2.0 + half_h, h / 2.0 - half_h);
    } else {
        t.translation = crate::util::clamp_to_screen(t.translation, Vec2::new(col.w, col.h));
    }

    // recarga & auto-heal leve quando cheio
    charge.value = (charge.value + CHARGE_REFILL_PER_SEC * time.delta_seconds()).min(charge.max);
    if charge.value >= charge.max && hp.hp < hp.max {
        // ~0.06 HP/s
        hp.hp = (hp.hp + (time.delta_seconds() * 3.6) as i32).min(hp.max);
    }

    // ataque primário (esq): míssil ou laser (>=500 pontos)
    let can_shoot = cooldowns.shoot.finished();
    if actions.fire_primary && can_shoot && charge.value >= 1.0 {
        cooldowns.shoot = Timer::from_seconds(0.08, TimerMode::Once);
        charge.value -= 1.0;
        if score.0 >= 500 {
            // laser
            let laser_color = Color::rgb(0.0, 1.0, 1.0);
            let mesh = bevy::render::mesh::Mesh::from(bevy::math::primitives::Rectangle {
                half_size: Vec2::splat(0.5),
                });
            let mesh_h = meshes.add(mesh);
            let mat_h = materials.add(laser_color);
            let y = t.translation.y + (SIZE_PLAYER.y / 2.0) - 10.0;
            let mut laser_e = commands.spawn((
                MaterialMesh2dBundle {
                    mesh: Mesh2dHandle(mesh_h),
                    material: mat_h,
                    transform: Transform::from_translation(Vec3::new(t.translation.x, y, 5.0))
                        .with_scale(Vec3::new(SIZE_LASER.x, SIZE_LASER.y, 1.0)),
                    ..default()
                },
                Bullet {
                    friendly: true,
                    damage: 2,
                    laser: true,
                },
                Collider {
                    w: SIZE_LASER.x,
                    h: SIZE_LASER.y,
                },
                Velocity(Vec2::new(0.0, 0.0)),
                LaserFollowPlayer,
                Lifetime {
                    timer: Timer::from_seconds(0.8, TimerMode::Once),
                },
                Name::new("Laser"),
            ));
            // aura glow como filho
            laser_e.with_children(|c| {
                let glow_mesh = meshes.add(bevy::render::mesh::Mesh::from(
                    bevy::math::primitives::Rectangle {
                        half_size: Vec2::new(1.0, 6.0),
                        },
                ));
                let glow_mat = materials.add(ColorMaterial {
                    color: Color::rgba(0.4, 2.4, 2.8, 0.6),
                    ..default()
                });
                c.spawn(MaterialMesh2dBundle {
                    mesh: Mesh2dHandle(glow_mesh),
                    material: glow_mat,
                    transform: Transform::from_scale(Vec3::new(1.0, 1.0, 1.0)),
                    ..default()
                });
            });
            // partículas de muzzle flash
            emit_burst(
                &mut commands,
                &mut meshes,
                &mut materials,
                Vec2::new(t.translation.x, y),
                Color::rgb(0.6, 1.0, 1.0),
                10,
                80.0..180.0,
                0.02..0.06,
            );
            if !muted.0 {
                let level = (score.0 as f32).clamp(0.0, 3000.0);
                let end = 1000.0 + level * 0.2;
                audio.laser_sweep(500.0, end.min(2200.0));
            }
        } else {
            // míssil
            spawn_missile(
                &mut commands,
                &mut meshes,
                &mut materials,
                Vec2::new(t.translation.x, t.translation.y - 5.0),
                Vec2::new(0.0, 500.0),
                true,
            );
            if !muted.0 {
                let level = (score.0 as f32).clamp(0.0, 2000.0);
                let jitter: f32 = (rand::random::<f32>() - 0.5) * 0.1;
                audio.shoot_pitch(1.0 + level * 0.0003 + jitter);
            }
        }
    }

    // ataque especial (dir): pulso em círculo
    let can_special = cooldowns.special.finished();
    if actions.fire_special && can_special {
        if charge.value >= MAX_CHARGE {
            cooldowns.special = Timer::from_seconds(0.6, TimerMode::Once);
            charge.value = 0.0;
            for a in (0..628).step_by(6) {
                // 0..2pi em passos ~0.06 rad
                let ang = a as f32 / 100.0;
                let v = Vec2::new(ang.cos(), ang.sin()) * 600.0;
                spawn_missile(
                    &mut commands,
                    &mut meshes,
                    &mut materials,
                    Vec2::new(t.translation.x, t.translation.y),
                    v,
                    true,
                );
            }
            shake.intensity = 6.0;
            shake.frames = 50;
            if !muted.0 {
                audio.special();
            }
        } else if charge.value >= 150.0 {
            cooldowns.special = Timer::from_seconds(0.25, TimerMode::Once);
            charge.value -= 50.0;
            for a in (0..628).step_by(20) {
                let ang = a as f32 / 100.0;
                let v = Vec2::new(ang.cos(), ang.sin()) * 400.0;
                spawn_missile(
                    &mut commands,
                    &mut meshes,
                    &mut materials,
                    Vec2::new(t.translation.x, t.translation.y),
                    v,
                    true,
                );
            }
            if !muted.0 {
                audio.special();
            }
        }
    }
}
