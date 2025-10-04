use bevy::prelude::*;
use rand::prelude::*;

pub struct AudioPlugin;
impl Plugin for AudioPlugin {
    fn build(&self, _app: &mut App) {}
}

#[cfg(not(target_arch = "wasm32"))]
mod native_impl {
    use super::*;
    use std::sync::mpsc::{self, Sender};
    use std::thread;

    #[derive(Resource, Clone)]
    pub struct AudioEngine {
        tx: Sender<AudioMsg>,
    }

    enum AudioMsg {
        Play { data: Vec<f32>, sample_rate: u32 },
    }

    impl Default for AudioEngine {
        fn default() -> Self {
            Self::new()
        }
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
                                let buf = rodio::buffer::SamplesBuffer::new(
                                    2,
                                    sample_rate,
                                    interleave_stereo(data),
                                );
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

        fn play_sound_internal(&self, freq: f32, duration: f32, wave_type: WaveType) {
            let sr = 44100;
            let data = synth_beep(sr, duration, freq, 0.25, wave_type, Some(60.0));
            self.play_buffer(data, sr);
        }

        pub fn play_sound(&self, freq: f32, duration: f32) {
            self.play_sound_internal(freq, duration, WaveType::Sine);
        }

        pub fn play_explosion(&self) {
            let sr = 44100;
            let data = synth_noise(sr, 0.25, 0.28, Some(8.0));
            self.play_buffer(data, sr);
        }

        pub fn play_shoot(&self, pitch: f32) {
            self.play_sound_internal(800.0 * pitch, 0.08, WaveType::Square);
        }

        pub fn play_powerup(&self) {
            let sr = 44100;
            let mut mix = vec![0.0; (sr as f32 * 0.35) as usize];
            let tones = [220.0, 330.0, 440.0, 660.0];
            for (i, f) in tones.iter().enumerate() {
                let d = synth_beep(sr, 0.35, *f, 0.18 / (i as f32 + 1.0), WaveType::Sine, Some(4.0));
                mix_inplace(&mut mix, &d);
            }
            self.play_buffer(mix, sr);
        }

        pub fn shoot_pitch(&self, pitch: f32) { self.play_shoot(pitch); }
        pub fn laser_sweep(&self, start: f32, end: f32) { let sr = 44100; let data = synth_gliss(sr, 0.18, start, end, 0.22, WaveType::Sine); self.play_buffer(data, sr); }
        pub fn special(&self) { self.play_powerup(); }
        pub fn explosion(&self) { self.play_explosion(); }
        pub fn hit(&self) { let sr = 44100; let data = synth_noise(sr, 0.07, 0.2, Some(20.0)); self.play_buffer(data, sr); }
    }

    fn interleave_stereo(mono: Vec<f32>) -> Vec<f32> {
        let mut out = Vec::with_capacity(mono.len() * 2);
        for &s in &mono {
            out.push(s);
            out.push(s);
        }
        out
    }
}

#[cfg(target_arch = "wasm32")]
mod wasm_impl {
    use super::*;
    use wasm_bindgen::prelude::*;
    use web_sys::{AudioContext, OscillatorNode, GainNode, OscillatorType};

    #[derive(Resource, Clone)]
    pub struct AudioEngine {
        context: Option<AudioContext>,
    }

    impl AudioEngine {
        pub fn new() -> Self {
            let context = AudioContext::new().ok();
            Self { context }
        }

        fn play_oscillator(&self, freq: f32, duration: f32, osc_type: OscillatorType, gain: f32, decay_rate: Option<f32>) {
            if let Some(ctx) = &self.context {
                if let (Ok(osc), Ok(gain_node)) = (ctx.create_oscillator(), ctx.create_gain()) {
                    let _ = osc.set_type(osc_type);
                    let _ = osc.frequency().set_value(freq);
                    
                    let now = ctx.current_time();
                    if let Some(decay) = decay_rate {
                        let _ = gain_node.gain().set_value_at_time(gain, now);
                        let _ = gain_node.gain().exponential_ramp_to_value_at_time(gain * 0.001, now + duration as f64);
                    } else {
                        let _ = gain_node.gain().set_value(gain);
                    }
                    
                    let _ = osc.connect_with_audio_node(&gain_node);
                    let _ = gain_node.connect_with_audio_node(&ctx.destination());
                    let _ = osc.start();
                    let _ = osc.stop_with_when(now + duration as f64);
                }
            }
        }

        fn play_noise(&self, duration: f32, gain: f32, decay_rate: Option<f32>) {
            if let Some(ctx) = &self.context {
                let sample_rate = ctx.sample_rate();
                let num_samples = (sample_rate * duration) as usize;
                
                if let Ok(buffer) = ctx.create_buffer(1, num_samples as u32, sample_rate) {
                    if let Ok(mut channel_data) = buffer.get_channel_data(0) {
                        let mut rng = rand::thread_rng();
                        for i in 0..num_samples {
                            let t = i as f32 / sample_rate;
                            let env = decay_rate.map(|d| (-d * t).exp()).unwrap_or(1.0);
                            let noise: f32 = rng.gen::<f32>() * 2.0 - 1.0;
                            channel_data[i] = noise * gain * env;
                        }
                        
                        if let Ok(source) = ctx.create_buffer_source() {
                            let _ = source.set_buffer(Some(&buffer));
                            if let Ok(gain_node) = ctx.create_gain() {
                                let _ = gain_node.gain().set_value(1.0);
                                let _ = source.connect_with_audio_node(&gain_node);
                                let _ = gain_node.connect_with_audio_node(&ctx.destination());
                                let _ = source.start();
                            }
                        }
                    }
                }
            }
        }

