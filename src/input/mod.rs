use bevy::prelude::*;
use bevy::window::PrimaryWindow;
use bevy::sprite::{MaterialMesh2dBundle, Mesh2dHandle};
use crate::core::{GamePhase, Muted};
use crate::gameplay::player::Player;

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

// Retículo temático para o cursor dentro do jogo
#[derive(Component)]
pub struct CursorReticle;

pub struct InputPlugin;
impl Plugin for InputPlugin {
    fn build(&self, app: &mut App) {
        app
            .init_resource::<CursorPos>()
            .init_resource::<InputActions>()
            .add_systems(Startup, spawn_cursor_reticle)
            .add_systems(Update, (
                update_cursor,
                update_cursor_reticle,
                map_mouse_to_actions,
                toggle_mute,
                pause_input,
            ));
    }
}

// Converte coordenadas de tela para mundo com base no tamanho atual da janela (corrige redimensionamento)
fn screen_to_world(p: Vec2, win_size: Vec2) -> Vec2 {
    // Origem da tela (0,0) no topo esquerdo; mundo Bevy com origem no centro
    Vec2::new(p.x - win_size.x / 2.0, win_size.y / 2.0 - p.y)
}

fn update_cursor(
    windows: Query<&Window, With<PrimaryWindow>>,
    q_cam: Query<&GlobalTransform, With<Camera>>,
    mut cursor: ResMut<CursorPos>,
) {
    if let Ok(window) = windows.get_single() {
        if let Some(p) = window.cursor_position() {
            cursor.screen = p;
            let win_size = Vec2::new(window.width(), window.height());
            let mut world = screen_to_world(p, win_size);
            if let Ok(cam_gt) = q_cam.get_single() {
                let cam_t = cam_gt.translation();
                world.x += cam_t.x;
                world.y += cam_t.y;
            }
            cursor.world = world;
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

fn spawn_cursor_reticle(
    mut commands: Commands,
    mut meshes: ResMut<Assets<bevy::render::mesh::Mesh>>, 
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    // Diamond discreto que combina com o tema (ciano)
    let mesh = meshes.add(crate::rendering::mesh_diamond());
    let mat = materials.add(ColorMaterial { color: Color::rgba(0.35, 0.85, 1.0, 0.0), ..default() });
    commands.spawn((
        MaterialMesh2dBundle {
            mesh: Mesh2dHandle(mesh),
            material: mat.clone(),
            transform: Transform::from_translation(Vec3::new(0.0, 0.0, 999.0))
                .with_scale(Vec3::splat(6.0)),
            ..default()
        },
        CursorReticle,
        Name::new("CursorReticle"),
    ));
}

fn update_cursor_reticle(
    cursor: Res<CursorPos>,
    q_player: Query<&GlobalTransform, With<Player>>, 
    mut q_reticle: Query<(&mut Transform, &Handle<ColorMaterial>), With<CursorReticle>>, 
    mut materials: ResMut<Assets<ColorMaterial>>, 
    mut windows: Query<&mut Window, With<PrimaryWindow>>,
) {
    // Atualiza posição do retículo no mundo
    if let Ok((mut t, mat_h)) = q_reticle.get_single_mut() {
        t.translation.x = cursor.world.x;
        t.translation.y = cursor.world.y;
        // Calcula distância até a nave do jogador
        let mut dist = 1000.0;
        if let Ok(p_gt) = q_player.get_single() {
            let p = p_gt.translation();
            let p2 = Vec2::new(p.x, p.y);
            dist = cursor.world.distance(p2);
        }
        // Opacidade: some próximo da nave, sutil longe
        let near_radius = 24.0; // ~tamanho da nave
        let mut alpha = if dist < near_radius { 0.0 } else { ((dist - near_radius) / 200.0).clamp(0.15, 0.45) };
        // Ajuste extra para não ser gritante
        alpha = alpha.min(0.40);
        if let Some(mat) = materials.get_mut(mat_h) {
            mat.color = Color::rgba(0.35, 0.85, 1.0, alpha);
        }
        // Oculta/mostra o cursor do sistema conforme proximidade
        if let Ok(mut window) = windows.get_single_mut() {
            window.cursor.visible = dist >= near_radius;
        }
    }
}

