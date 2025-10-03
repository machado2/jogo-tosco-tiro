use bevy::prelude::*;
use bevy::sprite::{MaterialMesh2dBundle, Mesh2dHandle};
use bevy::window::PrimaryWindow;
use bevy::render::mesh::{Indices, Mesh, PrimitiveTopology};
use bevy::render::render_asset::RenderAssetUsages;
use bevy::math::primitives::Rectangle;
use bevy::core_pipeline::bloom::BloomSettings;
use bevy::core_pipeline::tonemapping::Tonemapping;
use bevy_egui::{egui, EguiContexts, EguiPlugin};
use rand::prelude::*;
use rand::rngs::StdRng;
use rand::SeedableRng;
use std::sync::mpsc::{self, Sender};
use std::thread;

// ====== Config (próximo do original) ======
const SCREEN_WIDTH: f32 = 640.0;
const SCREEN_HEIGHT: f32 = 480.0;
const MAX_HEALTH: i32 = 100;
const MAX_CHARGE: f32 = 1000.0;
const CHARGE_REFILL_PER_SEC: f32 = 18.0; // ~0.3 por frame a 60fps
const ENEMY_HEALTH: i32 = 5;
const POINTS_ENEMY: i32 = 5;
const POINTS_METEOR: i32 = 1;
const POINTS_SPECIAL: i32 = 20; // aproximando Metralha/Transport

const SIZE_PLAYER: Vec2 = Vec2::new(16.0, 16.0);
const SIZE_ENEMY: Vec2 = Vec2::new(16.0, 16.0);
const SIZE_METEOR: Vec2 = Vec2::new(5.0, 5.0);
const SIZE_LASER: Vec2 = Vec2::new(2.0, 50.0);
const SIZE_MISSILE: Vec2 = Vec2::new(4.0, 4.0);

// ====== Game state ======
#[derive(States, Debug, Clone, Copy, Eq, PartialEq, Hash, Default)]
enum GamePhase {
    #[default]
    Running,
    Paused,
    GameOver,
}

#[derive(Resource, Default)]
struct Score(i32);

#[derive(Resource, Default)]
struct FrameCounter(u64);

#[derive(Resource, Default)]
struct EnemyPopulation(u32);

#[derive(Resource, Default)]
struct CursorPos {
    // coordenadas de tela (0..W, 0..H com origem no canto superior esquerdo)
    screen: Vec2,
    // mundo 2D Bevy (origem no centro)
    world: Vec2,
}

#[derive(Resource, Default)]
struct Shake {
    frames: i32,
    intensity: f32,
}

#[derive(Resource, Default)]
struct Muted(bool);

// ====== Components ======
#[derive(Component)]
struct Player;

// ====== Procedural audio engine (rodio) ======
#[derive(Resource, Clone)]
struct AudioEngine {
    tx: Sender<AudioMsg>,
}

enum AudioMsg {
    Play { data: Vec<f32>, sample_rate: u32 },
}

impl AudioEngine {
    fn new() -> Self {
        let (tx, rx) = mpsc::channel::<AudioMsg>();
        thread::spawn(move || {
            // Rodio must live on this thread
            let (_stream, handle) = match rodio::OutputStream::try_default() {
                Ok(v) => v,
                Err(_) => return, // no device
            };
            while let Ok(msg) = rx.recv() {
                match msg {
                    AudioMsg::Play { data, sample_rate } => {
                        if let Ok(sink) = rodio::Sink::try_new(&handle) {
                            let buf = rodio::buffer::SamplesBuffer::new(2, sample_rate, interleave_stereo(data));
                            sink.append(buf);
                            sink.detach();
                        }
                    }
                }
            }
        });
        Self { tx }
    }

    fn play_buffer(&self, data: Vec<f32>, sample_rate: u32) {
        let _ = self.tx.send(AudioMsg::Play { data, sample_rate });
    }

    fn shoot_pitch(&self, pitch: f32) { let sr = 44100; let data = synth_beep(sr, 0.08, 800.0 * pitch, 0.25, Wave::Square, Some(60.0)); self.play_buffer(data, sr); }
    fn laser_sweep(&self, start: f32, end: f32) { let sr = 44100; let data = synth_gliss(sr, 0.18, start, end, 0.22, Wave::Sine); self.play_buffer(data, sr); }
    fn special(&self) {
        let sr = 44100;
        let mut mix = vec![0.0; (sr as f32 * 0.35) as usize];
        let tones = [220.0, 330.0, 440.0, 660.0];
        for (i, f) in tones.iter().enumerate() {
            let d = synth_beep(sr, 0.35, *f, 0.18 / (i as f32 + 1.0), Wave::Sine, Some(4.0));
            mix_inplace(&mut mix, &d);
        }
        self.play_buffer(mix, sr);
    }
    fn explosion(&self) { let sr = 44100; let data = synth_noise(sr, 0.25, 0.28, Some(8.0)); self.play_buffer(data, sr); }
    fn hit(&self) { let sr = 44100; let data = synth_noise(sr, 0.07, 0.2, Some(20.0)); self.play_buffer(data, sr); }
}

#[derive(Clone, Copy)]
enum Wave { Sine, Square }

fn synth_beep(sr: u32, dur: f32, freq: f32, vol: f32, wave: Wave, decay: Option<f32>) -> Vec<f32> {
    let n = (sr as f32 * dur) as usize;
    let mut out = vec![0.0; n];
    for i in 0..n {
        let t = i as f32 / sr as f32;
        let env = decay.map(|d| (-d * t).exp()).unwrap_or(1.0);
        let x = 2.0 * std::f32::consts::PI * freq * t;
        let s = match wave { Wave::Sine => x.sin(), Wave::Square => if x.sin() >= 0.0 { 1.0 } else { -1.0 } };
        out[i] = s * vol * env;
    }
    out
}

fn synth_gliss(sr: u32, dur: f32, f_start: f32, f_end: f32, vol: f32, wave: Wave) -> Vec<f32> {
    let n = (sr as f32 * dur) as usize;
    let mut out = vec![0.0; n];
    for i in 0..n {
        let t = i as f32 / sr as f32;
        let f = f_start + (f_end - f_start) * t;
        let x = 2.0 * std::f32::consts::PI * f * t;
        let s = match wave { Wave::Sine => x.sin(), Wave::Square => if x.sin() >= 0.0 { 1.0 } else { -1.0 } };
        out[i] = s * vol * (1.0 - t);
    }
    out
}

fn synth_noise(sr: u32, dur: f32, vol: f32, decay: Option<f32>) -> Vec<f32> {
    let n = (sr as f32 * dur) as usize;
    let mut out = vec![0.0; n];
    let mut rng = rand::thread_rng();
    for i in 0..n {
        let t = i as f32 / sr as f32;
        let env = decay.map(|d| (-d * t).exp()).unwrap_or(1.0);
        let s: f32 = rng.gen::<f32>() * 2.0 - 1.0; // -1..1
        out[i] = s * vol * env;
    }
    out
}

fn interleave_stereo(mono: Vec<f32>) -> Vec<f32> {
    let mut out = Vec::with_capacity(mono.len() * 2);
    for &s in &mono { out.push(s); out.push(s); }
    out
}

fn mix_inplace(dst: &mut [f32], src: &[f32]) {
    let n = dst.len().min(src.len());
    for i in 0..n { dst[i] = (dst[i] + src[i]).clamp(-1.0, 1.0); }
}

