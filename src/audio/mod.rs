use bevy::prelude::*;
use rand::prelude::*;
use std::sync::mpsc::{self, Sender};
use std::thread;

pub struct AudioPlugin;
impl Plugin for AudioPlugin {
    fn build(&self, _app: &mut App) {}
}

#[derive(Resource, Clone)]
pub struct AudioEngine {
    tx: Sender<AudioMsg>,
}

enum AudioMsg {
    Play { data: Vec<f32>, sample_rate: u32 },
}

impl AudioEngine {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel::<AudioMsg>();
        thread::spawn(move || {
            let (_stream, handle) = match rodio::OutputStream::try_default() {
                Ok(v) => v,
                Err(_) => return,
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

    pub fn play_buffer(&self, data: Vec<f32>, sample_rate: u32) {
        let _ = self.tx.send(AudioMsg::Play { data, sample_rate });
    }

    pub fn shoot_pitch(&self, pitch: f32) { let sr = 44100; let data = synth_beep(sr, 0.08, 800.0 * pitch, 0.25, Wave::Square, Some(60.0)); self.play_buffer(data, sr); }
    pub fn laser_sweep(&self, start: f32, end: f32) { let sr = 44100; let data = synth_gliss(sr, 0.18, start, end, 0.22, Wave::Sine); self.play_buffer(data, sr); }
    pub fn special(&self) {
        let sr = 44100;
        let mut mix = vec![0.0; (sr as f32 * 0.35) as usize];
        let tones = [220.0, 330.0, 440.0, 660.0];
        for (i, f) in tones.iter().enumerate() {
            let d = synth_beep(sr, 0.35, *f, 0.18 / (i as f32 + 1.0), Wave::Sine, Some(4.0));
            mix_inplace(&mut mix, &d);
        }
        self.play_buffer(mix, sr);
    }
    pub fn explosion(&self) { let sr = 44100; let data = synth_noise(sr, 0.25, 0.28, Some(8.0)); self.play_buffer(data, sr); }
    pub fn hit(&self) { let sr = 44100; let data = synth_noise(sr, 0.07, 0.2, Some(20.0)); self.play_buffer(data, sr); }
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
