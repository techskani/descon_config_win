# DESCON Config Tool - Portable Setup Script
# This script automatically downloads and configures portable Node.js and Python

param(
    [string]$NodeVersion = "v20.11.0",
    [string]$PythonVersion = "3.11.8"
)

# Color functions
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

Write-Success "========================================="
Write-Success "  DESCON Portable Environment Setup"
Write-Success "========================================="
Write-Info ""
Write-Info "Node.js Version: $NodeVersion"
Write-Info "Python Version: $PythonVersion"
Write-Info ""

# Check internet connection
Write-Info "Checking internet connection..."
try {
    $null = Test-Connection -ComputerName www.google.com -Count 1 -ErrorAction Stop
    Write-Success "✓ Internet connection OK"
} catch {
    Write-Error "✗ No internet connection detected"
    Write-Error "Please connect to the internet and try again."
    exit 1
}

# Create directories
Write-Info ""
Write-Info "Creating directory structure..."
New-Item -ItemType Directory -Force -Path "portable\node" | Out-Null
New-Item -ItemType Directory -Force -Path "portable\python" | Out-Null
Write-Success "✓ Directories created"

# Download Node.js
Write-Info ""
Write-Warning "Downloading Node.js $NodeVersion..."
Write-Info "This may take a few minutes (approx. 30 MB)..."

$nodeUrl = "https://nodejs.org/dist/$NodeVersion/node-$NodeVersion-win-x64.zip"
$nodeZip = "node-portable.zip"

try {
    # Download with progress
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip -UseBasicParsing
    $ProgressPreference = 'Continue'
    
    Write-Success "✓ Node.js downloaded"
    
    # Extract
    Write-Info "Extracting Node.js..."
    Expand-Archive -Path $nodeZip -DestinationPath "portable\temp" -Force
    
    # Move files to correct location
    $extractedFolder = "portable\temp\node-$NodeVersion-win-x64"
    if (Test-Path $extractedFolder) {
        Get-ChildItem -Path $extractedFolder | Move-Item -Destination "portable\node" -Force
    }
    
    # Cleanup
    Remove-Item "portable\temp" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $nodeZip -Force
    
    Write-Success "✓ Node.js extracted successfully"
} catch {
    Write-Error "✗ Failed to download Node.js: $_"
    exit 1
}

# Verify Node.js
if (Test-Path "portable\node\node.exe") {
    $nodeVersionOutput = & "portable\node\node.exe" --version
    Write-Success "✓ Node.js verified: $nodeVersionOutput"
} else {
    Write-Error "✗ Node.js executable not found!"
    exit 1
}

# Download Python
Write-Info ""
Write-Warning "Downloading Python $PythonVersion (embedded version)..."
Write-Info "This may take a few minutes (approx. 10 MB)..."

$pythonUrl = "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip"
$pythonZip = "python-portable.zip"

try {
    # Download with progress
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonZip -UseBasicParsing
    $ProgressPreference = 'Continue'
    
    Write-Success "✓ Python downloaded"
    
    # Extract
    Write-Info "Extracting Python..."
    Expand-Archive -Path $pythonZip -DestinationPath "portable\python" -Force
    Remove-Item $pythonZip -Force
    
    Write-Success "✓ Python extracted successfully"
} catch {
    Write-Error "✗ Failed to download Python: $_"
    exit 1
}

# Configure Python
Write-Info ""
Write-Info "Configuring Python for pip and venv support..."

$pthFile = "portable\python\python311._pth"
if (Test-Path $pthFile) {
    # Read existing content
    $content = Get-Content $pthFile
    
    # Add 'import site' if not present
    if ($content -notcontains "import site") {
        Add-Content -Path $pthFile -Value "`nimport site"
        Write-Success "✓ Python configuration updated"
    } else {
        Write-Info "  Python already configured"
    }
} else {
    Write-Warning "⚠ python311._pth not found - pip may not work correctly"
}

# Download and install pip
Write-Info ""
Write-Warning "Installing pip..."