#[derive(Component)]
struct Enemy {
    movement: u8,
    distance: i32,
    phase: f32,
    speed: f32,
    shoot_time: i32,
    kind: EnemyKind,
}

#[derive(Clone, Copy)]
enum EnemyKind {
    Basic,
    Meteor,
    Special,
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum EnemyType {
    Scout,
    Heavy,
    Bomber,
    Drone,
}

#[derive(Clone)]
struct WaveConfig {
    scout_count: u32,
    heavy_count: u32,
    bomber_count: u32,
    drone_count: u32,
    spawn_interval: f32,
    score_threshold: i32,
}

#[derive(Resource)]
struct WaveManager {
    current_wave: usize,
    enemies_remaining: u32,
    wave_timer: f32,
    wave_configs: Vec<WaveConfig>,
    enemies_spawned_this_wave: u32,
}

#[derive(Component)]
struct Bullet {
    friendly: bool,
    damage: i32,
    laser: bool,
}

#[derive(Component, Deref, DerefMut)]
struct Velocity(Vec2);

#[derive(Component)]
struct Collider {
    w: f32,
    h: f32,
}

#[derive(Component)]
struct Health {
    hp: i32,
    max: i32,
}

#[derive(Component)]
struct Charge {
    value: f32,
    max: f32,
}


#[derive(Component)]
struct EngineFlame { timer: Timer }

#[derive(Component)]
struct Particle2D {
    vel: Vec2,
    life: f32,
    total: f32,
    start: Color,
    end: Color,
    spin: f32,
}

#[derive(Component)]
struct ToDespawn;

#[derive(Component)]
struct TrailTimer(Timer);

#[derive(Component)]
struct Star { speed: f32 }

#[derive(Component)]
struct Lifetime { timer: Timer }

#[derive(Component)]
struct LaserFollowPlayer; // laser "ancorado" no X do player

// ====== Helpers ======
fn screen_to_world(p: Vec2) -> Vec2 {
    // JS tinha (0,0) no canto superior esquerdo; mundo Bevy tem (0,0) no centro
    Vec2::new(p.x - SCREEN_WIDTH / 2.0, SCREEN_HEIGHT / 2.0 - p.y)
}

fn clamp_to_screen(mut pos: Vec3, size: Vec2) -> Vec3 {
    let half_w = size.x / 2.0;
    let half_h = size.y / 2.0;
    pos.x = pos.x.clamp(-SCREEN_WIDTH / 2.0 + half_w, SCREEN_WIDTH / 2.0 - half_w);
    pos.y = pos.y.clamp(-SCREEN_HEIGHT / 2.0 + half_h, SCREEN_HEIGHT / 2.0 - half_h);
    pos
}



// ====== Procedural meshes ======
fn mesh_triangle() -> bevy::render::mesh::Mesh {
    let mut mesh = Mesh::new(PrimitiveTopology::TriangleList, RenderAssetUsages::RENDER_WORLD);
    let positions = vec![
        // tri apontado pra cima em espaço unitário
        [0.0, 0.5, 0.0],
        [-0.5, -0.5, 0.0],
        [0.5, -0.5, 0.0],
    ];
    let normals = vec![[0.0, 0.0, 1.0]; 3];
    let uvs = vec![[0.5, 1.0], [0.0, 0.0], [1.0, 0.0]];
    let indices = Indices::U32(vec![0, 1, 2]);
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions);
    mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, normals);
    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uvs);
    mesh.insert_indices(indices);
    mesh
}

fn mesh_diamond() -> bevy::render::mesh::Mesh {
    let mut mesh = Mesh::new(PrimitiveTopology::TriangleList, RenderAssetUsages::RENDER_WORLD);
    // losango em 2 triângulos
    let positions = vec![
        [0.0, 0.6, 0.0],  // 0 topo
        [-0.4, 0.0, 0.0], // 1 esquerda
        [0.0, -0.6, 0.0], // 2 baixo
        [0.4, 0.0, 0.0],  // 3 direita
    ];
    let normals = vec![[0.0, 0.0, 1.0]; 4];
    let uvs = vec![[0.5, 1.0], [0.0, 0.5], [0.5, 0.0], [1.0, 0.5]];
    let indices = Indices::U32(vec![0, 1, 3, 1, 2, 3]);
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions);
    mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, normals);
    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uvs);
    mesh.insert_indices(indices);
    mesh
}

fn mesh_arrow() -> bevy::render::mesh::Mesh {
    let mut mesh = Mesh::new(PrimitiveTopology::TriangleList, RenderAssetUsages::RENDER_WORLD);
    // flecha simples (cabeça triangular + corpo retangular simplificado por 2 triângulos)
    let positions = vec![
        // cabeça
        [0.0, 0.6, 0.0],   // 0 topo
        [-0.4, 0.1, 0.0],  // 1 esq
        [0.4, 0.1, 0.0],   // 2 dir
        // corpo (retângulo de -0.15..0.15 x -0.6..0.1)
        [-0.15, 0.1, 0.0], // 3
        [0.15, 0.1, 0.0],  // 4
        [-0.15, -0.6, 0.0],// 5
        [0.15, -0.6, 0.0], // 6
    ];
    let normals = vec![[0.0, 0.0, 1.0]; 7];
    let uvs = vec![
        [0.5, 1.0], [0.0, 0.6], [1.0, 0.6],
        [0.4, 0.6], [0.6, 0.6], [0.4, 0.0], [0.6, 0.0],
    ];
    let indices = Indices::U32(vec![
        0,1,2, // cabeça
        3,5,4, // corpo tri 1
        5,6,4, // corpo tri 2
    ]);
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions);
    mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, normals);
    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uvs);
    mesh.insert_indices(indices);
    mesh
}

fn mesh_hexagon() -> bevy::render::mesh::Mesh {
    use std::f32::consts::PI;
    let mut mesh = Mesh::new(PrimitiveTopology::TriangleList, RenderAssetUsages::RENDER_WORLD);
    // hexágono regular de raio 0.5
    let mut positions: Vec<[f32;3]> = Vec::new();
    let mut uvs: Vec<[f32;2]> = Vec::new();
    let normals: Vec<[f32;3]> = vec![[0.0, 0.0, 1.0]; 7];
    positions.push([0.0, 0.0, 0.0]); uvs.push([0.5,0.5]); // centro
    for i in 0..6 {
        let a = i as f32 * PI / 3.0;
        positions.push([0.5*a.cos(), 0.5*a.sin(), 0.0]);
        uvs.push([0.5 + 0.5*a.cos(), 0.5 + 0.5*a.sin()]);
    }
    let mut idx: Vec<u32> = Vec::new();
    for i in 1..=6 {
        let next = if i==6 {1} else {i+1};
        idx.extend_from_slice(&[0, i as u32, next as u32]);
    }
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions);
    mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, normals);
    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uvs);
    mesh.insert_indices(Indices::U32(idx));
    mesh
}

struct ShipBounds { width_units: f32, height_units: f32 }

