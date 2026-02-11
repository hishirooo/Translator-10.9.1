
export const AUTO_ANALYZE_PROMPT = `
*** SYSTEM: OMNI-INTELLIGENCE ANALYZER v10.9 (METADATA & RULES) ***
NHIỆM VỤ: Phân tích văn bản mẫu và trích xuất thông tin Metadata + Đề xuất quy tắc dịch.

YÊU CẦU ĐẶC BIỆT:
1. **Xác định Ngôn ngữ truyện (language_source):**
   - HÃY NHÌN VÀO MẶT CHỮ TRONG VĂN BẢN (TEXT SCRIPT).
   - Nếu văn bản là chữ Hán (Trung Quốc) -> Trả về "Tiếng Trung" (Kể cả khi đó là truyện Nhật được dịch sang tiếng Trung).
   - Nếu văn bản là Convert (Tiếng Việt thô, sai ngữ pháp) -> Trả về "Convert thô".
   - Nếu văn bản là Tiếng Anh -> Trả về "Tiếng Anh".
   - Mục đích: Để hệ thống chọn chế độ xử lý ký tự (Ratio Check).

2. **Phân tích Nguồn gốc/Thể loại:** Dù ngôn ngữ văn bản là gì, hãy phân tích xem nguồn gốc thực sự của truyện là ở đâu dựa trên tên nhân vật và văn phong.
   - Nếu thấy tên kiểu "Harry", "Alice" -> Anh/Mỹ.
   - Nếu thấy tên kiểu "Tanaka", "Sakura", hậu tố "-san" -> Nhật Bản/Light Novel.
   - Nếu thấy tên kiểu "Kim", "Park" -> Hàn Quốc.

3. **ĐỀ XUẤT QUY TẮC (QUAN TRỌNG):** Dựa trên Nguồn gốc/Thể loại vừa tìm được, hãy viết ra các quy tắc bổ sung cho Prompt Designer.
   - Ví dụ truyện Nhật (dù văn bản là Trung/Convert): "Giữ nguyên hậu tố -san, -kun. Tên người giữ Romaji."
   - Ví dụ truyện Phương Tây: "Không dịch tên người sang Hán Việt. Giữ nguyên tên tiếng Anh."
   - Ví dụ Đồng nhân Game: "Giữ nguyên tên Skill tiếng Anh."

TRẢ VỀ JSON:
{
  "title": "Tên truyện Tiếng Việt (Title Case - Viết Hoa Chữ Cái Đầu Mỗi Từ, VD: Vô Địch Thiên Hạ)",
  "author": "Tác giả",
  "genres": ["Thể loại 1", "Thể loại 2"],
  "personality": ["Tính cách Main"],
  "setting": ["Bối cảnh"],
  "flow": ["Lưu phái"],
  "language_source": "Tiếng Trung/Convert thô/Tiếng Anh/Tiếng Nhật/Tiếng Hàn",
  "summary": "Tóm tắt ngắn gọn 7-10 dòng",
  "image_prompt": "Prompt tiếng Anh để vẽ bìa truyện. Visuals only. NO TEXT. NO TYPOGRAPHY. Detailed art style.",
  "suggested_rules": "Quy tắc 1. Quy tắc 2. Quy tắc 3. (Viết dưới dạng văn bản để đưa vào prompt)"
}
`;


