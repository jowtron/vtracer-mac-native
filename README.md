# vTracer Native Clone

A lightweight, native macOS desktop application that serves as a graphical frontend for the [vtracer](https://github.com/visioncortex/vtracer) vectorization engine. It provides a 1:1 functional replica of the web interface, but runs entirely natively and offline using Tauri and Rust.

## Features
- **Native Performance**: Powered by Rust and `vtracer` 0.6.
- **Offline Processing**: All image processing happens locally on your machine.
- **Modern UI**: Apple-inspired design with Dark Mode support and animated controls.
- **Compare View**: Easily toggle between the original raster image and the vectorized SVG.
- **Real-time Feedback**: Instant SVG rendering with a debounced slider.

## Acknowledgements & Licensing

This project is built upon the incredible **vtracer** library created by **visioncortex**. 
The `visioncortex/vtracer` core engine is dual-licensed under the [MIT License](https://opensource.org/licenses/MIT) and the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).

The logo used in this app is the property of the visioncortex project.

## Development

```bash
# Install dependencies
cargo install tauri-cli

# Run in development mode
cargo tauri dev
```