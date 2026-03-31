#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::Deserialize;
use vtracer::{convert, ColorImage, Config, ColorMode, Hierarchical};
use visioncortex::PathSimplifyMode;
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Deserialize)]
struct TraceParams {
    image_base64: String,
    is_color: bool,
    is_stacked: bool,
    filter_speckle: usize,
    color_precision: i32,
    gradient_step: i32,
    simplify_mode: String, // "pixel", "polygon", "spline"
    corner_threshold: i32,
    segment_length: f64,
    splice_threshold: i32,
    path_precision: u32,
}

#[tauri::command]
async fn trace_image(params: TraceParams) -> Result<String, String> {
    // Decode base64 image
    let data = general_purpose::STANDARD
        .decode(&params.image_base64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Try loading with standard image crate first (PNG, JPG, WebP, etc.)
    let pixels_data = match image::load_from_memory(&data) {
        Ok(img) => {
            let mut img_rgba8 = img.into_rgba8();
            let width = img_rgba8.width() as usize;
            let height = img_rgba8.height() as usize;
            
            // Blend over white background
            for pixel in img_rgba8.pixels_mut() {
                let alpha = pixel[3] as f32 / 255.0;
                let inv_alpha = 1.0 - alpha;
                pixel[0] = ((pixel[0] as f32 * alpha) + (255.0 * inv_alpha)) as u8;
                pixel[1] = ((pixel[1] as f32 * alpha) + (255.0 * inv_alpha)) as u8;
                pixel[2] = ((pixel[2] as f32 * alpha) + (255.0 * inv_alpha)) as u8;
                pixel[3] = 255;
            }
            (img_rgba8.into_raw(), width, height)
        },
        Err(e) => {
            // Fallback to HEIC decoder for iPhone photos
            match heic::DecoderConfig::new().decode(&data, heic::PixelLayout::Rgba8) {
                Ok(heic_img) => (heic_img.data, heic_img.width, heic_img.height),
                Err(_) => return Err(format!("Unsupported image format. Error: {}", e)),
            }
        }
    };

    let (pixels, width, height) = pixels_data;

    // Map parameters to vtracer::Config
    let color_mode = if params.is_color {
        ColorMode::Color
    } else {
        ColorMode::Binary
    };

    let hierarchical = if params.is_stacked {
        Hierarchical::Stacked
    } else {
        Hierarchical::Cutout
    };

    let mode = match params.simplify_mode.as_str() {
        "polygon" => PathSimplifyMode::Polygon,
        "spline" => PathSimplifyMode::Spline,
        _ => PathSimplifyMode::None, // "pixel"
    };

    let config = Config {
        color_mode,
        hierarchical,
        filter_speckle: params.filter_speckle,
        color_precision: params.color_precision,
        layer_difference: params.gradient_step,
        mode,
        corner_threshold: params.corner_threshold,
        length_threshold: params.segment_length,
        splice_threshold: params.splice_threshold,
        path_precision: Some(params.path_precision),
        ..Default::default()
    };

    let image = ColorImage {
        pixels,
        width,
        height,
    };

    // Run the heavy CPU bound task on a blocking thread
    let mut svg_string = tauri::async_runtime::spawn_blocking(move || {
        convert(image, config).map_err(|e| format!("Tracing failed: {}", e))
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))??
    .to_string();

    // Inject viewBox for proper scaling in the UI
    let search_str = format!("width=\"{}\" height=\"{}\"", width, height);
    let replace_str = format!("viewBox=\"0 0 {} {}\" width=\"100%\" height=\"100%\"", width, height);
    svg_string = svg_string.replace(&search_str, &replace_str);

    Ok(svg_string)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![trace_image])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
