#!/bin/bash

echo "🧹 Step 1: Cleaning Xcode build artifacts..."
cd /Users/harrison/Github/weather-oracle/apps/apple-native
xcodebuild clean -workspace WeatherOracle.xcworkspace -scheme WeatherOracle -configuration Debug

echo ""
echo "🗑️ Step 2: Removing DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/WeatherOracle-*

echo ""
echo "📱 Step 3: Checking for booted simulators..."
BOOTED_DEVICE=$(xcrun simctl list devices | grep "(Booted)" | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')

if [ -n "$BOOTED_DEVICE" ]; then
    echo "Found booted device: $BOOTED_DEVICE"

    echo ""
    echo "🧹 Step 4: Removing app from simulator..."
    xcrun simctl uninstall "$BOOTED_DEVICE" com.weatheroracle.app || true

    echo ""
    echo "🔄 Step 5: Erasing all widget caches..."
    xcrun simctl spawn "$BOOTED_DEVICE" notifyutil -p com.apple.widgetkit.invalidate || true

    echo ""
    echo "🔄 Step 6: Restarting SpringBoard (Home screen)..."
    xcrun simctl spawn "$BOOTED_DEVICE" launchctl kickstart -k system/com.apple.SpringBoard || true

    sleep 2
else
    echo "⚠️ No booted simulator found"
    echo "Please boot a simulator in Xcode and try again"
    exit 1
fi

echo ""
echo "✅ Widget refresh complete!"
echo ""
echo "📝 Next steps:"
echo "1. In Xcode, clean build folder (Cmd+Shift+K)"
echo "2. Build and run the app (Cmd+R)"
echo "3. Once app launches, add a widget from the home screen"
echo "4. The widget should now show your latest layout changes"