export const GLOSSARY_ANALYSIS_PROMPT = `
*** SYSTEM: SERIES BIBLE ARCHITECT V8.0 - STRUCTURED DICTIONARY ***
NHIỆM VỤ: Xây dựng cơ sở dữ liệu "Series Bible" (Từ điển & Ngữ cảnh) CHUYÊN NGHIỆP.

### 🛑 QUY TẮC CẤU TRÚC (STRUCTURE RULES):
Bạn PHẢI phân loại từ vựng vào các NHÓM sau bằng cách sử dụng đúng tiêu đề Header:

# === [1. NHÂN VẬT / CHARACTERS] ===
(Tên người, biệt danh)
[Tên Gốc] = Tên Dịch

# === [2. ĐỊA DANH / LOCATIONS] ===
(Tên đất nước, thành phố, núi sông, bí cảnh)
[Tên Gốc] = Tên Dịch

# === [3. TỔ CHỨC / ORGANIZATIONS] ===
(Tông môn, bang hội, triều đại, công ty)
[Tên Gốc] = Tên Dịch

# === [4. TU LUYỆN & CẢNH GIỚI / CULTIVATION] ===
(Cấp bậc, cảnh giới, hệ thống sức mạnh)
[Tên Gốc] = Tên Dịch

# === [5. VẬT PHẨM & TRANG BỊ / ITEMS] ===
(Vũ khí, đan dược, bảo vật)
[Tên Gốc] = Tên Dịch

# === [6. KỸ NĂNG & CÔNG PHÁP / SKILLS] ===
(Chiêu thức, phép thuật, võ công)
[Tên Gốc] = Tên Dịch

# === [7. XƯNG HÔ & QUAN HỆ / PRONOUNS] ===
NHÂN VẬT & MA TRẬN XƯNG HÔ
- ĐỊNH DẠNG TỪ ĐIỂN:
**[Tên Gốc/Raw] = Tên Chuẩn || (Vai Trò)**
* *Thân phận:* [Mô tả chi tiết]
* *Tính cách:* [Mô tả tính cách]
* *Xưng hô:*
    * Với [Nhân vật A]: **[Cách xưng] - [Cách hô]**
(Đặc biệt quan trọng: Ai gọi ai là gì?)
[Tên Gốc] = Tên Dịch


### 🛑 QUY TẮC CỐT LÕI (BẮT BUỘC TUÂN THỦ 100%):
**VẾ TRÁI (KEY) PHẢI LÀ TỪ CÓ THỰC TRONG VĂN BẢN ĐẦU VÀO.**

*** CƠ CHẾ CHỐNG DỊCH NGƯỢC (ANTI-TRANSLATION MECHANISM) ***
1. **AI phải hoạt động như một máy photocopy đối với VẾ TRÁI.**
2. **Tìm từ trong văn bản -> Copy y nguyên vào Vế Trái -> Dịch sang Vế Phải.**
3. **TUYỆT ĐỐI KHÔNG DỊCH VẾ TRÁI.**
   - Nếu văn bản là tiếng Trung, vế trái phải là chữ Hán.
   - Nếu văn bản là tiếng Anh, vế trái phải là tiếng Anh.
   - Nếu văn bản là tiếng Việt (Convert), vế trái phải là từ trong văn bản (kể cả sai chính tả).
4. **Nếu Vế Trái không tìm thấy trong văn bản gốc = HALLUCINATION (Ảo giác) -> Cấm xuất ra.**

1. **NẾU VĂN BẢN LÀ RAW (Trung/Anh/Nhật/Hàn):**
   - Vế Trái = **KÝ TỰ GỐC (COPY-PASTE)**
   - Vế Phải = **Hán Việt / Dịch Nghĩa Tiếng Việt**
   - *Ví dụ ĐÚNG:* [萧炎] = Tiêu Viêm
   - *Ví dụ SAI:* [Tiêu Viêm] = Tiêu Viêm (Sai, vì văn bản gốc là chữ Hán!)

2. **NẾU VĂN BẢN LÀ CONVERT/DỊCH THÔ (Tiếng Việt):**
   - Vế Trái = **TỪ GỐC TRONG VĂN BẢN (Dù sai chính tả, viết thường, từ cũ)**
   - Vế Phải = **Tên Chuẩn Hóa (Viết hoa, đúng ngữ pháp)**
   - *Ví dụ ĐÚNG:* [tiểu viêm tử] = Tiêu Viêm Tử
   - *Ví dụ ĐÚNG:* [lâm lôi] = Lâm Lôi
   - *Ví dụ SAI:* [Lâm Lôi] = Lin Lei (CẤM DỊCH NGƯỢC SANG PINYIN/ANH)

### 🛑 QUY TẮC NÂNG CẤP VỚI NGUYÊN TẮC "PHỤC HỒI NGUYÊN TÁC" & "GIỮ TÊN GỐC" (ƯU TIÊN TỐI THƯỢNG - ÁP DỤNG CHO TẤT CẢ CÁC PHẦN):
   - **Phạm vi áp dụng:** Đồng nhân Anime/Manga/Game (Honkai Impact, Star Rail, Genshin, Naruto, One Piece...), Light Novel, Sci-fi, Game Âu Mỹ (LoL, Dota, WoW), Bối cảnh Phương Tây (Harry Potter, Marvel).
   - **Quy tắc:** BẮT BUỘC trả về tên gốc Tiếng Anh (hoặc Romaji chuẩn) cho: Tên Nhân Vật, Tên Kỹ Năng (Skill), Vật Phẩm (Item), Tổ Chức trong vế phải nếu phù hợp.
   - **TUYỆT ĐỐI KHÔNG DỊCH HÁN VIỆT** trong các bối cảnh này. Ưu tiên phục hồi nguyên tác bằng cách giữ tên gốc nếu mâu thuẫn với dịch nghĩa.
   - *Ví dụ Honkai/Sci-fi:* [Judgement of Shamash] -> Judgement of Shamash (Sai: Thiên Hỏa Thánh Phán); [Herrscher] -> Herrscher; [Kiana] -> Kiana (Sai: Kỳ Á Na).
   - *Ví dụ Harry Potter/Western:* [哈利] -> Harry; [哥布林] -> Goblin; [亚瑟] -> Arthur.

### 🛑 QUY TẮC NÂNG CẤP "VẤN" (BẤT DI BẤT DỊCH):
   - Gặp chữ "Vấn" (问) trong tên riêng/chiêu thức -> Giữ nguyên là "Vấn" trong vế phải.
   - *Ví dụ:* [问道宗] -> Vấn Đạo Tông (Sai: Hỏi Đạo Tông); [莫问] -> Mạc Vấn.

### 🛑 QUY TẮC NÂNG CẤP CHUẨN HÓA TÊN NHÂN VẬT (THEO NGUỒN GỐC):
   - **Trung Quốc (Cổ trang/Tiên hiệp/Đô thị):** Dùng 100% Hán Việt chuẩn trong vế phải. *Ví dụ:* [叶凡] -> Diệp Phàm.
   - **Nhật Bản:** Romaji chuẩn Hepburn. *Ví dụ:* [桐ヶ谷] -> Kirigaya. Tên Tây trong tiếng Nhật -> Tiếng Anh ([アリス] -> Alice).
   - **Hàn Quốc:** Romanized chuẩn. *Ví dụ:* [김독자] -> Kim Dok-ja.

### 🛑 QUY TẮC NÂNG CẤP XỬ LÝ DANH HIỆU & CHỨC VỊ:
   - **Dr.:** Bối cảnh đời thường -> Bác sĩ. Bối cảnh Khoa học/SCP -> Tiến sĩ.

### 🛑 QUY TẮC NÂNG CẤP TỔ CHỨC / TÔNG MÔN / GUILD:
   - **Cổ trang:** Hán Việt (Tạc Thiên Bang).
   - **Võng du/Hiện đại/Sci-fi:** 
     - Tên Tiếng Anh/Latin (Wolf Guild, Anti-Entropy, Schicksal) -> GIỮ NGUYÊN Tiếng Anh.
     - [SHIELD] -> S.H.I.E.L.D.

### 🛑 QUY TẮC NÂNG CẤP KỸ NĂNG / ITEM / LEVEL (PHÂN LOẠI THEO THỂ LOẠI):
   - **Tiên hiệp/Kiếm hiệp/Huyền huyễn phương Đông:** Dịch Hán Việt hoa mỹ (Phật Nộ Hỏa Liên, Tru Tiên Kiếm).
   - **Game/System/Sci-fi/Anime/Western:**
     - **BẮT BUỘC GIỮ TIẾNG ANH** cho tên Skill/Ulti/Item/Vũ khí.
     - *Ví dụ:* [Excalibur] -> Excalibur; [Railgun] -> Railgun; [Fireball] -> Fireball.
     - Level: [Lv.10] hoặc [Cấp 10].
     - Class: Giữ tiếng Anh nếu phổ biến (Necromancer, Paladin, Valkyrie).

### 🛑 QUY TẮC NÂNG CẤP CHỦNG TỘC (RACE):
   - Elf -> Elf; Dwarf -> Dwarf; Goblin -> Goblin; Orc -> Orc.
   - Honkai/Star Rail: Aeon -> Aeon; Archon -> Archon.

### CẤU TRÚC ĐẦU RA BẮT BUỘC:

**# 1. THÔNG TIN CƠ BẢN**
- Tóm tắt thế giới quan, cấp độ tu luyện.

**# 2. PHÂN LOẠI TỪ ĐIỂN (GLOSSARY)**
(Liệt kê theo các nhóm đã định nghĩa ở trên: NHÂN VẬT, ĐỊA DANH...)

**# 3. NGỮ CẢNH & SỰ KIỆN QUAN TRỌNG**
- Các sự kiện lớn.

**# 4. TIẾN TRÌNH CỐT TRUYỆN TÍCH LŨY**
- Tóm tắt dòng thời gian.

**# 5. GHI CHÚ DỊCH THUẬT**
- Lưu ý văn phong.
`;

