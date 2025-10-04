use bevy::prelude::*;
use bevy::window::PrimaryWindow;
use crate::constants::{SCREEN_HEIGHT, SCREEN_WIDTH};
use crate::core::{GamePhase, Muted};

#[derive(Resource, Default)]
pub struct CursorPos {
    // coordenadas de tela (0..W, 0..H com origem no canto superior esquerdo)
    pub screen: Vec2,
    // mundo 2D Bevy (origem no centro)
    pub world: Vec2,
}

fn pause_input(mut next_state: ResMut<NextState<GamePhase>>, kb: Res<ButtonInput<KeyCode>>, state: Res<State<GamePhase>>) {
    if kb.just_pressed(KeyCode::KeyP) {
        match state.get() {
            GamePhase::Running => next_state.set(GamePhase::Paused),
            GamePhase::Paused => next_state.set(GamePhase::Running),
            GamePhase::GameOver => {},
        }
    }
}

fn toggle_mute(kb: Res<ButtonInput<KeyCode>>, mut muted: ResMut<Muted>) {
    if kb.just_pressed(KeyCode::KeyM) { muted.0 = !muted.0; }
}

#[derive(Resource, Default, Debug, Clone, Copy)]
pub struct InputActions {
    pub fire_primary: bool,
    pub fire_special: bool,
}

pub struct InputPlugin;
impl Plugin for InputPlugin {
    fn build(&self, app: &mut App) {
        app
            .init_resource::<CursorPos>()
            .init_resource::<InputActions>()
            .add_systems(Update, (
                update_cursor,
                map_mouse_to_actions,
                toggle_mute,
                pause_input,
            ));
    }
}

fn screen_to_world(p: Vec2) -> Vec2 {
    // JS tinha (0,0) no canto superior esquerdo; mundo Bevy tem (0,0) no centro
    Vec2::new(p.x - SCREEN_WIDTH / 2.0, SCREEN_HEIGHT / 2.0 - p.y)
}

fn update_cursor(
    windows: Query<&Window, With<PrimaryWindow>>,
    mut cursor: ResMut<CursorPos>,
) {
    if let Ok(window) = windows.get_single() {
        if let Some(p) = window.cursor_position() {
            cursor.screen = p;
            cursor.world = screen_to_world(p);
        }
    }
}

fn map_mouse_to_actions(
    mut actions: ResMut<InputActions>,
    mouse: Res<ButtonInput<MouseButton>>,
) {
    actions.fire_primary = mouse.pressed(MouseButton::Left);
    actions.fire_special = mouse.pressed(MouseButton::Right);
}

