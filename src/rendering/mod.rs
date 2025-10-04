use bevy::prelude::*;
use bevy::sprite::{MaterialMesh2dBundle, Mesh2dHandle};
use bevy::render::mesh::{Indices, Mesh, PrimitiveTopology};
use bevy::render::render_asset::RenderAssetUsages;
use bevy::math::primitives::Rectangle;
use rand::rngs::StdRng;
use rand::prelude::*;
use crate::constants::SIZE_PLAYER;
use crate::effects::EngineFlame;

pub struct RenderingPlugin;

impl Plugin for RenderingPlugin {
    fn build(&self, _app: &mut App) {
        // Currently no systems to register, just utility functions
    }
}

// ====== Procedural meshes ======

pub fn mesh_triangle() -> bevy::render::mesh::Mesh {
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

pub fn mesh_diamond() -> bevy::render::mesh::Mesh {
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

pub fn mesh_arrow() -> bevy::render::mesh::Mesh {
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

pub fn mesh_hexagon() -> bevy::render::mesh::Mesh {
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

pub struct ShipBounds { 
    pub width_units: f32, 
    pub height_units: f32 
}

pub fn spawn_ship_visual(
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
    let width_units_base: f32 = match choice { 0 => 1.0, 1 => 0.8, 2 => 0.8, 3 => 1.0, _ => 1.0 };
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

pub fn spawn_engine_glow(
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