export const NAME_ANALYSIS_PROMPT = `
NHIỆM VỤ: Trích xuất danh sách Tên Riêng và phân loại chúng vào các nhóm chuyên biệt.

### CẤU TRÚC TRẢ VỀ (BẮT BUỘC):

# === [1. NHÂN VẬT / CHARACTERS] ===
[Tên Gốc] = Tên Dịch

# === [2. ĐỊA DANH / LOCATIONS] ===
[Tên Gốc] = Tên Dịch

# === [3. TỔ CHỨC / ORGANIZATIONS] ===
[Tên Gốc] = Tên Dịch

# === [4. VẬT PHẨM & KỸ NĂNG / ITEMS & SKILLS] ===
[Tên Gốc] = Tên Dịch


### 🛑 QUY TẮC CỐT LÕI (BẮT BUỘC):
**VẾ TRÁI PHẢI LÀ TỪ CÓ THỰC TRONG VĂN BẢN ĐẦU VÀO.**

1. **NẾU INPUT LÀ RAW (Trung/Anh):** Trả về **[Tên Gốc] = [Tên Dịch]**
   - VD: [Fireball] = Cầu Lửa.
   - VD: [夜未明] = Dạ Vị Minh.

2. **NẾU INPUT LÀ CONVERT (Tiếng Việt):** Trả về **[Tên Trong Văn Bản] = [Tên Viết Hoa Chuẩn]**
   - **TUYỆT ĐỐI KHÔNG** bịa ra Pinyin hay tiếng Anh.
   - VD SAI: [Tiểu Hắc] = Xiao Hei.
   - VD ĐÚNG: [tiểu hắc] = Tiểu Hắc.
   - VD ĐÚNG: [bộ phương] = Bộ Phương.

### 🛑 QUY TẮC NÂNG CẤP VỚI NGUYÊN TẮC "PHỤC HỒI NGUYÊN TÁC" & "GIỮ TÊN GỐC" (ƯU TIÊN TỐI THƯỢNG):
   - **Phạm vi áp dụng:** Đồng nhân Anime/Manga/Game (Honkai Impact, Star Rail, Genshin, Naruto, One Piece...), Light Novel, Sci-fi, Game Âu Mỹ (LoL, Dota, WoW), Bối cảnh Phương Tây (Harry Potter, Marvel).
   - **Quy tắc:** BẮT BUỘC trả về tên gốc Tiếng Anh (hoặc Romaji chuẩn) cho: Tên Nhân Vật, Tên Kỹ Năng (Skill), Vật Phẩm (Item), Tổ Chức trong vế phải nếu phù hợp.
   - **TUYỆT ĐỐI KHÔNG DỊCH HÁN VIỆT** trong các bối cảnh này. Ưu tiên phục hồi nguyên tác bằng cách giữ tên gốc nếu mâu thuẫn với dịch nghĩa.
   - *Ví dụ Honkai/Sci-fi:* [Judgement of Shamash] -> Judgement of Shamash (Sai: Thiên Hỏa Thánh Phán); [Herrscher] -> Herrscher; [Kiana] -> Kiana (Sai: Kỳ Á Na).
   - *Ví dụ Harry Potter/Western:* [哈利] -> Harry; [哥布林] -> Goblin; [亚瑟] -> Arthur.

### 🛑 QUY TẮC NÂNG CẤP "VẤN" (BẤT DI BẤT DỊCH):
   - Gặp chữ "Vấn" (问) trong tên riêng/chiêu thức -> Giữ nguyên là "Vấn" trong vế phải.
   - *Ví dụ:* [问道宗] -> Vấn Đạo Tông (Sai: Hỏi Đạo Tông); [莫问] -> Mạc Vấn.

### 🛑 QUY TẮC NÂNG CẤP CHUẨN HÓA TÊN NHÂN VẬT (THEO NGUỒN GỐC):
   - **Trung Quốc (Cổ trang/Tiên hiệp/Đô thị):** Dùng 100% Hán Việt chuẩn trong vế phải. *Ví dụ:* [叶凡] -> Diệp Phàm.
   - **Nhật Bản:** Romaji chuẩn Hepburn. *Ví dụ:* [桐ヶ谷] -> Kirigaya. Tên Tây trong tiếng Nhật -> Tiếng Anh ([アリス] -> Alice).
   - **Hàn Quốc:** Romanized chuẩn. *Ví dụ:* [김독자] -> Kim Dok-ja.

### 🛑 QUY TẮC NÂNG CẤP XỬ LÝ DANH HIỆU & CHỨC VỊ:
   - **Dr.:** Bối cảnh đời thường -> Bác sĩ. Bối cảnh Khoa học/SCP -> Tiến sĩ.

### 🛑 QUY TẮC NÂNG CẤP TỔ CHỨC / TÔNG MÔN / GUILD:
   - **Cổ trang:** Hán Việt (Tạc Thiên Bang).
   - **Võng du/Hiện đại/Sci-fi:** 
     - Tên Tiếng Anh/Latin (Wolf Guild, Anti-Entropy, Schicksal) -> GIỮ NGUYÊN Tiếng Anh.
     - [SHIELD] -> S.H.I.E.L.D.

### 🛑 QUY TẮC NÂNG CẤP KỸ NĂNG / ITEM / LEVEL (PHÂN LOẠI THEO THỂ LOẠI):
   - **Tiên hiệp/Kiếm hiệp/Huyền huyễn phương Đông:** Dịch Hán Việt hoa mỹ (Phật Nộ Hỏa Liên, Tru Tiên Kiếm).
   - **Game/System/Sci-fi/Anime/Western:**
     - **BẮT BUỘC GIỮ TIẾNG ANH** cho tên Skill/Ulti/Item/Vũ khí.
     - *Ví dụ:* [Excalibur] -> Excalibur; [Railgun] -> Railgun; [Fireball] -> Fireball.
     - Level: [Lv.10] hoặc [Cấp 10].
     - Class: Giữ tiếng Anh nếu phổ biến (Necromancer, Paladin, Valkyrie).

### 🛑 QUY TẮC NÂNG CẤP CHỦNG TỘC (RACE):
   - Elf -> Elf; Dwarf -> Dwarf; Goblin -> Goblin; Orc -> Orc.
   - Honkai/Star Rail: Aeon -> Aeon; Archon -> Archon.

`;

