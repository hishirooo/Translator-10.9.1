
export const APP_VERSION = "10.9.1";
export const APP_AUTHOR = "Nguyễn Trí Hiếu";
export const APP_NAME = "Dịch & Biên Tập Truyện";
export const APP_FULL_TITLE = `${APP_NAME} v${APP_VERSION}`;

export interface ChangeLogEntry {
    version: string;
    title: string;
    isLatest?: boolean;
    changes: {
        icon: string;
        bold: string;
        text: string;
    }[];
}

export const CHANGELOG_DATA: ChangeLogEntry[] = [
    {
        version: "10.9.1",
        title: "Pronoun Matrix Update",
        isLatest: true,
        changes: [
            {
                icon: "Users",
                bold: "Pronoun Matrix:",
                text: "Cập nhật cấu trúc phân tích quan hệ nhân vật chi tiết (Thân phận, Tính cách, Ma trận xưng hô chéo) trong Auto Analysis."
            },
            {
                icon: "GitCommit",
                bold: "Improved Merge:",
                text: "Tối ưu hóa thuật toán hợp nhất ngữ cảnh để giữ lại thông tin xưng hô chi tiết."
            }
        ]
    },
    {
        version: "10.9.0",
        title: "Re-Architecture & New Guide",
        changes: [
            {
                icon: "Book",
                bold: "New User Guide:",
                text: "Viết lại hoàn toàn Hướng dẫn sử dụng. Quy trình 4 bước chuẩn hóa từ A-Z cho người mới bắt đầu (Newbie Friendly)."
            },
            {
                icon: "Zap",
                bold: "Smart Auto 2.0:",
                text: "Nút AUTO giờ đây thông minh hơn: Tự động bỏ qua các bước 1, 2, 3 nếu phát hiện đã có Metadata, Context hoặc Prompt. Tự động chuyển sang bước Dịch/Fix."
            },
            {
                icon: "Scale",
                bold: "Smart Fix (Ratio Check):",
                text: "Cơ chế phát hiện lỗi dịch thiếu/ngắn (Low Ratio) dựa trên mật độ ngôn ngữ (Tiếng Trung/Anh). Tự động đưa vào hàng đợi Dịch Lại."
            },
            {
                icon: "ShieldCheck",
                bold: "Anti-Hallucination ID:",
                text: "Nâng cấp Regex (Word Boundary) để ngăn chặn việc nhầm lẫn ID file (Ví dụ: Không còn nhầm FILE_1 với FILE_10)."
            },
            {
                icon: "Wrench",
                bold: "Prompt Architect UI:",
                text: "Giao diện thiết kế Prompt mới, cho phép tùy chỉnh sâu hơn các quy tắc dịch thuật."
            }
        ]
    },
    {
        version: "10.8.9",
        title: "Smart Wait & Stats Realtime",
        changes: [
            {
                icon: "Clock",
                bold: "Smart Cooldown UI:",
                text: "Hệ thống tự động hiển thị thời gian chờ (Countdown) ngay trên Badge của từng Model khi bị quá tải RPM."
            },
            {
                icon: "Activity",
                bold: "Real-time Stats:",
                text: "Sửa lỗi thống kê (Stats) hiển thị 0/0. Số liệu cập nhật thời gian thực."
            }
        ]
    },
    {
        version: "10.8.8",
        title: "Regex Engine & Dict Enforcement",
        changes: [
            {
                icon: "Microscope",
                bold: "Universal Regex Splitter:",
                text: "Bộ tách chương đa ngôn ngữ mới. Hỗ trợ tốt hơn cho tiếng Anh, Trung, Nhật."
            }
        ]
    }
];