fn spawn_ship_visual(
    parent: &mut ChildBuilder,
    meshes: &mut Assets<bevy::render::mesh::Mesh>,
    materials: &mut Assets<ColorMaterial>,
    size: Vec2,
    seed: u32,
    base_color: Color,
) -> ShipBounds {
    let mut rng = StdRng::seed_from_u64(seed as u64);
let choice: u8 = rng.gen_range(0..4);
    let mesh = match choice {
        0 => mesh_triangle(),
        1 => mesh_diamond(),
        2 => mesh_arrow(),
        _ => mesh_hexagon(),
    };
    // Grupo raiz que será escalado ao tamanho alvo
    let mut root = parent.spawn((SpatialBundle { transform: Transform::from_scale(Vec3::new(size.x, size.y, 1.0)), ..default() }, Name::new("ship_root")));
    // bounds em unidades locais
let mut width_units_base: f32 = match choice { 0 => 1.0, 1 => 0.8, 2 => 0.8, 3 => 1.0, _ => 1.0 };
    let height_units_base = 1.2;
    let mut max_wing_w = 0.0f32;
    root.with_children(|g| {
        // Hull central (cor base)
        let hull_mat = materials.add(ColorMaterial { color: base_color, ..default() });
        let mesh_h = meshes.add(mesh);
        g.spawn(MaterialMesh2dBundle {
            mesh: Mesh2dHandle(mesh_h),
            material: hull_mat,
            transform: Transform::default(),
            ..default()
        });
        // Asas segmentadas simétricas para variedade
        let mut rng = StdRng::seed_from_u64((seed as u64) ^ 0xA5A5_A5A5);
        let wing_mat = materials.add(ColorMaterial { color: base_color * 0.8, ..default() });
        for i in 0..4 {
            let y = 0.15 - 0.1 * i as f32; // posições ao longo do corpo
            let w = 0.15 + rng.gen_range(0.05..0.18) * (1.0 - i as f32 * 0.18);
            max_wing_w = max_wing_w.max(w);
            let h = 0.05 + rng.gen_range(0.02..0.06);
            let wing = meshes.add(Mesh::from(Rectangle { half_size: Vec2::new(w, h), ..Default::default() }));
            // esquerda
            g.spawn(MaterialMesh2dBundle {
                mesh: Mesh2dHandle(wing.clone()),
                material: wing_mat.clone(),
                transform: Transform::from_translation(Vec3::new(-0.25 - w, y, 0.0)),
                ..default()
            });
            // direita
            g.spawn(MaterialMesh2dBundle {
                mesh: Mesh2dHandle(wing.clone()),
                material: wing_mat.clone(),
                transform: Transform::from_translation(Vec3::new(0.25 + w, y, 0.0)),
                ..default()
            });
        }
        // Cockpit brilhante (glow)
        let cockpit = meshes.add(Mesh::from(Rectangle { half_size: Vec2::new(0.07, 0.06), ..Default::default() }));
        let cockpit_mat = materials.add(ColorMaterial { color: Color::rgba(0.6, 1.6, 2.0, 1.0), ..default() });
        g.spawn(MaterialMesh2dBundle {
            mesh: Mesh2dHandle(cockpit),
            material: cockpit_mat,
            transform: Transform::from_translation(Vec3::new(0.0, 0.12, 0.1)),
            ..default()
        });
        // Listras/acento (glow fraco) + pequena antena
        let stripe = meshes.add(Mesh::from(Rectangle { half_size: Vec2::new(0.4, 0.01), ..Default::default() }));
        let stripe_mat = materials.add(ColorMaterial { color: Color::rgba(2.0, 1.4, 0.5, 0.6), ..default() });
        g.spawn(MaterialMesh2dBundle {
            mesh: Mesh2dHandle(stripe),
            material: stripe_mat,
            transform: Transform::from_translation(Vec3::new(0.0, -0.05, 0.05)),
            ..default()
        });
        let antenna = meshes.add(Mesh::from(Rectangle { half_size: Vec2::new(0.01, 0.08), ..Default::default() }));
        let antenna_mat = materials.add(ColorMaterial { color: base_color * 1.2, ..default() });
        g.spawn(MaterialMesh2dBundle {
            mesh: Mesh2dHandle(antenna),
            material: antenna_mat,
            transform: Transform::from_translation(Vec3::new(0.0, 0.3, 0.02)),
            ..default()
        });
    });
    let wings_width_units = 0.5 + 4.0 * max_wing_w;
    let width_units = width_units_base.max(wings_width_units);
    ShipBounds { width_units, height_units: height_units_base }
}

fn spawn_engine_glow(
    parent: &mut ChildBuilder,
    meshes: &mut Assets<bevy::render::mesh::Mesh>,
    materials: &mut Assets<ColorMaterial>,
    width: f32,
) {
use bevy::render::mesh::Mesh;
    let mesh = Mesh::from(Rectangle { half_size: Vec2::new(0.5, 0.15), ..Default::default() });
    let mesh_h = meshes.add(mesh);
let mat_h = materials.add(ColorMaterial { color: Color::rgba(1.8, 0.9, 0.4, 0.9), ..default() });
    parent.spawn((
        MaterialMesh2dBundle {
            mesh: Mesh2dHandle(mesh_h),
            material: mat_h,
            transform: Transform::from_translation(Vec3::new(0.0, -0.6 * (SIZE_PLAYER.y / 2.0), 0.0))
                .with_scale(Vec3::new(width, width, 1.0)),
            ..default()
        },
        EngineFlame { timer: Timer::from_seconds(0.12, TimerMode::Repeating) },
    ));
}

