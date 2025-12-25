# Fix Port 8081 Already in Use Error

## Quick Fix

The error `EADDRINUSE: address already in use :::8081` means another Metro bundler is running.

### Solution 1: Kill the Process (Recommended)

```bash
# Find and kill process on port 8081
lsof -ti:8081 | xargs kill -9

# Or find all Metro/React Native processes
pkill -f "react-native" || pkill -f "metro"

# Then restart
npx react-native start --reset-cache
```

### Solution 2: Use a Different Port

```bash
# Start Metro on a different port
npx react-native start --port 8082 --reset-cache
```

### Solution 3: Manual Process Kill

1. Find the process:
   ```bash
   lsof -i :8081
   ```

2. Kill it using the PID:
   ```bash
   kill -9 <PID>
   ```

### Solution 4: Restart Your Terminal

Sometimes the process is tied to your terminal session. Simply:
1. Close the terminal
2. Open a new terminal
3. Run: `npx react-native start --reset-cache`

## Verify Port is Free

```bash
# Check if port 8081 is free
lsof -i :8081

# Should return nothing if port is free
```

## After Killing Process

Once the port is free, restart Metro:

```bash
cd /Users/hrishikeshagashe/Desktop/MyApp
npx react-native start --reset-cache
```

You should see:
```
info Welcome to React Native v0.73
info Starting dev server on port 8081...
```

## Common Causes

1. **Previous Metro bundler not closed** - Always use Ctrl+C to stop Metro
2. **Multiple terminal windows** - Check all terminal windows for running Metro
3. **Crashed process** - Process might have crashed but still holding the port

## Prevention

Always stop Metro bundler properly:
- Press `Ctrl+C` in the terminal running Metro
- Wait for it to fully stop before starting again
- Don't close terminal window while Metro is running


