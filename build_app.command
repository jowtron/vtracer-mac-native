#!/bin/bash

# Move to the script's directory
cd "$(dirname "$0")"

echo "------------------------------------------"
echo "🚀 Starting vTracer Production Build..."
echo "------------------------------------------"

# Ensure tauri-cli is installed
if ! command -v cargo-tauri &> /dev/null
then
    echo "📦 Tauri CLI not found. Installing..."
    cargo install tauri-cli
fi

# Run the build
cargo tauri build

if [ $? -eq 0 ]; then
    echo ""
    echo "------------------------------------------"
    echo "✅ Build Successful!"
    echo "------------------------------------------"
    echo "Your packages are ready at:"
    
    # Find the built dmg and app files
    APP_PATH=$(find src-tauri/target/release/bundle/macos -name "*.app" | head -n 1)
    DMG_PATH=$(find src-tauri/target/release/bundle/dmg -name "*.dmg" | head -n 1)
    
    echo "🔹 App: $APP_PATH"
    echo "🔹 DMG: $DMG_PATH"
    echo ""
    
    # Open the folder containing the DMG
    open "$(dirname "$DMG_PATH")"
else
    echo "❌ Build failed. Please check the logs above."
fi

# Keep the window open
echo "Press any key to close this terminal..."
read -n 1
