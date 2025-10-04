use bevy::prelude::*;
use bevy::core_pipeline::bloom::BloomSettings;
use bevy::core_pipeline::tonemapping::Tonemapping;
use rand::random;

pub mod state;
pub mod resources;

pub use state::GamePhase;
pub use resources::{Score, FrameCounter, EnemyPopulation, Shake, Muted};

use crate::gameplay::player::Player;

pub struct CorePlugin;
impl Plugin for CorePlugin {
    fn build(&self, app: &mut App) {
        // Global clear color
        app.insert_resource(ClearColor(Color::BLACK));
        // Camera setup on startup
        app.add_systems(Startup, spawn_main_camera);
        // Game flow systems
        app.add_systems(
            Update,
            (
                track_frames,
                camera_shake,
                check_game_over,
            )
                .run_if(in_state(GamePhase::Running)),
        );
        app.add_systems(
            Update,
            restart_on_click.run_if(in_state(GamePhase::GameOver)),
        );
    }
}

fn spawn_main_camera(mut commands: Commands) {
    commands.spawn((
        Camera2dBundle {
            camera: Camera { hdr: true, ..default() },
            tonemapping: Tonemapping::Reinhard,
            ..default()
        },
        BloomSettings::NATURAL,
        Name::new("MainCamera"),
    ));
}

fn track_frames(mut frames: ResMut<FrameCounter>) {
    frames.0 = frames.0.wrapping_add(1);
}

fn camera_shake(mut q_cam: Query<&mut Transform, With<Camera>>, mut shake: ResMut<Shake>) {
    if let Ok(mut t) = q_cam.get_single_mut() {
        if shake.frames > 0 {
            t.translation.x = (random::<f32>() - 0.5) * shake.intensity;
            t.translation.y = (random::<f32>() - 0.5) * shake.intensity;
            shake.frames -= 1;
        } else {
            t.translation.x = 0.0;
            t.translation.y = 0.0;
        }
    }
}

fn check_game_over(
    mut next_state: ResMut<NextState<GamePhase>>,
    q_player: Query<(), With<Player>>,
    mut local_timer: Local<Option<Timer>>,
    time: Res<Time>,
) {
    // quando player não existe mais, inicia um delay (~1.5s) e então GameOver
    if q_player.get_single().is_err() {
        if local_timer.is_none() {
            *local_timer = Some(Timer::from_seconds(1.5, TimerMode::Once));
        }
    }
    if let Some(timer) = local_timer.as_mut() {
        timer.tick(time.delta());
        if timer.finished() {
            next_state.set(GamePhase::GameOver);
            *local_timer = None;
        }
    }
}

fn restart_on_click(
    mouse: Res<ButtonInput<MouseButton>>,
    mut next_state: ResMut<NextState<GamePhase>>,
    mut commands: Commands,
    q_entities: Query<Entity>,
) {
    if mouse.just_pressed(MouseButton::Left) {
        // Despawn all entities except camera
        for e in q_entities.iter() {
            // TODO: Better filtering to preserve camera and persistent entities
            if let Some(ecmd) = commands.get_entity(e) {
                ecmd.despawn_recursive();
            }
        }
        // Transition back to running
        // Note: Setup will need to be called again, but we need a better restart mechanism
        next_state.set(GamePhase::Running);
    }
}
