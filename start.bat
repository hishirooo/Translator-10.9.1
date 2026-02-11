@echo off
chcp 65001 >nul
echo ========================================
echo   KHỞI ĐỘNG - AI STUDIO APP
echo ========================================
echo.

:: Kiểm tra Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ KHÔNG tìm thấy Node.js!
    echo Vui lòng chạy setup.bat trước
    pause
    exit /b 1
)

:: Kiểm tra node_modules
if not exist "node_modules\" (
    echo ⚠️  Chưa cài đặt dependencies!
    echo.
    choice /C YN /M "Bạn có muốn chạy setup.bat ngay bây giờ không"
    if !errorlevel! equ 1 (
        call setup.bat
    ) else (
        echo.
        echo Vui lòng chạy setup.bat trước khi start
        pause
        exit /b 1
    )
)

:: Kiểm tra API Key
echo [Kiểm tra] Đang xác thực API Key...
findstr /C:"PLACEHOLDER_API_KEY" .env.local >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo ❌ API Key chưa được cấu hình!
    echo.
    echo Vui lòng:
    echo 1. Lấy API key từ: https://aistudio.google.com/apikey
    echo 2. Mở file .env.local
    echo 3. Thay PLACEHOLDER_API_KEY bằng API key thật
    echo.
    choice /C YN /M "Bạn có muốn mở file .env.local ngay bây giờ không"
    if !errorlevel! equ 1 (
        notepad .env.local
        echo.
        echo ✅ Đã lưu file? Nhấn phím bất kỳ để tiếp tục...
        pause >nul
    ) else (
        pause
        exit /b 1
    )
)

echo ✅ API Key hợp lệ!
echo.
echo ========================================
echo   ĐANG KHỞI ĐỘNG SERVER...
echo ========================================
echo.
echo 🚀 Server sẽ chạy tại: http://localhost:3000
echo 📝 Nhấn Ctrl+C để dừng server
echo.

:: Đợi 3 giây rồi mở browser
start /B cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: Chạy dev server
call npm run dev

pause
