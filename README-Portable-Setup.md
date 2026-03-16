# DESCON Config Tool - Portable Version Setup Guide

## 📦 Overview

This guide explains how to create a **fully portable version** of the DESCON Config Tool that includes Node.js and Python, requiring **no installation** on target PCs.

---

## 🎯 Benefits

- ✅ **No installation required** - Run directly from USB or network drive
- ✅ **No administrator privileges needed** - Works on restricted PCs
- ✅ **Consistent environment** - Same Node.js and Python versions everywhere
- ✅ **Easy distribution** - Copy folder and run

---

## 📂 Directory Structure

Create the following directory structure:

```
DESCON-Config-Tool-Windows-Portable/
├── DESCON-Universal.bat          ← Main launcher (already modified)
├── app/
├── backend/
├── components/
├── electron/
├── node_modules/
├── package.json
├── portable/                     ← NEW: Portable runtime folder
│   ├── node/                     ← Portable Node.js
│   │   ├── node.exe
│   │   ├── npm.cmd
│   │   └── node_modules/
│   └── python/                   ← Portable Python
│       ├── python.exe
│       ├── python311.dll
│       ├── Lib/
│       ├── DLLs/
│       └── venv/                 ← Python virtual environment (auto-created)
│           └── Scripts/
│               └── python.exe
└── python/                       ← Local venv (for system Python)
    └── venv/
```

---

## 🔧 Setup Instructions

### Step 1: Download Portable Node.js

1. Go to: https://nodejs.org/dist/
2. Download the latest LTS version (e.g., `v20.11.0/node-v20.11.0-win-x64.zip`)
3. Extract the contents to `portable/node/`

**Directory contents should include:**
```
portable/node/
├── node.exe
├── npm
├── npm.cmd
├── npx
├── npx.cmd
└── node_modules/
```

### Step 2: Download Portable Python (Embedded Version)

1. Go to: https://www.python.org/downloads/windows/
2. Download **Windows embeddable package (64-bit)** for Python 3.11
   - Example: `python-3.11.8-embed-amd64.zip`
3. Extract to `portable/python/`

**Directory contents should include:**
```
portable/python/
├── python.exe
├── python311.dll
├── pythonw.exe
├── python311.zip
└── (other DLL files)
```

### Step 3: Configure Portable Python

**Important:** The embedded Python version needs configuration to support `pip` and virtual environments.

1. **Edit `python311._pth` file** in `portable/python/`:
   ```
   python311.zip
   .
   Lib
   Lib/site-packages
   
   # Uncomment to run site.main() automatically
   import site
   ```
   
   **Make sure to uncomment the last line:** `import site`

2. **Download and install pip**:
   ```batch
   cd portable\python
   curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
   python.exe get-pip.py
   ```

3. **Verify pip installation**:
   ```batch
   portable\python\python.exe -m pip --version
   ```

### Step 4: Test Portable Setup

Run the batch file:
```batch
DESCON-Universal.bat
```

You should see:
```
Found portable Node.js and Python - Using bundled versions

========================================
Final Verification
========================================
Mode: PORTABLE
Node.js: D:\path\to\portable\node\node.exe
Python: D:\path\to\portable\python\python.exe
Node.js version: v20.11.0
Python version: Python 3.11.8
```

---

## 📦 Alternative: Use Pre-built Python Virtual Environment

Instead of using embedded Python, you can package a complete Python installation with virtual environment:

### Method A: Full Python Installation (Larger but easier)

1. Install Python 3.11 on your PC normally
2. Copy the entire installation folder to `portable/python/`
3. The batch file will detect and use it automatically

### Method B: Package Existing Virtual Environment (Recommended)

1. Create a virtual environment on your PC:
   ```batch
   python -m venv portable\python\venv
   ```

2. Install required packages:
   ```batch
   portable\python\venv\Scripts\activate
   pip install flask==2.3.3 flask-cors==4.0.0 websockets==11.0.3 pyyaml==6.0.1
   deactivate
   ```