// ====== Setup ======
fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<bevy::render::mesh::Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    // câmera 2D com HDR + Bloom para efeitos de glow
    commands.spawn((
        Camera2dBundle {
            camera: Camera { hdr: true, ..default() },
            tonemapping: Tonemapping::Reinhard,
            ..default()
        },
        BloomSettings::NATURAL,
    ));

    // Vignette simples por bordas
    let edge_thickness = 40.0;
    let z_vignette = 99.0;
    let top = meshes.add(Mesh::from(Rectangle { half_size: Vec2::splat(0.5), ..Default::default() }));
    let mat_v = materials.add(ColorMaterial { color: Color::rgba(0.0, 0.0, 0.0, 0.18), ..default() });
    // Top
    commands.spawn(MaterialMesh2dBundle {
        mesh: Mesh2dHandle(top.clone()),
        material: mat_v.clone(),
        transform: Transform::from_translation(Vec3::new(0.0, SCREEN_HEIGHT / 2.0 - edge_thickness / 2.0, z_vignette))
            .with_scale(Vec3::new(SCREEN_WIDTH, edge_thickness, 1.0)),
        ..default()
    });
    // Bottom
    commands.spawn(MaterialMesh2dBundle {
        mesh: Mesh2dHandle(top.clone()),
        material: mat_v.clone(),
        transform: Transform::from_translation(Vec3::new(0.0, -SCREEN_HEIGHT / 2.0 + edge_thickness / 2.0, z_vignette))
            .with_scale(Vec3::new(SCREEN_WIDTH, edge_thickness, 1.0)),
        ..default()
    });
    // Left
    commands.spawn(MaterialMesh2dBundle {
        mesh: Mesh2dHandle(top.clone()),
        material: mat_v.clone(),
        transform: Transform::from_translation(Vec3::new(-SCREEN_WIDTH / 2.0 + edge_thickness / 2.0, 0.0, z_vignette))
            .with_scale(Vec3::new(edge_thickness, SCREEN_HEIGHT, 1.0)),
        ..default()
    });
    // Right
    commands.spawn(MaterialMesh2dBundle {
        mesh: Mesh2dHandle(top),
        material: mat_v,
        transform: Transform::from_translation(Vec3::new(SCREEN_WIDTH / 2.0 - edge_thickness / 2.0, 0.0, z_vignette))
            .with_scale(Vec3::new(edge_thickness, SCREEN_HEIGHT, 1.0)),
        ..default()
    });

    // fundo preto
    commands.insert_resource(ClearColor(Color::BLACK));

    // recursos iniciais
    commands.insert_resource(Score(0));
    commands.insert_resource(FrameCounter(0));
    commands.insert_resource(EnemyPopulation(0));
    commands.insert_resource(CursorPos::default());
    commands.insert_resource(Shake::default());
    commands.insert_resource(Muted(false));
    commands.insert_resource(AudioEngine::new());
    
    // wave manager com configurações de ondas
    let wave_configs = vec![
        WaveConfig { scout_count: 3, heavy_count: 0, bomber_count: 0, drone_count: 0, spawn_interval: 2.0, score_threshold: 0 },
        WaveConfig { scout_count: 5, heavy_count: 1, bomber_count: 0, drone_count: 0, spawn_interval: 1.8, score_threshold: 50 },
        WaveConfig { scout_count: 4, heavy_count: 2, bomber_count: 1, drone_count: 0, spawn_interval: 1.5, score_threshold: 150 },
        WaveConfig { scout_count: 6, heavy_count: 2, bomber_count: 2, drone_count: 1, spawn_interval: 1.3, score_threshold: 300 },
        WaveConfig { scout_count: 8, heavy_count: 3, bomber_count: 2, drone_count: 2, spawn_interval: 1.0, score_threshold: 500 },
        WaveConfig { scout_count: 10, heavy_count: 4, bomber_count: 3, drone_count: 3, spawn_interval: 0.8, score_threshold: 750 },
        WaveConfig { scout_count: 12, heavy_count: 5, bomber_count: 4, drone_count: 4, spawn_interval: 0.6, score_threshold: 1000 },
    ];
    commands.insert_resource(WaveManager {
        current_wave: 0,
        enemies_remaining: 0,
        wave_timer: 0.0,
        wave_configs,
        enemies_spawned_this_wave: 0,
    });

    // starfield
    let mut rng = StdRng::seed_from_u64(42);
    let _base_mat = materials.add(Color::WHITE);
