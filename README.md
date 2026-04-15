# 🔴 AIA Insurance Line BOT — WIT-K
**ตัวแทน AIA โดยตรง | 088-965-6635**

---

## 📁 โครงสร้างไฟล์

```
aia-linebot/
├── index.js          ← ไฟล์หลัก (Line BOT + AI)
├── premiumTables.js  ← ตารางเบี้ยจริงทุกแบบ
├── package.json      ← Dependencies
├── .env.example      ← ตัวอย่าง Environment Variables
└── README.md         ← คู่มือนี้
```

---

## 🚀 ขั้นตอน Deploy บน Railway (แนะนำ)

### ขั้นที่ 1 — เตรียม Keys
1. **Line Developer**: developers.line.biz → สร้าง Messaging API Channel → คัดลอก `Channel Access Token` และ `Channel Secret`
2. **Anthropic**: console.anthropic.com → สร้าง API Key

### ขั้นที่ 2 — Deploy ขึ้น Railway
```bash
# ติดตั้ง Railway CLI
npm install -g @railway/cli

# Login
railway login

# สร้าง Project ใหม่
railway init

# Deploy
railway up
```

### ขั้นที่ 3 — ตั้งค่า Environment Variables ใน Railway
```
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret
ANTHROPIC_API_KEY=sk-ant-xxxxx
PORT=3000
```

### ขั้นที่ 4 — ตั้งค่า Webhook URL ใน Line Developer Console
```
https://your-app.railway.app/webhook
```
เปิด "Use Webhook" → Verify → ✅

---

## ✨ ฟีเจอร์ที่มี

| ฟีเจอร์ | รายละเอียด |
|---|---|
| Onboarding | ถาม 3 ข้อ สร้าง User Profile |
| AI Chat | Claude AI ตอบคำถามประกัน AIA |
| คำนวณเบี้ย | ตารางเบี้ยจริงทุกแบบ |
| Package C&D | เปรียบเทียบและคำนวณ |
| Agent Card | โชว์ข้อมูล WIT-K อัตโนมัติ |
| Daily Cron | แจ้งเตือนภาษีเดือนธันวาคม |
| Rich Menu | เมนู 6 ปุ่ม (ต้อง upload ภาพแยก) |

---

## 📊 สินค้า AIA ที่รองรับ

- ✅ AIA 10 Pay Life (Non Par) — อายุ 0-65 ปี
- ✅ AIA 15 Pay Life (Non Par) — อายุ 0-65 ปี
- ✅ AIA 20 Pay Life (Non Par) — อายุ 0-70 ปี
- ✅ AIA CI SuperCare 10/99 — อายุ 0-65 ปี
- ✅ AIA CI SuperCare 20/99 — อายุ 0-65 ปี
- ✅ AIA Senior Happy — อายุ 50-70 ปี (ไม่ตรวจสุขภาพ)
- ✅ Wellness Package C (20PLNP + CI Plus + Health Happy)
- ✅ Wellness Package D (20PLNP + CI Plus + AHC + HBX + Health Happy)

---

## 🔧 แก้ไขข้อมูล Agent

ใน `index.js` บรรทัด 20-25:
```javascript
const AGENT = {
  name: 'WIT-K',           // เปลี่ยนชื่อ
  phone: '088-965-6635',   // เปลี่ยนเบอร์
  lineId: '@witk-aia',     // เปลี่ยน Line ID
  title: 'ตัวแทน AIA ที่ได้รับการรับรอง',
};
```

---

## 📱 ขั้นตอนต่อไป (Optional)

1. **Rich Menu Image** — ออกแบบภาพ 2500x843px อัปโหลดใน Line Console
2. **MongoDB/Redis** — เก็บ User Profile ถาวร (ไม่หายเมื่อ restart)
3. **Dashboard** — หน้า Web admin ดูสถิติผู้ใช้
4. **Broadcast List** — ส่ง Daily Tip ถึงผู้ใช้ทุกคน

---

**📞 สอบถาม: WIT-K | 088-965-6635**
