use bevy::prelude::*;
use bevy_egui::{egui, EguiContexts};
use crate::core::{GamePhase, Score, Muted};
use crate::input::CursorPos;
use crate::gameplay::player::Player;
use crate::gameplay::components::{Health, Charge};

pub struct UiPlugin;
impl Plugin for UiPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, ui_system);
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
    
    // Background with subtle border
    ui.painter().rect_filled(rect, 3.0, egui::Color32::from_black_alpha(64));
    ui.painter().rect_stroke(rect, 3.0, egui::Stroke::new(1.0, egui::Color32::from_white_alpha(30)));
    
    let fill = egui::Rect::from_min_size(rect.min, egui::vec2(rect.width() * frac, rect.height()));
    
    // Enhanced health bar with color transitions
    if label == "Health" {
        let bar_color = if frac > 0.6 {
            egui::Color32::from_rgb(64, 255, 64) // Green
        } else if frac > 0.3 {
            egui::Color32::from_rgb(255, 255, 64) // Yellow
        } else {
            egui::Color32::from_rgb(255, 64, 64) // Red
        };
        
        ui.painter().rect_filled(fill, 3.0, bar_color);
        
        // Glowing border for health bar
        let glow_alpha = (30.0 + (ui.ctx().input(|i| i.time) * 3.0).sin() * 15.0) as u8;
        ui.painter().rect_stroke(fill, 3.0, egui::Stroke::new(2.0, egui::Color32::from_rgb(bar_color.r(), bar_color.g(), bar_color.b()).linear_multiply(1.2).gamma_multiply(1.3)));
    } else if label == "Charge" {
        ui.painter().rect_filled(fill, 3.0, color);
        
        // Glowing edge and pulsing animation when full
        if frac >= 0.99 {
            let pulse = (ui.ctx().input(|i| i.time) * 5.0).sin() * 0.3 + 0.7;
            let glow_color = egui::Color32::from_rgb(
                (128.0 + 127.0 * pulse) as u8,
                (200.0 + 55.0 * pulse) as u8,
                255,
            );
            ui.painter().rect_stroke(fill, 3.0, egui::Stroke::new(3.0, glow_color));
            
            // Inner glow
            let inner_rect = fill.shrink(2.0);
            ui.painter().rect_stroke(inner_rect, 2.0, egui::Stroke::new(1.5, egui::Color32::from_rgb(200, 230, 255)));
        }
    } else {
        ui.painter().rect_filled(fill, 3.0, color);
    }
}