3. Copy the `portable/` folder to target PCs

---

## 💾 Distribution Package Size

| Component | Size (Approx.) |
|-----------|----------------|
| Portable Node.js | ~50 MB |
| Portable Python (embedded) | ~15 MB |
| Python venv + packages | ~50 MB |
| Application files | ~200 MB |
| **Total** | **~315 MB** |

---

## ✅ Verification Checklist

Before distributing, verify:

- [ ] `portable/node/node.exe` exists and runs
- [ ] `portable/node/npm.cmd` exists
- [ ] `portable/python/python.exe` exists and runs
- [ ] `portable/python/python.exe -m pip --version` works
- [ ] `DESCON-Universal.bat` detects portable versions
- [ ] Application starts without errors
- [ ] No administrator privileges required

---

## 🔍 Troubleshooting

### "Portable Node.js not found"
- Verify `portable/node/node.exe` exists
- Check file path in batch file (line 17)

### "Portable Python not found"
- Verify `portable/python/python.exe` exists
- Check file path in batch file (line 18)

### "Python has no module named pip"
- Embedded Python needs pip installation (see Step 3)
- Or use full Python installation instead

### "Failed to create Python virtual environment"
- Embedded Python may not support venv
- Use Method B (package pre-built venv) instead

---

## 🚀 Quick Setup Script (PowerShell)

Save this as `setup-portable.ps1`:

```powershell
# DESCON Portable Setup Script
$nodeVersion = "v20.11.0"
$pythonVersion = "3.11.8"

Write-Host "Setting up portable DESCON environment..." -ForegroundColor Green

# Create directories
New-Item -ItemType Directory -Force -Path "portable\node"
New-Item -ItemType Directory -Force -Path "portable\python"

# Download Node.js
Write-Host "Downloading Node.js $nodeVersion..." -ForegroundColor Yellow
$nodeUrl = "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-win-x64.zip"
$nodeZip = "node-portable.zip"
Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip
Expand-Archive -Path $nodeZip -DestinationPath "portable" -Force
Move-Item "portable\node-$nodeVersion-win-x64\*" "portable\node\" -Force
Remove-Item "portable\node-$nodeVersion-win-x64" -Recurse
Remove-Item $nodeZip

# Download Python
Write-Host "Downloading Python $pythonVersion (embedded)..." -ForegroundColor Yellow
$pythonUrl = "https://www.python.org/ftp/python/$pythonVersion/python-$pythonVersion-embed-amd64.zip"
$pythonZip = "python-portable.zip"
Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonZip
Expand-Archive -Path $pythonZip -DestinationPath "portable\python" -Force
Remove-Item $pythonZip

# Configure Python
Write-Host "Configuring Python..." -ForegroundColor Yellow
$pthFile = "portable\python\python311._pth"
Add-Content -Path $pthFile -Value "import site"

# Download and install pip
Write-Host "Installing pip..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile "portable\python\get-pip.py"
& "portable\python\python.exe" "portable\python\get-pip.py"

Write-Host "✅ Portable setup complete!" -ForegroundColor Green
Write-Host "You can now run DESCON-Universal.bat" -ForegroundColor Cyan
```

Run with:
```powershell
powershell -ExecutionPolicy Bypass -File setup-portable.ps1
```

---

## 📝 Notes

1. **Platform-specific**: This setup is for Windows x64 only
2. **Size optimization**: Use 7-Zip to compress the portable folder
3. **Updates**: When updating Node.js/Python, replace portable folder contents
4. **Security**: Portable versions don't receive automatic security updates

---

## 🆘 Support

If you encounter issues:
1. Check that all files are in correct locations
2. Verify file permissions (especially on USB drives)
3. Test on a clean PC without Node.js/Python installed
4. Check `portable/node/node.exe --version` and `portable/python/python.exe --version`

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-21

