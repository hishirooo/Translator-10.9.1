@echo off
chcp 65001 >nul
echo ========================================
echo   SETUP - AI STUDIO APP
echo ========================================
echo.

:: Kiểm tra Node.js
echo [1/3] Kiểm tra Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ KHÔNG tìm thấy Node.js!
    echo.
    echo Vui lòng cài đặt Node.js từ: https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Đã tìm thấy Node.js %NODE_VERSION%
echo.

:: Cài đặt dependencies
echo [2/3] Đang cài đặt dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Cài đặt thất bại!
    pause
    exit /b 1
)
echo ✅ Cài đặt thành công!
echo.

:: Kiểm tra API Key
echo [3/3] Kiểm tra cấu hình API Key...
findstr /C:"PLACEHOLDER_API_KEY" .env.local >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo ⚠️  CẢNH BÁO: API Key vẫn đang là PLACEHOLDER!
    echo.
    echo Bạn cần thay đổi GEMINI_API_KEY trong file .env.local
    echo.
    echo Bước 1: Lấy API key từ: https://aistudio.google.com/apikey
    echo Bước 2: Mở file .env.local
    echo Bước 3: Thay PLACEHOLDER_API_KEY bằng API key thật
    echo.
    choice /C YN /M "Bạn có muốn mở file .env.local ngay bây giờ không"
    if !errorlevel! equ 1 (
        notepad .env.local
        echo.
        echo ✅ Vui lòng lưu file sau khi chỉnh sửa!
    )
) else (
    echo ✅ API Key đã được cấu hình!
)

echo.
echo ========================================
echo   SETUP HOÀN TẤT!
echo ========================================
echo.
echo Chạy "start.bat" để khởi động ứng dụng
echo.
pause