try {
    $getPipUrl = "https://bootstrap.pypa.io/get-pip.py"
    $getPipPath = "portable\python\get-pip.py"
    
    Invoke-WebRequest -Uri $getPipUrl -OutFile $getPipPath -UseBasicParsing
    Write-Success "✓ get-pip.py downloaded"
    
    Write-Info "Running pip installer..."
    $pipOutput = & "portable\python\python.exe" $getPipPath 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✓ pip installed successfully"
    } else {
        Write-Warning "⚠ pip installation completed with warnings"
    }
    
    # Clean up get-pip.py
    Remove-Item $getPipPath -Force -ErrorAction SilentlyContinue
} catch {
    Write-Error "✗ Failed to install pip: $_"
    Write-Warning "You may need to install pip manually"
}

# Verify Python and pip
Write-Info ""
Write-Info "Verifying installation..."

if (Test-Path "portable\python\python.exe") {
    $pythonVersionOutput = & "portable\python\python.exe" --version 2>&1
    Write-Success "✓ Python verified: $pythonVersionOutput"
    
    # Check pip
    $pipVersionOutput = & "portable\python\python.exe" -m pip --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✓ pip verified: $pipVersionOutput"
    } else {
        Write-Warning "⚠ pip verification failed"
    }
} else {
    Write-Error "✗ Python executable not found!"
    exit 1
}

# Install Python packages directly to portable Python (no venv for true portability)
Write-Info ""
Write-Warning "Installing Python packages to portable Python..."
Write-Info "This will install Flask, WebSockets, and PyYAML..."
Write-Info "(Packages are installed directly for maximum portability)"

try {
    $portablePython = "portable\python\python.exe"
    
    # Check if packages are already installed
    Write-Info "Checking for existing packages..."
    & $portablePython -c "import flask, websockets, yaml" 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Info "Installing packages..."
        
        # Ensure pip is available
        & $portablePython -m pip --version 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Info "Installing pip..."
            & $portablePython -m ensurepip --default-pip 2>&1 | Out-Null
        }
        
        # Install packages
        & $portablePython -m pip install --no-warn-script-location flask==2.3.3 flask-cors==4.0.0 websockets==11.0.3 pyyaml==6.0.1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "✓ Python packages installed successfully"
        } else {
            Write-Warning "⚠ Some packages may have failed to install"
            Write-Info "The batch file will attempt to install them on first run"
        }
    } else {
        Write-Success "✓ Python packages already installed"
    }
} catch {
    Write-Warning "⚠ Package installation failed: $_"
    Write-Info "The batch file will attempt to install them on first run"
}

# Final summary
Write-Info ""
Write-Success "========================================="
Write-Success "  Setup Complete!"
Write-Success "========================================="
Write-Info ""
Write-Info "Portable components installed:"
Write-Success "  ✓ Node.js: portable\node\node.exe"
Write-Success "  ✓ Python: portable\python\python.exe"
Write-Success "  ✓ Python packages: Installed directly (no venv for portability)"
Write-Info ""
Write-Info "Directory structure:"
Write-Info "  DESCON-Config-Tool-Windows-Portable\"
Write-Info "  ├── portable\"
Write-Info "  │   ├── node\     (Node.js runtime)"
Write-Info "  │   └── python\   (Python runtime + packages)"
Write-Info "  ├── DESCON-Universal.bat"
Write-Info "  └── (other application files)"
Write-Info ""
Write-Success "You can now run DESCON-Universal.bat"
Write-Info "The application will use the portable versions automatically."
Write-Info ""
Write-Success "✨ FULLY PORTABLE: Copy this entire folder to any Windows PC!"
Write-Info "No installation required. No admin rights needed."
Write-Info ""

# Offer to run the application
$response = Read-Host "Would you like to run DESCON-Universal.bat now? (Y/N)"
if ($response -eq "Y" -or $response -eq "y") {
    Write-Info ""
    Write-Info "Starting DESCON Config Tool..."
    Start-Process -FilePath "DESCON-Universal.bat" -Wait
} else {
    Write-Info ""
    Write-Info "Setup complete. Run DESCON-Universal.bat when ready."
}