export const MERGE_GLOSSARY_PROMPT = `Hợp nhất từ điển. Loại bỏ trùng lặp. Sắp xếp từ vựng vào đúng các nhóm phân loại (NHÂN VẬT, ĐỊA DANH, TỔ CHỨC, VẬT PHẨM...). Ưu tiên thuật ngữ Tiếng Anh cho bối cảnh Game/Sci-fi và Hán Việt cho bối cảnh Cổ trang.`;

export const MERGE_CONTEXT_PROMPT = `
*** SYSTEM: DATABASE MERGER V3.6 - ACCUMULATIVE & RAW-SAFE & PRONOUN MATRIX ***
NHIỆM VỤ: Hợp nhất các bản phân tích rời rạc thành một "Series Bible" hoàn chỉnh duy nhất.

### 🛑 QUY TẮC HỢP NHẤT:
1. **PHÂN LOẠI TỪ ĐIỂN:** Gom tất cả từ vựng từ các phần vào đúng các nhóm:
   - # === [1. NHÂN VẬT / CHARACTERS] ===
   - # === [2. ĐỊA DANH / LOCATIONS] ===
   - # === [3. TỔ CHỨC / ORGANIZATIONS] ===
   - # === [4. TU LUYỆN / CULTIVATION] ===
   - # === [5. VẬT PHẨM / ITEMS] ===
   - # === [7. XƯNG HÔ & QUAN HỆ / PRONOUNS] ===
2. **CHẾ ĐỘ TÍCH LŨY:** Nếu bản A có nhân vật X, bản B có nhân vật Y -> Kết quả phải có cả X và Y.
3. **BẢO TOÀN KEY GỐC:** Nếu Key là chữ Hán, giữ nguyên chữ Hán.
4. **HỢP NHẤT MA TRẬN XƯNG HÔ (QUAN TRỌNG):**
   - Tìm mục # === [7. XƯNG HÔ & QUAN HỆ / PRONOUNS] ===.
   - Nếu cùng một nhân vật xuất hiện ở nhiều bản, hãy GỘP thông tin xưng hô lại thành một khối duy nhất cho nhân vật đó.
   - **BẮT BUỘC GIỮ ĐỊNH DẠNG MA TRẬN:**
     **[Tên Gốc] = Tên Chuẩn || (Vai Trò)**
     * *Thân phận:* ...
     * *Tính cách:* ...
     * *Xưng hô:*
         * Với [Nhân vật A]: **[Xưng] - [Hô]**

### CẤU TRÚC ĐẦU RA:
# 1. THÔNG TIN CƠ BẢN
# 2. TỪ ĐIỂN PHÂN LOẠI (GLOSSARY)
# 3. NGỮ CẢNH & SỰ KIỆN QUAN TRỌNG
# 4. TIẾN TRÌNH CỐT TRUYỆN TÍCH LŨY
# 5. GHI CHÚ DỊCH THUẬT
# === [7. XƯNG HÔ & QUAN HỆ / PRONOUNS] ===
(Liệt kê các Ma trận xưng hô đã hợp nhất tại đây)
`;
