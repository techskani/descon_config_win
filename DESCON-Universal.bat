@echo off
title DESCON Config Tool - Universal
echo.
echo ========================================
echo   DESCON Config Tool - Universal
echo ========================================
echo.
echo This tool will automatically install all required software
echo and start the DESCON Config Tool on any PC.
echo.

REM Get current directory
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Check for portable Node.js and Python first
set "PORTABLE_NODE=portable\node\node.exe"
set "PORTABLE_PYTHON=portable\python\python.exe"
set "USE_PORTABLE=0"

if exist "%PORTABLE_NODE%" (
    if exist "%PORTABLE_PYTHON%" (
        echo Found portable Node.js and Python - Using bundled versions
        set "USE_PORTABLE=1"
        goto :start_application
    )
)

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Not running as administrator!
    echo.
    echo Automatic software installation will be skipped.
    echo.
    echo If Node.js and Python are already installed, press any key to continue.
    echo If not installed, please:
    echo   1. Close this window
    echo   2. Right-click this file
    echo   3. Select "Run as administrator"
    echo.
    echo OR: Use the portable version (see documentation)
    echo.
    pause
    goto :limited_mode
)

echo Running as administrator - OK
echo.

REM System information
echo ========================================
echo System Information
echo ========================================
echo OS: %OS%
echo Processor: %PROCESSOR_ARCHITECTURE%
echo User: %USERNAME%
echo Directory: %CD%
echo.

REM Check and install Node.js
echo ========================================
echo Checking Node.js...
echo ========================================
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js not found. Installing...
    echo.
    
    REM Try multiple installation methods
    set "NODE_INSTALLED=0"
    
    REM Method 1: Try Chocolatey
    where choco >nul 2>nul
    if %errorlevel% equ 0 (
        echo Installing Node.js using Chocolatey...
        choco install nodejs-lts -y
        timeout /t 5 /nobreak >nul
        call refreshenv
        where node >nul 2>nul
        if %errorlevel% equ 0 (
            set "NODE_INSTALLED=1"
            echo Node.js installed successfully via Chocolatey
        )
    )
    
    REM Method 2: Try winget
    if %NODE_INSTALLED% equ 0 (
        where winget >nul 2>nul
        if %errorlevel% equ 0 (
            echo Installing Node.js using winget...
            winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
            timeout /t 5 /nobreak >nul
            call refreshenv
            where node >nul 2>nul
            if %errorlevel% equ 0 (
                set "NODE_INSTALLED=1"
                echo Node.js installed successfully via winget
            )
        )
    )
    
    REM Method 3: Manual download
    if %NODE_INSTALLED% equ 0 (
        echo Installing Node.js via manual download...
        powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile 'nodejs-installer.msi'}"
        
        if exist "nodejs-installer.msi" (
            msiexec /i nodejs-installer.msi /quiet /norestart
            timeout /t 10 /nobreak >nul
            call refreshenv
            where node >nul 2>nul
            if %errorlevel% equ 0 (
                set "NODE_INSTALLED=1"
                echo Node.js installed successfully via manual download
            )
            del nodejs-installer.msi
        )
    )
    
    if %NODE_INSTALLED% equ 0 (
        echo Node.js installation failed
        goto :manual_install_instructions
    )
) else (
    echo Node.js already installed
)

REM Check and install Python
echo.
echo ========================================
echo Checking Python...
echo ========================================
where py >nul 2>nul
if %errorlevel% neq 0 (
    where python >nul 2>nul
    if %errorlevel% neq 0 (
        where python3 >nul 2>nul
        if %errorlevel% neq 0 (
            echo Python not found. Installing...
            echo.
            
            set "PYTHON_INSTALLED=0"
            
            REM Method 1: Try Chocolatey
            where choco >nul 2>nul
            if %errorlevel% equ 0 (
                echo Installing Python using Chocolatey...
                choco install python -y
                timeout /t 5 /nobreak >nul
                call refreshenv
                where py >nul 2>nul
                if %errorlevel% equ 0 (
                    set "PYTHON_INSTALLED=1"
                    echo Python installed successfully via Chocolatey
                ) else (
                    where python >nul 2>nul
                    if %errorlevel% equ 0 (
                        set "PYTHON_INSTALLED=1"
                        echo Python installed successfully via Chocolatey
                    )
                )
            )
            
            REM Method 2: Try winget
            if %PYTHON_INSTALLED% equ 0 (
                where winget >nul 2>nul
                if %errorlevel% equ 0 (
                    echo Installing Python using winget...
                    winget install Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
                    timeout /t 5 /nobreak >nul
                    call refreshenv
                    where py >nul 2>nul
                    if %errorlevel% equ 0 (
                        set "PYTHON_INSTALLED=1"
                        echo Python installed successfully via winget
                    ) else (
                        where python >nul 2>nul
                        if %errorlevel% equ 0 (
                            set "PYTHON_INSTALLED=1"
                            echo Python installed successfully via winget
                        )
                    )
                )
            )
            
            REM Method 3: Manual download
            if %PYTHON_INSTALLED% equ 0 (
                echo Installing Python via manual download...
                powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.8/python-3.11.8-amd64.exe' -OutFile 'python-installer.exe'}"
                
                if exist "python-installer.exe" (
                    python-installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
                    timeout /t 15 /nobreak >nul
                    call refreshenv
                    where py >nul 2>nul
                    if %errorlevel% equ 0 (
                        set "PYTHON_INSTALLED=1"
                        echo Python installed successfully via manual download
                    ) else (
                        where python >nul 2>nul
                        if %errorlevel% equ 0 (
                            set "PYTHON_INSTALLED=1"
                            echo Python installed successfully via manual download
                        )
                    )
                    del python-installer.exe
                )
            )
            
            if %PYTHON_INSTALLED% equ 0 (
                echo Python installation failed
                goto :manual_install_instructions
            )
        ) else (
            echo Python already installed (python3)
        )
    ) else (
        echo Python already installed (python)
    )
) else (
    echo Python already installed (py launcher)
)

