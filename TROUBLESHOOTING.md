# Troubleshooting Metro Bundler Error 500

## Common Causes and Solutions

### 1. Clear Metro Cache

```bash
# Stop the Metro bundler (Ctrl+C)
# Then restart with cache cleared:
npx react-native start --reset-cache
```

### 2. Clear All Caches

```bash
# Clear Metro cache
rm -rf /tmp/metro-*

# Clear watchman cache
watchman watch-del-all

# Clear node modules and reinstall
rm -rf node_modules
npm install

# For iOS, also clear pods
cd ios && rm -rf Pods Podfile.lock && pod install && cd ..
```

### 3. Check for Missing Dependencies

Ensure all required packages are installed:

```bash
npm install react-native-gesture-handler react-native-reanimated react-native-svg
```

### 4. Verify Babel Configuration

Check `babel.config.js` - Reanimated plugin must be last:

```javascript
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-reanimated/plugin', // Must be last
  ],
};
```

### 5. Check Import Errors

Common issues:
- Missing imports
- Incorrect import paths
- Circular dependencies

Check the error message in Metro bundler output for specific file/line.

### 6. Restart Development Server

```bash
# Kill all node processes
killall node

# Restart Metro
npm start
```

### 7. Rebuild Native Code

```bash
# Android
cd android && ./gradlew clean && cd ..
npm run android

# iOS
cd ios && pod install && cd ..
npm run ios
```

### 8. Check TypeScript Errors

```bash
npx tsc --noEmit
```

### 9. Verify Package Versions

Ensure compatible versions:
- `react-native-reanimated`: ^3.6.0
- `react-native-gesture-handler`: ^2.16.0
- `react-native-svg`: ^14.0.0

### 10. Check for Syntax Errors

Look for:
- Missing semicolons
- Unclosed brackets
- Incorrect JSX syntax
- Import/export mismatches

## Quick Fix Checklist

1. ✅ Clear Metro cache: `npx react-native start --reset-cache`
2. ✅ Check `babel.config.js` has Reanimated plugin last
3. ✅ Verify all imports are correct
4. ✅ Check for unused imports (can cause issues)
5. ✅ Restart Metro bundler
6. ✅ Rebuild app if needed

## Getting Detailed Error Info

Check Metro bundler output for:
- File name and line number
- Specific error message
- Stack trace

The error 500 usually indicates a bundling/transpilation issue rather than a runtime error.


