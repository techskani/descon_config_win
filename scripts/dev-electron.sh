#!/bin/bash

echo "Starting Electron app in development mode..."

# Check if Python backend is running
if ! pgrep -f "python.*server.py" > /dev/null; then
    echo "Starting Python backend..."
    cd backend
    python3 server.py &
    PYTHON_PID=$!
    cd ..
    echo "Python backend started with PID: $PYTHON_PID"
else
    echo "Python backend is already running"
fi

# Start Electron app in development mode
npm run electron-dev

# Clean up Python process when script exits
trap "kill $PYTHON_PID 2>/dev/null" EXIT 