# Widget Refresh Guide

## The Problem
Widgets are **extension targets** that iOS caches aggressively. Even after rebuilding your app, you may see old widget layouts because:

1. **Widget timeline cache** - WidgetKit caches the widget's timeline data
2. **Compiled extension cache** - The widget extension binary itself is cached
3. **SpringBoard cache** - iOS Home screen caches widget snapshots

## Solution: Complete Widget Refresh

### For Real iPhone Device

#### Method 1: Delete and Reinstall (Most Reliable)
1. **Delete the app** from your iPhone completely
   - Long press the Weather Oracle app icon
   - Tap "Remove App" → "Delete App"

2. **Clean build in Xcode**
   - In Xcode: Product → Clean Build Folder (Cmd+Shift+K)

3. **Rebuild and install**
   - Product → Run (Cmd+R)
   - Wait for app to install and launch on device

4. **Add widget fresh**
   - Long press empty space on home screen
   - Tap "+" in top left
   - Search for "Weather Oracle"
   - Add the widget size you want to test

#### Method 2: Force Refresh Without Deleting
1. **Remove all Weather Oracle widgets**
   - Long press each widget
   - Tap "Remove Widget"

2. **Force quit the app**
   - Swipe up from bottom (or double-click home button)
   - Swipe away Weather Oracle app

3. **Restart iPhone** (yes, really!)
   - Press and hold power button + volume button
   - Slide to power off
   - Wait 10 seconds
   - Turn back on

4. **Clean and rebuild in Xcode**
   - Product → Clean Build Folder (Cmd+Shift+K)
   - Product → Run (Cmd+R)

5. **Re-add widgets**
   - Long press home screen → "+" → Weather Oracle

### For Simulator (If Testing There)

Run the provided script:
```bash
cd /Users/harrison/Github/weather-oracle/apps/apple-native
./force_widget_refresh.sh
```

Or manually:
1. **Clean Xcode build**
   ```bash
   cd /Users/harrison/Github/weather-oracle/apps/apple-native
   xcodebuild clean -workspace WeatherOracle.xcworkspace -scheme WeatherOracle -configuration Debug
   ```

2. **Remove DerivedData**
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/WeatherOracle-*
   ```

3. **Get booted simulator ID**
   ```bash
   xcrun simctl list devices | grep "(Booted)"
   ```

4. **Uninstall app from simulator**
   ```bash
   xcrun simctl uninstall booted com.weatheroracle.app
   ```

5. **Invalidate widget caches**
   ```bash
   xcrun simctl spawn booted notifyutil -p com.apple.widgetkit.invalidate
   ```

6. **Restart SpringBoard**
   ```bash
   xcrun simctl spawn booted launchctl kickstart -k system/com.apple.SpringBoard
   ```

7. **Rebuild and run**
   - In Xcode: Cmd+R

## What Changed in the Layout

### Medium Widget (Hourly Forecast)
- **Reduced spacing**: 8px between hours (was 12px)
- **Dynamic sizing**: Uses `.frame(maxWidth: .infinity)` instead of fixed widths
- **Text scaling**: Added `.minimumScaleFactor(0.7)` to prevent cutoff
- **Icon sizing**: Uses `.font(.body)` with `.aspectRatio(contentMode: .fit)`

### Large Widget (Daily + Hourly)
- **Hourly cells**: Explicit 18px icons with `.symbolRenderingMode(.multicolor)`
- **Daily rows**: 16px icons with proper spacing and alignment
- **Current conditions**: 36px weather icon with 40x40 frame
- **Temperature bar**: Increased from 40px to 50px width

### All Widgets
- **SF Symbols multicolor**: All weather icons use `.symbolRenderingMode(.multicolor)` for color
- **Better spacing**: Reduced VStack spacing from 6 to 4 throughout

## Expected Result

After refresh, you should see:
- ✅ Weather icons visible in all widget sizes (sun, cloud, etc. with colors)
- ✅ Hourly forecast times not cut off at top
- ✅ Daily forecast rows properly aligned
- ✅ Temperature bars and labels well-spaced
- ✅ No squashed or overlapping text

## Troubleshooting

### Widgets still show old layout
- Try Method 1 (delete and reinstall) - it's more reliable than Method 2
- Make sure you're testing the Debug build, not a cached Release build

### Widgets show "--" or "No Data"
- Open the main app first and let it fetch weather data
- Check logs for "📱 Widget data: Cached forecast" message
- Verify location was added successfully

### Icons still missing
- This is a different issue - check that `weatherIcon()` function is working
- Verify SF Symbols are available (they should be built-in to iOS)
- Check console for rendering errors

### Text still cut off
- This might be a font size issue for your specific device
- May need to adjust `.minimumScaleFactor` values further
- Try different widget sizes to see which works best