        pub fn play_sound(&self, freq: f32, duration: f32) {
            self.play_oscillator(freq, duration, OscillatorType::Sine, 0.25, Some(60.0));
        }

        pub fn play_explosion(&self) {
            self.play_noise(0.25, 0.28, Some(8.0));
        }

        pub fn play_shoot(&self, pitch: f32) {
            self.play_oscillator(800.0 * pitch, 0.08, OscillatorType::Square, 0.25, Some(60.0));
        }

        pub fn play_powerup(&self) {
            let tones = [220.0, 330.0, 440.0, 660.0];
            for (i, freq) in tones.iter().enumerate() {
                let gain = 0.18 / (i as f32 + 1.0);
                self.play_oscillator(*freq, 0.35, OscillatorType::Sine, gain, Some(4.0));
            }
        }

        pub fn shoot_pitch(&self, pitch: f32) { self.play_shoot(pitch); }
        pub fn laser_sweep(&self, start: f32, end: f32) {
            if let Some(ctx) = &self.context {
                if let (Ok(osc), Ok(gain_node)) = (ctx.create_oscillator(), ctx.create_gain()) {
                    let _ = osc.set_type(OscillatorType::Sine);
                    let now = ctx.current_time();
                    let duration = 0.18;
                    
                    let _ = osc.frequency().set_value_at_time(start, now);
                    let _ = osc.frequency().linear_ramp_to_value_at_time(end, now + duration);
                    
                    let _ = gain_node.gain().set_value_at_time(0.22, now);
                    let _ = gain_node.gain().linear_ramp_to_value_at_time(0.0, now + duration);
                    
                    let _ = osc.connect_with_audio_node(&gain_node);
                    let _ = gain_node.connect_with_audio_node(&ctx.destination());
                    let _ = osc.start();
                    let _ = osc.stop_with_when(now + duration);
                }
            }
        }
        pub fn special(&self) { self.play_powerup(); }
        pub fn explosion(&self) { self.play_explosion(); }
        pub fn hit(&self) { self.play_noise(0.07, 0.2, Some(20.0)); }
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub use native_impl::AudioEngine;

#[cfg(target_arch = "wasm32")]
pub use wasm_impl::AudioEngine;

#[derive(Clone, Copy)]
pub(crate) enum WaveType { Sine, Square }

fn synth_beep(sr: u32, dur: f32, freq: f32, vol: f32, wave: WaveType, decay: Option<f32>) -> Vec<f32> {
    let n = (sr as f32 * dur) as usize;
    let mut out = vec![0.0; n];
    for (i, item) in out.iter_mut().enumerate().take(n) {
        let t = i as f32 / sr as f32;
        let env = decay.map(|d| (-d * t).exp()).unwrap_or(1.0);
        let x = 2.0 * std::f32::consts::PI * freq * t;
        let s = match wave {
            WaveType::Sine => x.sin(),
            WaveType::Square => {
                if x.sin() >= 0.0 {
                    1.0
                } else {
                    -1.0
                }
            }
        };
        *item = s * vol * env;
    }
    out
}

fn synth_gliss(sr: u32, dur: f32, f_start: f32, f_end: f32, vol: f32, wave: WaveType) -> Vec<f32> {
    let n = (sr as f32 * dur) as usize;
    let mut out = vec![0.0; n];
    for (i, item) in out.iter_mut().enumerate().take(n) {
        let t = i as f32 / sr as f32;
        let f = f_start + (f_end - f_start) * t;
        let x = 2.0 * std::f32::consts::PI * f * t;
        let s = match wave {
            WaveType::Sine => x.sin(),
            WaveType::Square => {
                if x.sin() >= 0.0 {
                    1.0
                } else {
                    -1.0
                }
            }
        };
        *item = s * vol * (1.0 - t);
    }
    out
}

fn synth_noise(sr: u32, dur: f32, vol: f32, decay: Option<f32>) -> Vec<f32> {
    let n = (sr as f32 * dur) as usize;
    let mut out = vec![0.0; n];
    let mut rng = rand::thread_rng();
    for (i, item) in out.iter_mut().enumerate().take(n) {
        let t = i as f32 / sr as f32;
        let env = decay.map(|d| (-d * t).exp()).unwrap_or(1.0);
        let s: f32 = rng.gen::<f32>() * 2.0 - 1.0; // -1..1
        *item = s * vol * env;
    }
    out
}

fn mix_inplace(dst: &mut [f32], src: &[f32]) {
    let n = dst.len().min(src.len());
    for i in 0..n {
        dst[i] = (dst[i] + src[i]).clamp(-1.0, 1.0);
    }
}