goto :start_application

:limited_mode
echo.
echo ========================================
echo Running in Limited Mode
echo ========================================
echo Skipping automatic software installation.
echo.
echo Checking for existing Node.js and Python...
echo.

REM Check Node.js in limited mode
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found!
    echo Please install Node.js manually:
    echo - Visit: https://nodejs.org/
    echo - Download: LTS version
    echo - Install with "Add to PATH" option checked
    echo.
) else (
    for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js found: %%i
)

REM Check Python in limited mode
set "PYTHON_FOUND=0"
where py >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('py --version 2^>^&1') do echo [OK] Python found: %%i
    set "PYTHON_FOUND=1"
) else (
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo [OK] Python found: %%i
        set "PYTHON_FOUND=1"
    ) else (
        where python3 >nul 2>nul
        if %errorlevel% equ 0 (
            for /f "tokens=*" %%i in ('python3 --version 2^>^&1') do echo [OK] Python found: %%i
            set "PYTHON_FOUND=1"
        )
    )
)

if %PYTHON_FOUND% equ 0 (
    echo [ERROR] Python not found!
    echo Please install Python manually:
    echo - Visit: https://www.python.org/downloads/
    echo - Download: Python 3.7 or newer
    echo - Install with "Add Python to PATH" option checked
    echo.
)

REM Check if both are missing
where node >nul 2>nul
if %errorlevel% neq 0 (
    if %PYTHON_FOUND% equ 0 (
        echo ========================================
        echo INSTALLATION REQUIRED
        echo ========================================
        echo Both Node.js and Python are missing.
        echo.
        echo Please install them, then run this script again as administrator.
        echo.
        pause
        exit /b 1
    )
)

echo.

:start_application
REM Final verification
echo.
echo ========================================
echo Final Verification
echo ========================================

REM Check if using portable version
if %USE_PORTABLE% equ 1 (
    echo Mode: PORTABLE
    echo Node.js: %PORTABLE_NODE%
    echo Python: %PORTABLE_PYTHON%
    
    REM Verify portable files exist
    if not exist "%PORTABLE_NODE%" (
        echo ERROR: Portable Node.js not found at %PORTABLE_NODE%
        goto :manual_install_instructions
    )
    if not exist "%PORTABLE_PYTHON%" (
        echo ERROR: Portable Python not found at %PORTABLE_PYTHON%
        goto :manual_install_instructions
    )
    
    REM Set paths for portable version
    set "NODE_CMD=%PORTABLE_NODE%"
    set "NPM_CMD=portable\node\npm.cmd"
    set "PYTHON_CMD=%PORTABLE_PYTHON%"
    
    REM Get versions
    for /f "tokens=*" %%i in ('"%NODE_CMD%" --version 2^>nul') do echo Node.js version: %%i
    for /f "tokens=*" %%i in ('"%PYTHON_CMD%" --version 2^>nul') do echo Python version: %%i
    
) else (
    echo Mode: SYSTEM
    
    where node >nul 2>nul
    if %errorlevel% neq 0 (
        echo ERROR: Node.js not found
        goto :manual_install_instructions
    ) else (
        set "NODE_CMD=node"
        set "NPM_CMD=npm"
        for /f "tokens=*" %%i in ('node --version') do echo Node.js: %%i
    )

    where npm >nul 2>nul
    if %errorlevel% neq 0 (
        echo ERROR: npm not found
        goto :manual_install_instructions
    ) else (
        for /f "tokens=*" %%i in ('npm --version') do echo npm: %%i
    )

    set "PYTHON_CMD="
    where py >nul 2>nul
    if %errorlevel% equ 0 (
        set "PYTHON_CMD=py -3"
        for /f "tokens=*" %%i in ('py --version 2^>^&1') do echo Python: %%i
    ) else (
        where python >nul 2>nul
        if %errorlevel% equ 0 (
            set "PYTHON_CMD=python"
            for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo Python: %%i
        ) else (
            where python3 >nul 2>nul
            if %errorlevel% equ 0 (
                set "PYTHON_CMD=python3"
                for /f "tokens=*" %%i in ('python3 --version 2^>^&1') do echo Python: %%i
            ) else (
                echo ERROR: Python not found
                goto :manual_install_instructions
            )
        )
    )
)