let base_mesh = meshes.add(Mesh::from(Rectangle { half_size: Vec2::splat(0.5), ..Default::default() }));
    for i in 0..180 {
        let use_blue = i % 6 == 0;
        let color = if use_blue { Color::rgb(0.6, 0.7, 1.0) } else { Color::WHITE };
        let mat = materials.add(color);
        let speed = rng.gen_range(0.15..0.5);
        commands.spawn((
            MaterialMesh2dBundle {
                mesh: Mesh2dHandle(base_mesh.clone()),
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

    // player
    let player_pos = Vec3::new(0.0, -160.0, 10.0);
    let mut player_entity = commands.spawn((
        SpatialBundle { transform: Transform::from_translation(player_pos), ..default() },
        Player,
        // placeholder collider; ajustaremos após construir a nave
        Collider { w: SIZE_PLAYER.x, h: SIZE_PLAYER.y },
        Health { hp: MAX_HEALTH, max: MAX_HEALTH },
        Charge { value: MAX_CHARGE, max: MAX_CHARGE },
        Name::new("Player"),
    ));
    // construir nave e obter bounds
    let mut ship_bounds: Option<ShipBounds> = None;
    let pid = player_entity.id();
    player_entity.with_children(|c| {
        let b = spawn_ship_visual(c, &mut meshes, &mut materials, SIZE_PLAYER, 12345, Color::rgb(0.2, 0.5, 0.9));
        ship_bounds = Some(b);
        spawn_engine_glow(c, &mut meshes, &mut materials, 0.8);
    });
    drop(player_entity);
    if let Some(b) = ship_bounds { if let Some(mut ecmd) = commands.get_entity(pid) { ecmd.insert(Collider { w: b.width_units * SIZE_PLAYER.x, h: b.height_units * SIZE_PLAYER.y }); } }
}

// ====== Systems ======
fn track_frames(mut frames: ResMut<FrameCounter>) {
    frames.0 = frames.0.wrapping_add(1);
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

fn starfield_update(mut q: Query<(&mut Transform, &Star)>) {
    let bottom = -SCREEN_HEIGHT / 2.0;
    let top = SCREEN_HEIGHT / 2.0;
    for (mut t, s) in &mut q {
        t.translation.y -= s.speed;
        if t.translation.y < bottom {
            t.translation.y = top;
            t.translation.x = thread_rng().gen_range(-SCREEN_WIDTH / 2.0..SCREEN_WIDTH / 2.0);
        }
    }
}

fn player_control(
    time: Res<Time>,
    cursor: Res<CursorPos>,
    mouse: Res<ButtonInput<MouseButton>>,
    mut commands: Commands,
    mut q_player: Query<(&mut Transform, &mut Health, &mut Charge, &Collider), With<Player>>,
    mut meshes: ResMut<Assets<bevy::render::mesh::Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
    score: Res<Score>,
    mut shake: ResMut<Shake>,
    audio: Res<AudioEngine>,
    muted: Res<Muted>,
) {
    let Ok((mut t, mut hp, mut charge, col)) = q_player.get_single_mut() else { return; };

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

    // dentro da tela
    t.translation = clamp_to_screen(t.translation, Vec2::new(col.w, col.h));

    // recarga & auto-heal leve quando cheio
    charge.value = (charge.value + CHARGE_REFILL_PER_SEC * time.delta_seconds()).min(charge.max);
    if charge.value >= charge.max && hp.hp < hp.max {
        // ~0.06 HP/s
        hp.hp = (hp.hp + (time.delta_seconds() * 3.6) as i32).min(hp.max);
    }

    // ataque primário (esq): míssil ou laser (>=500 pontos)
    static mut SHOOT_COOL: f32 = 0.0; // simples cooldown global
    unsafe { SHOOT_COOL = (SHOOT_COOL - time.delta_seconds()).max(0.0); }
    let can_shoot = unsafe { SHOOT_COOL <= 0.0 };
    if mouse.pressed(MouseButton::Left) && can_shoot && charge.value >= 1.0 {
        unsafe { SHOOT_COOL = 0.08; }
        charge.value -= 1.0;
        if score.0 >= 500 {
            // laser
            let laser_color = Color::rgb(0.0, 1.0, 1.0);
let mesh = Mesh::from(Rectangle { half_size: Vec2::splat(0.5), ..Default::default() });
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
                Bullet { friendly: true, damage: 2, laser: true },
                Collider { w: SIZE_LASER.x, h: SIZE_LASER.y },
                Velocity(Vec2::new(0.0, 0.0)),
                LaserFollowPlayer,
                Lifetime { timer: Timer::from_seconds(0.8, TimerMode::Once) },
                Name::new("Laser"),
            ));
            // aura glow como filho
            laser_e.with_children(|c| {
                let glow_mesh = meshes.add(Mesh::from(Rectangle { half_size: Vec2::new(1.0, 6.0), ..Default::default() }));
let glow_mat = materials.add(ColorMaterial { color: Color::rgba(0.4, 2.4, 2.8, 0.6), ..default() });
                c.spawn(MaterialMesh2dBundle {
                    mesh: Mesh2dHandle(glow_mesh),
                    material: glow_mat,
                    transform: Transform::from_scale(Vec3::new(1.0, 1.0, 1.0)),
                    ..default()
                });
            });
            // partículas de muzzle flash
            emit_burst(&mut commands, &mut meshes, &mut materials, Vec2::new(t.translation.x, y), Color::rgb(0.6, 1.0, 1.0), 10, 80.0..180.0, 0.02..0.06);
            if !muted.0 { let level = (score.0 as f32).clamp(0.0, 3000.0); let end = 1000.0 + level * 0.2; audio.laser_sweep(500.0, end.min(2200.0)); }
        } else {
            // míssil
            spawn_missile(&mut commands, &mut meshes, &mut materials, Vec2::new(t.translation.x, t.translation.y - 5.0), Vec2::new(0.0, 500.0), true);
            if !muted.0 { let level = (score.0 as f32).clamp(0.0, 2000.0); let jitter: f32 = (rand::random::<f32>() - 0.5) * 0.1; audio.shoot_pitch(1.0 + level * 0.0003 + jitter); }
        }
    }

    // ataque especial (dir): pulso em círculo
    static mut SPECIAL_COOL: f32 = 0.0;
    unsafe { SPECIAL_COOL = (SPECIAL_COOL - time.delta_seconds()).max(0.0); }
    if mouse.pressed(MouseButton::Right) && unsafe { SPECIAL_COOL <= 0.0 } {
        if charge.value >= MAX_CHARGE {
            unsafe { SPECIAL_COOL = 0.6; }
            charge.value = 0.0;
            for a in (0..628).step_by(6) { // 0..2pi em passos ~0.06 rad
                let ang = a as f32 / 100.0;
                let v = Vec2::new(ang.cos(), ang.sin()) * 600.0;
                spawn_missile(&mut commands, &mut meshes, &mut materials, Vec2::new(t.translation.x, t.translation.y), v, true);
            }
            shake.intensity = 6.0;
            shake.frames = 50;
            if !muted.0 { audio.special(); }
        } else if charge.value >= 150.0 {
            unsafe { SPECIAL_COOL = 0.25; }
            charge.value -= 50.0;
            for a in (0..628).step_by(20) {
                let ang = a as f32 / 100.0;
                let v = Vec2::new(ang.cos(), ang.sin()) * 400.0;
                spawn_missile(&mut commands, &mut meshes, &mut materials, Vec2::new(t.translation.x, t.translation.y), v, true);
            }
            if !muted.0 { audio.special(); }
        }
    }
}

fn spawn_missile(
    commands: &mut Commands,
    meshes: &mut Assets<bevy::render::mesh::Mesh>,
    materials: &mut Assets<ColorMaterial>,
    pos: Vec2,
    vel: Vec2,
    friendly: bool,
) {
    use bevy::render::mesh::Mesh;
    let mesh = Mesh::from(Rectangle { half_size: Vec2::splat(0.5), ..Default::default() });
    let mesh_h = meshes.add(mesh);
    let color = if friendly { Color::rgb(0.9, 0.9, 0.9) } else { Color::rgb(1.0, 0.4, 0.4) };
    let mat_h = materials.add(ColorMaterial { color, ..default() });
    let mut e = commands.spawn((
        MaterialMesh2dBundle {
            mesh: Mesh2dHandle(mesh_h),
            material: mat_h,
            transform: Transform::from_translation(Vec3::new(pos.x, pos.y, 4.0))
                .with_scale(Vec3::new(SIZE_MISSILE.x, SIZE_MISSILE.y, 1.0)),
            ..default()
        },
        Bullet { friendly, damage: 1, laser: false },
        Collider { w: SIZE_MISSILE.x, h: SIZE_MISSILE.y },
        Velocity(Vec2::new(vel.x, vel.y)),
        TrailTimer(Timer::from_seconds(0.045, TimerMode::Repeating)),
        Name::new(if friendly { "Missile(F)" } else { "Missile(E)" }),
    ));
    // halo glow como filho
    e.with_children(|c| {
        let gmesh = meshes.add(Mesh::from(Rectangle { half_size: Vec2::splat(1.0), ..Default::default() }));
let gmat = materials.add(ColorMaterial { color: Color::rgba(1.8, 1.2, 0.6, 0.7), ..default() });
        c.spawn(MaterialMesh2dBundle {
            mesh: Mesh2dHandle(gmesh),
            material: gmat,
            transform: Transform::from_scale(Vec3::new(1.2, 1.2, 1.0)),
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
    mut q: Query<(Entity, &mut Transform, &Velocity, &Bullet, Option<&mut TrailTimer>)>,
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
                    let c = if b.friendly { Color::rgb(1.0, 1.0, 1.0) } else { Color::rgb(1.0, 0.3, 0.3) };
                    emit_burst(&mut commands, &mut meshes, &mut materials, Vec2::new(t.translation.x, t.translation.y), c, 1, 30.0..90.0, 0.008..0.02);
                }
            }
        }
        if t.translation.x < -SCREEN_WIDTH/2.0 - 10.0 || t.translation.x > SCREEN_WIDTH/2.0 + 10.0 ||
           t.translation.y < -SCREEN_HEIGHT/2.0 - 10.0 || t.translation.y > SCREEN_HEIGHT/2.0 + 10.0 {
            if let Some(mut ecmd) = commands.get_entity(e) { ecmd.despawn_recursive(); }
        }
    }
}

fn lifetime_cleanup(time: Res<Time>, mut commands: Commands, mut q: Query<(Entity, &mut Lifetime)>) {
    for (e, mut lt) in &mut q {
        lt.timer.tick(time.delta());
        if lt.timer.finished() { if let Some(mut ecmd) = commands.get_entity(e) { ecmd.despawn_recursive(); } }
    }
}

fn enemy_spawner(
    mut commands: Commands,
    mut meshes: ResMut<Assets<bevy::render::mesh::Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
    time: Res<Time>,
    mut wave_manager: ResMut<WaveManager>,
    score: Res<Score>,
    enemy_query: Query<&Enemy>,
) {
    // conta inimigos ativos
    let active_enemies = enemy_query.iter().count() as u32;
    wave_manager.enemies_remaining = active_enemies;

    // verifica se onda atual foi completada
    if wave_manager.enemies_remaining == 0 && wave_manager.enemies_spawned_this_wave > 0 {
        // verifica se podemos avançar para próxima onda
        if wave_manager.current_wave + 1 < wave_manager.wave_configs.len() {
            let next_wave = &wave_manager.wave_configs[wave_manager.current_wave + 1];
            if score.0 >= next_wave.score_threshold {
                wave_manager.current_wave += 1;
                wave_manager.enemies_spawned_this_wave = 0;
                wave_manager.wave_timer = 0.0;
            }
        }
    }

    // verifica se há uma onda atual válida
    if wave_manager.current_wave >= wave_manager.wave_configs.len() {
        return;
    }

    let current_config = &wave_manager.wave_configs[wave_manager.current_wave].clone();
    
    // calcula total de inimigos a spawnar nesta onda
    let total_enemies = current_config.scout_count + current_config.heavy_count + 
                       current_config.bomber_count + current_config.drone_count;
    
    // se já spawnou todos os inimigos desta onda, espera terminarem
    if wave_manager.enemies_spawned_this_wave >= total_enemies {
        return;
    }

    // atualiza timer
    wave_manager.wave_timer += time.delta_seconds();
    
    // verifica se é hora de spawnar próximo inimigo
    if wave_manager.wave_timer >= current_config.spawn_interval {
        wave_manager.wave_timer = 0.0;
        
        // determina qual tipo spawnar baseado no que resta
        let scouts_spawned = wave_manager.enemies_spawned_this_wave.min(current_config.scout_count);
        let heavies_spawned = (wave_manager.enemies_spawned_this_wave.saturating_sub(current_config.scout_count))
            .min(current_config.heavy_count);
        let bombers_spawned = (wave_manager.enemies_spawned_this_wave
            .saturating_sub(current_config.scout_count + current_config.heavy_count))
            .min(current_config.bomber_count);
        let drones_spawned = (wave_manager.enemies_spawned_this_wave
            .saturating_sub(current_config.scout_count + current_config.heavy_count + current_config.bomber_count))
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
            return;
        };
        
        spawn_enemy_typed(&mut commands, &mut meshes, &mut materials, enemy_type);
        wave_manager.enemies_spawned_this_wave += 1;
    }
}

fn spawn_enemy_typed(
    commands: &mut Commands,
    meshes: &mut Assets<bevy::render::mesh::Mesh>,
    materials: &mut Assets<ColorMaterial>,
    enemy_type: EnemyType,
) {
    let mut rng = thread_rng();
    let x = rng.gen_range(-SCREEN_WIDTH/2.0 + 30.0..SCREEN_WIDTH/2.0 - 30.0);
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

    let mut e = commands.spawn((
        SpatialBundle { transform: Transform::from_translation(Vec3::new(x, y, 9.0)), ..default() },
        Enemy { 
            movement, 
            distance: rng.gen_range(20..70), 
            phase: rng.gen_range(0.0..(std::f32::consts::TAU)), 
            speed: speed / 100.0, 
            shoot_time: rng.gen_range(20..120), 
            kind 
        },
        Collider { w: size.x, h: size.y },
        Health { hp, max: hp },
        Name::new("Enemy"),
    ));
    let eid = e.id();
    let mut bounds: Option<ShipBounds> = None;
    e.with_children(|c| {
        let seed = rng.gen();
        let b = spawn_ship_visual(c, meshes, materials, size, seed, color);
        bounds = Some(b);
    });
    drop(e);
    if let Some(b) = bounds { 
        if let Some(mut ecmd) = commands.get_entity(eid) { 
            ecmd.insert(Collider { w: b.width_units * size.x, h: b.height_units * size.y }); 
        } 
    }
}

fn spawn_enemy(
    commands: &mut Commands,
    meshes: &mut Assets<bevy::render::mesh::Mesh>,
    materials: &mut Assets<ColorMaterial>,
    kind: EnemyKind,
) {
    let mut rng = thread_rng();
    let x = rng.gen_range(-SCREEN_WIDTH/2.0 + 30.0..SCREEN_WIDTH/2.0 - 30.0);
    let y = rng.gen_range(140.0..180.0); // perto do topo (mundo)
    let (size, hp, color, speed) = match kind {
        EnemyKind::Basic => (SIZE_ENEMY, ENEMY_HEALTH, Color::rgb(1.0, 0.3, 0.3), rng.gen_range(70.0..120.0)),
        EnemyKind::Meteor => (SIZE_METEOR, 1, Color::rgb(0.7, 0.6, 0.4), rng.gen_range(80.0..160.0)),
        EnemyKind::Special => (Vec2::new(100.0, 20.0), 8, Color::rgb(0.6, 0.5, 0.5), rng.gen_range(40.0..70.0)),
    };

    let mut e = commands.spawn((
        SpatialBundle { transform: Transform::from_translation(Vec3::new(x, y, 9.0)), ..default() },
        Enemy { movement: rng.gen_range(0..8), distance: rng.gen_range(20..70), phase: rng.gen_range(0.0..(std::f32::consts::TAU)), speed: speed / 100.0, shoot_time: rng.gen_range(20..120), kind },
        // placeholder; ajusta após construir
        Collider { w: size.x, h: size.y },
        Health { hp, max: hp },
        Name::new("Enemy"),
    ));
    let eid = e.id();
    let mut bounds: Option<ShipBounds> = None;
    e.with_children(|c| {
        let seed = rng.gen();
        let b = spawn_ship_visual(c, meshes, materials, size, seed, color);
        bounds = Some(b);
    });
    drop(e);
    if let Some(b) = bounds { if let Some(mut ecmd) = commands.get_entity(eid) { ecmd.insert(Collider { w: b.width_units * size.x, h: b.height_units * size.y }); } }
}

fn enemy_behavior(
    time: Res<Time>,
    mut commands: Commands,
    mut q: Query<(Entity, &mut Transform, &mut Enemy, &Collider), Without<Player>>,
    q_player: Query<&Transform, With<Player>>,
    mut meshes: ResMut<Assets<bevy::render::mesh::Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    let player_t = q_player.get_single().ok().map(|t| t.translation);
    for (entity, mut t, mut e, col) in &mut q {
        let old = t.translation;
        // movimento
        match e.movement {
            0 => t.translation.y -= 60.0 * e.speed * time.delta_seconds(), // desce
            1 => t.translation.y += 60.0 * e.speed * time.delta_seconds(), // sobe
            2 => t.translation.x -= 60.0 * e.speed * time.delta_seconds(),
            3 => t.translation.x += 60.0 * e.speed * time.delta_seconds(),
            4 => { t.translation.y -= 42.0 * e.speed * time.delta_seconds(); e.phase += 0.1; t.translation.x += (e.phase).sin() * 1.5; }
            5 => { t.translation.x += 42.0 * e.speed * time.delta_seconds(); e.phase += 0.1; t.translation.y += (e.phase).sin() * 1.5; }
            6 => { t.translation.y -= 72.0 * e.speed * time.delta_seconds(); e.phase += 0.25; t.translation.x += (e.phase).sin() * 2.6; }
            7 => {
                if let Some(pt) = player_t {
                    let dx = pt.x - t.translation.x; let dy = pt.y - t.translation.y; let ang = dy.atan2(dx);
                    t.translation.x += ang.cos() * 0.6 * 60.0 * e.speed * time.delta_seconds();
                    t.translation.y += ang.sin() * 0.6 * 60.0 * e.speed * time.delta_seconds();
                    t.translation.x += (ang + std::f32::consts::FRAC_PI_2).cos() * 0.8;
                }
            }
            _ => {}
        }
        if e.distance > 0 { e.distance -= 1; } else { e.distance = thread_rng().gen_range(20..70); e.movement = thread_rng().gen_range(0..8); e.phase = 0.0; }

        // limites da tela (mantém mais dentro)
        if t.translation.y > SCREEN_HEIGHT/2.0 - 20.0 { e.movement = 0; e.distance = 10; }
        if t.translation.y < -SCREEN_HEIGHT/2.0 + 20.0 { e.movement = 1; e.distance = 10; }
        if t.translation.x > SCREEN_WIDTH/2.0 - 20.0 { e.movement = 2; e.distance = 10; }
        if t.translation.x < -SCREEN_WIDTH/2.0 + 20.0 { e.movement = 3; e.distance = 10; }

        // tiro de inimigo (não atira se meteoro)
        if !matches!(e.kind, EnemyKind::Meteor) {
            if e.shoot_time <= 0 {
                e.shoot_time = thread_rng().gen_range(20..180);
                // 2 balas
                let bx = t.translation.x;
                let by = t.translation.y - col.h / 2.0;
                spawn_missile(&mut commands, &mut meshes, &mut materials, Vec2::new(bx - 9.0, by - 10.0), Vec2::new(0.0, -180.0), false);
                spawn_missile(&mut commands, &mut meshes, &mut materials, Vec2::new(bx + 9.0, by - 10.0), Vec2::new(0.0, -180.0), false);
            } else {
                e.shoot_time -= 1;
            }
        }

        // se sair muito da tela, remove
        if t.translation.y < -SCREEN_HEIGHT/2.0 - 30.0 || t.translation.x < -SCREEN_WIDTH/2.0 - 30.0 || t.translation.x > SCREEN_WIDTH/2.0 + 30.0 {
            if let Some(mut ecmd) = commands.get_entity(entity) { ecmd.despawn_recursive(); }
            continue;
        }

        // leve "bank" visual: aqui omitimos, pois não rotacionamos mesh infantil
        let _vx = t.translation.x - old.x; let _vy = t.translation.y - old.y; let _ = (_vx, _vy);
    }
}

fn collisions_and_damage(
    mut commands: Commands,
    mut score: ResMut<Score>,
    mut shake: ResMut<Shake>,
    time: Res<Time>,
    mut sets: ParamSet<(
        Query<(Entity, &GlobalTransform, &Collider, &mut Health, &Enemy), Without<Player>>,
        Query<(Entity, &GlobalTransform, &Collider, &Bullet, Option<&Velocity>)>,
    )>,
    q_player_info: Query<(&GlobalTransform, &Collider), With<Player>>,
    mut q_player_health: Query<(Entity, &mut Health), With<Player>>,
    audio: Res<AudioEngine>,
    muted: Res<Muted>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    use std::collections::HashSet;
    // Snapshot bullets to avoid overlapping ParamSet borrows
    let bullets: Vec<(Entity, f32, f32, f32, f32, i32, bool, f32, f32)> = sets
        .p1()
        .iter()
        .map(|(e, t, c, b, v)| {
            let (vx, vy) = v.map(|vv| (vv.x, vv.y)).unwrap_or((0.0, 0.0));
            (e, t.translation().x, t.translation().y, c.w, c.h, b.damage, b.friendly, vx, vy)
        })
        .collect();
    let mut removed_bullets: HashSet<Entity> = HashSet::new();
    let mut removed_enemies: HashSet<Entity> = HashSet::new();

    // friendly bullets x enemies
    let dt = time.delta_seconds();
    for (be, bx, by, bw, bh, dmg, _friendly, vx, vy) in bullets.iter().copied().filter(|b| b.6) {
        if removed_bullets.contains(&be) { continue; }
        let extra_w = vx.abs() * dt;
        let extra_h = vy.abs() * dt;
        for (ee, et, ec, mut eh, enemy) in sets.p0().iter_mut() {
            if removed_enemies.contains(&ee) { continue; }
            let ex = et.translation().x;
            let ey = et.translation().y;
            let dx = (bx - ex).abs() - (bw / 2.0 + extra_w) - (ec.w / 2.0);
            let dy = (by - ey).abs() - (bh / 2.0 + extra_h) - (ec.h / 2.0);
            if dx <= 0.0 && dy <= 0.0 {
                eh.hp -= dmg;
                if let Some(mut ecmd) = commands.get_entity(be) { ecmd.despawn_recursive(); }
                removed_bullets.insert(be);
                if eh.hp <= 0 {
                    score.0 += match enemy.kind { EnemyKind::Basic => POINTS_ENEMY, EnemyKind::Meteor => POINTS_METEOR, EnemyKind::Special => POINTS_SPECIAL };
                    let (intensity, frames) = if matches!(enemy.kind, EnemyKind::Special) { (3.0, 24) } else { (1.5, 8) };
                    shake.intensity = intensity;
                    shake.frames = frames;
                    // partículas de explosão
                    let ex = ex;
                    let ey = ey;
                    emit_burst(&mut commands, &mut meshes, &mut materials, Vec2::new(ex, ey), Color::rgb(1.0, 0.6, 0.2), 36, 120.0..260.0, 0.02..0.06);
                    if let Some(mut ecmd) = commands.get_entity(ee) { ecmd.despawn_recursive(); }
                    removed_enemies.insert(ee);
                    if !muted.0 { audio.explosion(); }
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
            if removed_enemies.contains(&ee) { continue; }
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
                let cx = (px + ex) * 0.5; let cy = (py + ey) * 0.5;
                emit_burst(&mut commands, &mut meshes, &mut materials, Vec2::new(cx, cy), Color::rgb(1.0, 0.5, 0.2), 24, 120.0..200.0, 0.02..0.05);
                shake.intensity = 3.0; shake.frames = 12;
                if !muted.0 { audio.hit(); }
                if eh.hp <= 0 {
                    // explosão inimigo
                    emit_burst(&mut commands, &mut meshes, &mut materials, Vec2::new(ex, ey), Color::rgb(1.0, 0.6, 0.2), 36, 120.0..260.0, 0.02..0.06);
                    if let Some(mut ecmd) = commands.get_entity(ee) { ecmd.despawn_recursive(); }
                    removed_enemies.insert(ee);
                    score.0 += match enemy.kind { EnemyKind::Basic => 5, EnemyKind::Meteor => 1, EnemyKind::Special => 20 };
                    if !muted.0 { audio.explosion(); }
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
                if let Some(mut ecmd) = commands.get_entity(pe) { ecmd.despawn_recursive(); }
            }
        }
    }

    // enemy bullets x player (usar snapshot imutável do player)
    if let Ok((pt, pc)) = q_player_info.get_single() {
        let px = pt.translation().x;
        let py = pt.translation().y;
        for (be, bx, by, bw, bh, dmg, _friendly, vx, vy) in bullets.iter().copied().filter(|b| !b.6) {
            if removed_bullets.contains(&be) { continue; }
            let extra_w = vx.abs() * dt;
            let extra_h = vy.abs() * dt;
            let dx = (bx - px).abs() - (bw / 2.0 + extra_w) - (pc.w / 2.0);
            let dy = (by - py).abs() - (bh / 2.0 + extra_h) - (pc.h / 2.0);
            if dx <= 0.0 && dy <= 0.0 {
                shake.intensity = 2.0;
                shake.frames = 10;
                // impacto visual no player
                emit_burst(&mut commands, &mut meshes, &mut materials, Vec2::new(px, py), Color::rgb(1.0, 0.2, 0.2), 18, 80.0..160.0, 0.015..0.04);
                if let Some(mut ecmd) = commands.get_entity(be) { ecmd.despawn_recursive(); }
                removed_bullets.insert(be);
                if !muted.0 { audio.hit(); }
                // aplica dano ao player
                if let Ok((pe, mut php)) = q_player_health.get_single_mut() {
                    php.hp -= dmg;
                    if php.hp <= 0 {
                        if let Some(mut ecmd) = commands.get_entity(pe) { ecmd.despawn_recursive(); }
                    }
                }
            }
        }
    }
}

fn engine_flame_pulse(time: Res<Time>, mut q: Query<(&mut EngineFlame, &Handle<ColorMaterial>)>, mut materials: ResMut<Assets<ColorMaterial>>) {
    for (mut ef, mat_h) in &mut q {
        ef.timer.tick(time.delta());
        if ef.timer.just_finished() {
            if let Some(mat) = materials.get_mut(mat_h) {
                // pequeno pulso emissivo (simulado via cor)
                let t = (std::time::Instant::now().elapsed().as_secs_f32() * 6.0).sin() * 0.3 + 0.7;
                mat.color = Color::rgba(1.8 * t, 0.9 * t, 0.4 * t, 0.9);
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
                emit_burst(&mut commands, &mut meshes, &mut materials, pos, base, 2, 60.0..120.0, 0.01..0.03);
            }
        }
        *last = Some(pos);
    }
}

// Partículas 2D simples
fn emit_burst(
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
        let mesh = meshes.add(Mesh::from(Rectangle { half_size: Vec2::splat(0.5), ..Default::default() }));
        let mat = materials.add(ColorMaterial { color: Color::rgba(color.r() * 1.6, color.g() * 1.6, color.b() * 1.6, 0.95), ..default() });
        commands.spawn((
            MaterialMesh2dBundle {
                mesh: Mesh2dHandle(mesh),
                material: mat,
                transform: Transform::from_translation(Vec3::new(pos.x, pos.y, 7.0)).with_scale(Vec3::splat(sz)),
                ..default()
            },
            Particle2D { vel: Vec2::new(vx, vy), life, total: life, start: color * 1.2, end: Color::rgba(0.0, 0.0, 0.0, 0.0), spin: rng.gen_range(-6.0..6.0) },
        ));
    }
}

fn update_particles(
    time: Res<Time>,
    mut commands: Commands,
    mut q: Query<(Entity, &mut Transform, &mut Particle2D, &Handle<ColorMaterial>)>,
    mut materials: ResMut<Assets<ColorMaterial>>,
) {
    let dt = time.delta_seconds();
    for (e, mut t, mut p, mat_h) in &mut q {
        p.life -= dt;
        if p.life <= 0.0 {
if let Some(mut ecmd) = commands.get_entity(e) { ecmd.insert(ToDespawn); }
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

fn restart_on_click(
    mouse: Res<ButtonInput<MouseButton>>,
    mut next_state: ResMut<NextState<GamePhase>>,
    mut commands: Commands,
    q_entities: Query<Entity>,
    meshes: ResMut<Assets<bevy::render::mesh::Mesh>>,
    materials: ResMut<Assets<ColorMaterial>>,
) {
    if mouse.just_pressed(MouseButton::Left) {
        for e in q_entities.iter() { commands.entity(e).despawn_recursive(); }
        // re-seed setup completo (inclui câmera e recursos)
        setup(commands, meshes, materials);
        next_state.set(GamePhase::Running);
    }
}

// HUD / overlays via egui
fn ui_system(
    mut ctxs: EguiContexts,
    score: Res<Score>,
    cursor: Res<CursorPos>,
    state: Res<State<GamePhase>>,
    q_player: Query<(&Health, &Charge), With<Player>>,
    muted: Res<Muted>,
) {
    let ctx = ctxs.ctx_mut();

    // Top-left HUD
    egui::Window::new(egui::RichText::new("HUD").strong()).title_bar(false).fixed_pos(egui::pos2(8.0, 8.0)).show(ctx, |ui| {
        ui.horizontal(|ui| {
            ui.label(egui::RichText::new(format!("Score: {}", score.0)).heading());
        });
        if let Ok((hp, ch)) = q_player.get_single() {
            // barras
            progress_bar(ui, "Health", hp.hp as f32 / hp.max as f32, egui::Color32::from_rgb(255, 64, 64));
            progress_bar(ui, "Charge", ch.value / ch.max, egui::Color32::from_rgb(64, 128, 255));
        } else {
            progress_bar(ui, "Health", 0.0, egui::Color32::from_rgb(255, 64, 64));
            progress_bar(ui, "Charge", 0.0, egui::Color32::from_rgb(64, 128, 255));
        }
        ui.label(if muted.0 { "Muted: ON (tecla M)" } else { "Muted: OFF (tecla M)" });
        ui.small(format!("Cursor: {:.0},{:.0}", cursor.screen.x, cursor.screen.y));
        ui.small("P: Pause • M: Mute");
    });

    // overlays centrais
    match state.get() {
        GamePhase::Paused => {
            egui::Area::new("paused").fixed_pos(center_text_pos(ctx, "PAUSED")).show(ctx, |ui| {
                ui.label(egui::RichText::new("PAUSED").size(48.0));
            });
        }
        GamePhase::GameOver => {
            egui::Area::new("game_over").fixed_pos(center_text_pos(ctx, "GAME OVER")).show(ctx, |ui| {
                ui.vertical_centered(|ui| {
                    ui.label(egui::RichText::new("GAME OVER").size(48.0));
                    ui.add_space(8.0);
                    ui.label("Clique para reiniciar");
                });
            });
        }
        _ => {}
    }
}

fn center_text_pos(ctx: &egui::Context, _text: &str) -> egui::Pos2 {
    let rect = ctx.input(|i| i.screen_rect);
    egui::pos2(rect.center().x - 120.0, rect.center().y - 40.0)
}

fn progress_bar(ui: &mut egui::Ui, label: &str, frac: f32, color: egui::Color32) {
    let frac = frac.clamp(0.0, 1.0);
    ui.label(label);
    let (rect, _) = ui.allocate_exact_size(egui::vec2(220.0, 18.0), egui::Sense::hover());
    ui.painter().rect_filled(rect, 3.0, egui::Color32::from_black_alpha(64));
    let fill = egui::Rect::from_min_size(rect.min, egui::vec2(rect.width() * frac, rect.height()));
    ui.painter().rect_filled(fill, 3.0, color);
}

fn run_if_running() -> impl FnMut(Option<Res<State<GamePhase>>>) -> bool + Clone {
    |state: Option<Res<State<GamePhase>>>| match state.map(|s| *s.get()).unwrap_or(GamePhase::Running) {
        GamePhase::Running => true,
        _ => false,
    }
}

fn main() {
    App::new()
        .add_plugins(
            DefaultPlugins.set(WindowPlugin {
                primary_window: Some(Window {
                    title: "Jogo Tosco de dar Tiro (Rust + Bevy)".into(),
                    resolution: (SCREEN_WIDTH, SCREEN_HEIGHT).into(),
                    resizable: true,
                    ..default()
                }),
                ..default()
            })
        )
        .add_plugins(EguiPlugin)
        .insert_state(GamePhase::Running)
        .add_systems(Startup, setup)
        .add_systems(Update, (
            track_frames,
            update_cursor,
            starfield_update,
            ui_system,
            toggle_mute,
            pause_input,
        ))
        // gameplay quando Running
        .add_systems(Update, (
            player_control,
            player_trail,
            follow_laser_to_player,
            move_bullets,
            lifetime_cleanup,
            enemy_spawner,
            enemy_behavior,
            collisions_and_damage,
            engine_flame_pulse,
            camera_shake,
            check_game_over,
            update_particles,
        ).run_if(run_if_running()))
        // restart quando GameOver
        .add_systems(Update, restart_on_click.run_if(in_state(GamePhase::GameOver)))
        .run();
}