echo.
echo ========================================
echo Starting DESCON Config Tool
echo ========================================
echo.

REM Kill existing processes on ports 3002 and 8765
echo Checking ports...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM Build Python environment if needed
echo Building Python environment...

if %USE_PORTABLE% equ 1 (
    REM Portable mode - use portable Python directly (no venv for true portability)
    echo Mode: PORTABLE - Using portable Python directly
    set "PYTHON_VENV=%PORTABLE_PYTHON%"
    echo Python executable: %PYTHON_VENV%
    
    REM Check if required packages are installed
    echo Checking Python packages...
    "%PYTHON_VENV%" -c "import flask, websockets, yaml" >nul 2>&1
    if %errorlevel% neq 0 (
        echo Python packages not found. Installing...
        echo This may take a few minutes...
        
        REM Install pip if not available
        "%PYTHON_VENV%" -m pip --version >nul 2>&1
        if %errorlevel% neq 0 (
            echo Installing pip...
            "%PYTHON_VENV%" -m ensurepip --default-pip >nul 2>&1
        )
        
        REM Install required packages
        echo Installing Flask, WebSockets, and PyYAML...
        "%PYTHON_VENV%" -m pip install --no-warn-script-location flask==2.3.3 flask-cors==4.0.0 websockets==11.0.3 pyyaml==6.0.1
        
        if %errorlevel% neq 0 (
            echo.
            echo ERROR: Failed to install Python packages
            echo.
            echo This may be due to embedded Python limitations.
            echo Please use full Python installation for portable version.
            echo.
            pause
            exit /b 1
        )
        echo Python packages installed successfully
    ) else (
        echo Python packages already installed - OK
    )
    
    REM IMPORTANT: Skip system venv check in portable mode
    echo Portable mode: Skipping system venv check
    goto :start_backend
)

REM System mode - use local venv
echo Mode: SYSTEM - Using local virtual environment
if not exist "python\venv\Scripts\python.exe" (
    echo Creating Python virtual environment...
    %PYTHON_CMD% -m venv python\venv
    if %errorlevel% neq 0 (
        echo Failed to create Python virtual environment
        pause
        exit /b 1
    )
    
    echo Installing Python packages...
    call python\venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    python -m pip install flask==2.3.3 flask-cors==4.0.0 websockets==11.0.3 pyyaml==6.0.1
    if %errorlevel% neq 0 (
        echo Failed to install Python packages
        pause
        exit /b 1
    )
    call deactivate
    echo Python environment built successfully
) else (
    echo Python environment already exists
)
set "PYTHON_VENV=python\venv\Scripts\python.exe"

:start_backend

REM Start Python backend server
echo Starting Python backend server...
cd backend
start /b "" "..\%PYTHON_VENV%" server.py
cd ..

REM Wait for Python server to start
echo Waiting for server to start...
timeout /t 5 /nobreak >nul

REM Check if Python server started
netstat -ano | findstr ":8765" | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo Failed to start Python backend server
    pause
    exit /b 1
)

echo Python backend server started

REM Start Electron app
echo Starting Electron app...
set "NODE_ENV=production"
set "DESCON_EXTERNAL_PY=1"

if %USE_PORTABLE% equ 1 (
    set "DESCON_PYTHON_CMD=%PORTABLE_PYTHON%"
    "%NODE_CMD%" node_modules\electron\cli.js .
) else (
    set "DESCON_PYTHON_CMD=python\venv\Scripts\python.exe"
    node node_modules\electron\cli.js .
)

REM Cleanup
echo Cleaning up...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8765" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Application closed
pause
goto :end

:manual_install_instructions
echo.
echo ========================================
echo Manual Installation Required
echo ========================================
echo.
echo Automatic installation failed. Please install manually:
echo.
echo 1. Node.js LTS:
echo    - Go to https://nodejs.org/
echo    - Download LTS version
echo    - Install with "Add to PATH" checked
echo.
echo 2. Python 3.7+:
echo    - Go to https://www.python.org/downloads/
echo    - Download latest Python 3
echo    - Install with "Add Python to PATH" checked
echo.
echo After installation, restart this script.
echo.
pause
exit /b 1

:end
echo Setup complete!
pause

