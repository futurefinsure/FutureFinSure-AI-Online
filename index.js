// ============================================================
// AIA Insurance Line BOT by WIT-K
// ตัวแทน AIA โดยตรง | 088-965-6635
// ============================================================
require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const Anthropic = require('@anthropic-ai/sdk');
const cron = require('node-cron');
const {
  calcLifePremium, calcCIPremium, calcSeniorPremium, T_PKG_C, T_PKG_D
} = require('./premiumTables');

const app = express();
const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ===== AGENT INFO =====
const AGENT = {
  name: 'WIT-K',
  phone: '088-965-6635',
  lineId: '@880ftlov', // เปลี่ยนเป็น Line ID จริง
  title: 'ตัวแทน AIA ที่ได้รับการรับรอง',
};

// ===== SYSTEM PROMPT =====
function buildSystemPrompt(profile) {
  return `คุณคือ ${AGENT.name} ตัวแทนประกัน AIA ที่เชี่ยวชาญและเป็นมิตร

ข้อมูลผู้ใช้:
- อายุ: ${profile?.age || 'ไม่ทราบ'} ปี
- เพศ: ${profile?.gender || 'ไม่ทราบ'}
- เป้าหมาย: ${profile?.goal || 'ทั่วไป'}
- ความเสี่ยง: ${profile?.risk || 'ปานกลาง'}
- อายุงานที่เหลือ: ${profile?.workYears || 'ไม่ทราบ'}

สินค้าที่แนะนำได้:
1. ประกันชีวิต: AIA 10/15/20 Pay Life (Non Par)
2. ประกันโรคร้ายแรง: AIA CI SuperCare 10/99 และ 20/99 (62 โรค)
3. ประกันสุขภาพ: Health Happy วงเงิน 5 ล้าน
4. ผู้สูงอายุ: AIA Senior Happy (อายุ 50-70 ไม่ตรวจสุขภาพ)
5. Package C: ชีวิต + CI 500K + สุขภาพ 5M
6. Package D: ชีวิต + CI 2M + AHC + HBX + สุขภาพ 5M

กฎการตอบ:
- ตอบภาษาไทยเสมอ กระชับ ชัดเจน
- แนะนำเฉพาะสินค้า AIA
- ใช้ตัวเลขจริงเสมอ
- ปิดท้ายด้วยการแนะนำติดต่อ ${AGENT.name} ที่ ${AGENT.phone} เมื่อเรื่องซับซ้อน
- ห้ามแนะนำบริษัทประกันอื่น
- เพิ่ม [RECOMMEND_AGENT] เมื่อผู้ใช้ต้องการที่ปรึกษา ขอใบเสนอราคา หรือต้องการสมัคร`;
}

// ===== STORAGE (ใช้ Map สำหรับ dev — เปลี่ยนเป็น Redis/MongoDB ใน production) =====
const userProfiles = new Map();
const userHistory = new Map();
const userState = new Map();

// ===== FLEX MESSAGE HELPERS =====
function makeAgentCard() {
  return {
    type: 'flex',
    altText: `ติดต่อ ${AGENT.name} — ${AGENT.phone}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type:'text', text:`🔴 ${AGENT.name} — ${AGENT.title}`, weight:'bold', size:'sm', color:'#C8102E' },
          { type:'text', text:`📞 ${AGENT.phone}`, size:'sm', margin:'sm' },
          { type:'text', text:'✅ ตัวแทน AIA โดยตรง', size:'xs', color:'#555' },
          { type:'text', text:'✅ ให้คำปรึกษาฟรี ไม่มีค่าใช้จ่าย', size:'xs', color:'#555' },
          { type:'text', text:'✅ ออกแบบแผนประกันเฉพาะคุณ', size:'xs', color:'#555' },
          { type:'text', text:'✅ ดูแลเคลมหลังการขาย', size:'xs', color:'#555' },
        ]
      },
      footer: {
        type:'box', layout:'vertical',
        contents: [
          { type:'button', style:'primary', color:'#C8102E',
            action:{ type:'uri', label:`📞 โทรหา ${AGENT.name} ได้เลย`, uri:`tel:${AGENT.phone.replace(/-/g,'')}` } }
        ]
      }
    }
  };
}

function makePremiumCard(title, rows, total) {
  return {
    type: 'flex',
    altText: title,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#C8102E', paddingAll: '12px',
        contents: [{ type:'text', text: title, color:'#ffffff', weight:'bold', size:'sm' }]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          ...rows.map(r => ({
            type:'box', layout:'horizontal',
            contents: [
              { type:'text', text: r.label, size:'xs', color:'#555', flex:3 },
              { type:'text', text: r.value, size:'xs', color:'#C8102E', weight:'bold', align:'end', flex:2 }
            ]
          })),
          { type:'separator', margin:'md' },
          {
            type:'box', layout:'horizontal', margin:'md',
            contents: [
              { type:'text', text:'เบี้ยรวม/ปี', size:'sm', weight:'bold', flex:3 },
              { type:'text', text: total, size:'sm', weight:'bold', color:'#C8102E', align:'end', flex:2 }
            ]
          }
        ]
      },
      footer: {
        type:'box', layout:'vertical',
        contents: [{
          type:'button', style:'primary', color:'#C8102E',
          action:{ type:'message', label:'สนใจ ติดต่อ WIT-K', text:`สนใจสอบถามรายละเอียดเพิ่มเติมครับ` }
        }]
      }
    }
  };
}

function makeRichMenuMessage() {
  return {
    type: 'text',
    text: `🔴 ยินดีต้อนรับสู่ ${AGENT.name} Insurance Advisor!\n\n` +
      `เลือกหัวข้อที่สนใจ:\n` +
      `1️⃣ ประกันชีวิต (10/15/20 Pay)\n` +
      `2️⃣ ประกันโรคร้ายแรง CI SuperCare\n` +
      `3️⃣ ประกันสุขภาพ Health Happy\n` +
      `4️⃣ ผู้สูงอายุ Senior Happy\n` +
      `5️⃣ Package C — ครบ 3 ด้าน\n` +
      `6️⃣ Package D — ครบ 5 ด้าน\n` +
      `7️⃣ คำนวณเบี้ยประกัน\n` +
      `8️⃣ ลดหย่อนภาษีจากประกัน\n\n` +
      `พิมพ์เลข หรือถามคำถามได้เลยครับ 😊`,
    quickReply: {
      items: [
        { type:'action', action:{ type:'message', label:'ประกันชีวิต', text:'ประกันชีวิต AIA' }},
        { type:'action', action:{ type:'message', label:'CI SuperCare', text:'CI SuperCare' }},
        { type:'action', action:{ type:'message', label:'Package C&D', text:'Package C และ D' }},
        { type:'action', action:{ type:'message', label:'คำนวณเบี้ย', text:'คำนวณเบี้ยประกัน' }},
        { type:'action', action:{ type:'message', label:'ติดต่อ WIT-K', text:'ขอคำแนะนำจาก WIT-K' }},
      ]
    }
  };
}

// ===== ONBOARDING =====
async function handleFollow(event) {
  const uid = event.source.userId;
  userState.set(uid, 'onboarding_1');
  await lineClient.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: 'text',
        text: `สวัสดีครับ! 🎉 ผม ${AGENT.name} ตัวแทนประกัน AIA พร้อมดูแลด้านประกันชีวิต โรคร้ายแรง และสุขภาพให้คุณครับ\n\nขอถามสั้นๆ 3 ข้อ เพื่อให้คำแนะนำตรงกับคุณมากที่สุดครับ`
      },
      {
        type: 'text',
        text: '📌 ข้อ 1: เพศของคุณ?',
        quickReply: {
          items: [
            { type:'action', action:{ type:'message', label:'ชาย', text:'เพศ: ชาย' }},
            { type:'action', action:{ type:'message', label:'หญิง', text:'เพศ: หญิง' }},
          ]
        }
      }
    ]
  });
}

// ===== CALCULATOR HANDLER =====
function handleCalculator(text, profile) {
  const age = profile?.age;
  const gender = profile?.gender === 'หญิง' ? 'female' : 'male';

  if (!age) {
    return { type:'text', text:'กรุณาบอกอายุของคุณก่อนนะครับ เช่น พิมพ์ว่า "อายุ 35 ปี"' };
  }

  // Package C
  if (text.includes('package c') || text.includes('แพ็กเกจ c') || text.includes('packagec')) {
    const table = gender==='male' ? T_PKG_C.M : T_PKG_C.F;
    const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
    let closest = keys[0];
    for (const k of keys) { if(Math.abs(k-age)<Math.abs(closest-age)) closest=k; }
    const ann = table[closest];
    return makePremiumCard(
      '📦 Package C — ชีวิต + CI + สุขภาพ',
      [
        { label:'20 PLNP (ชีวิต)', value:'ทุน 100,000 ฿' },
        { label:'CI Plus (โรคร้ายแรง)', value:'ทุน 500,000 ฿' },
        { label:'Health Happy (สุขภาพ)', value:'5,000,000 ฿/ปี' },
        { label:'เบี้ย/เดือน', value:`${Math.round(ann/12).toLocaleString()} ฿` },
        { label:'เบี้ย/วัน', value:`${Math.round(ann/365)} ฿` },
      ],
      `${Math.round(ann).toLocaleString()} ฿`
    );
  }

  // Package D
  if (text.includes('package d') || text.includes('แพ็กเกจ d') || text.includes('packaged')) {
    const table = gender==='male' ? T_PKG_D.M : T_PKG_D.F;
    const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
    let closest = keys[0];
    for (const k of keys) { if(Math.abs(k-age)<Math.abs(closest-age)) closest=k; }
    const ann = table[closest];
    return makePremiumCard(
      '📦 Package D — ครบ 5 ด้าน',
      [
        { label:'20 PLNP (ชีวิต)', value:'ทุน 100,000 ฿' },
        { label:'CI Plus (โรคร้ายแรง)', value:'ทุน 2,000,000 ฿' },
        { label:'AHC (7 โรคร้ายแรง)', value:'1,000,000 ฿' },
        { label:'HBX (ค่าชดเชยรายวัน)', value:'1,000 ฿/วัน' },
        { label:'Health Happy (สุขภาพ)', value:'5,000,000 ฿/ปี' },
        { label:'เบี้ย/เดือน', value:`${Math.round(ann/12).toLocaleString()} ฿` },
        { label:'เบี้ย/วัน', value:`${Math.round(ann/365)} ฿` },
      ],
      `${Math.round(ann).toLocaleString()} ฿`
    );
  }

  // Senior Happy
  if (text.includes('senior') || text.includes('ผู้สูงอายุ') || text.includes('ซีเนียร์')) {
    if (age < 50 || age > 70) {
      return { type:'text', text:'Senior Happy รับประกันอายุ 50-70 ปีเท่านั้นครับ' };
    }
    const result = calcSeniorPremium(age, 200000, gender);
    if (!result) return { type:'text', text:'ไม่พบข้อมูลสำหรับอายุนี้ครับ' };
    return makePremiumCard(
      '👴 Senior Happy — ไม่ตรวจสุขภาพ',
      [
        { label:'ทุนประกันสูงสุด', value:'200,000 ฿' },
        { label:'ชำระเบี้ยถึงอายุ', value:'90 ปี' },
        { label:'คุ้มครองถึงอายุ', value:'90 ปี' },
        { label:'ตรวจสุขภาพ', value:'ไม่ต้อง ✅' },
        { label:'เบี้ย/เดือน', value:`${Math.round(result.monthly).toLocaleString()} ฿` },
        { label:'เบี้ย/วัน', value:`${Math.round(result.annualNet/365)} ฿` },
      ],
      `${Math.round(result.annualNet).toLocaleString()} ฿/ปี`
    );
  }

  return null;
}

// ===== MAIN MESSAGE HANDLER =====
async function handleMessage(event) {
  const uid = event.source.userId;
  const msg = event.message.text.trim();
  const msgLower = msg.toLowerCase();
  const state = userState.get(uid) || 'chat';

  // ONBOARDING FLOW
  if (state === 'onboarding_1') {
    const gender = msg.includes('ชาย') ? 'ชาย' : 'หญิง';
    userProfiles.set(uid, { gender });
    userState.set(uid, 'onboarding_2');
    return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{
      type:'text', text:'📌 ข้อ 2: อายุของคุณ? (พิมพ์ตัวเลขเท่านั้น เช่น 35)',
    }]});
  }

  if (state === 'onboarding_2') {
    const ageNum = parseInt(msg.replace(/[^0-9]/g,''));
    if (isNaN(ageNum) || ageNum<1 || ageNum>99) {
      return lineClient.replyMessage({ replyToken: event.replyToken, messages:[{
        type:'text', text:'กรุณาพิมพ์เฉพาะตัวเลขอายุครับ เช่น 35'
      }]});
    }
    const p = userProfiles.get(uid)||{};
    userProfiles.set(uid, {...p, age:ageNum});
    userState.set(uid, 'onboarding_3');
    return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{
      type:'text', text:'📌 ข้อ 3: เป้าหมายหลักของคุณ?',
      quickReply: { items: [
        { type:'action', action:{ type:'message', label:'ประกันชีวิต', text:'เป้าหมาย: ประกันชีวิต' }},
        { type:'action', action:{ type:'message', label:'โรคร้ายแรง', text:'เป้าหมาย: โรคร้ายแรง' }},
        { type:'action', action:{ type:'message', label:'ดูแลสุขภาพ', text:'เป้าหมาย: สุขภาพ' }},
        { type:'action', action:{ type:'message', label:'ครบทุกด้าน', text:'เป้าหมาย: ครบทุกด้าน' }},
      ]}
    }]});
  }

  if (state === 'onboarding_3') {
    const p = userProfiles.get(uid)||{};
    userProfiles.set(uid, {...p, goal:msg, onboarded:true});
    userState.set(uid, 'chat');
    const profile = userProfiles.get(uid);
    return lineClient.replyMessage({ replyToken: event.replyToken, messages: [
      { type:'text', text:`เยี่ยมเลยครับ! ผมรู้จักคุณแล้ว 🎯\n\nอายุ ${profile.age} ปี (${profile.gender}) เป้าหมาย: ${profile.goal}\n\nพร้อมให้คำปรึกษาที่ตรงกับคุณโดยเฉพาะแล้วครับ!` },
      makeRichMenuMessage()
    ]});
  }

  // MENU SHORTCUTS
  if (['เมนู','menu','ดูเมนู'].includes(msgLower)) {
    return lineClient.replyMessage({ replyToken: event.replyToken, messages:[makeRichMenuMessage()] });
  }

  // CALCULATOR TRIGGER
  const profile = userProfiles.get(uid)||{};
  const calcResult = handleCalculator(msgLower, profile);
  if (calcResult) {
    return lineClient.replyMessage({ replyToken: event.replyToken, messages:[calcResult] });
  }

  // AI CHAT
  if (!userHistory.has(uid)) userHistory.set(uid, []);
  const hist = userHistory.get(uid);
  hist.push({ role:'user', content:msg });
  if (hist.length > 20) hist.splice(0,2);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: buildSystemPrompt(profile),
    messages: hist,
  });

  let reply = response.content[0].text;
  const needsAgent = reply.includes('[RECOMMEND_AGENT]');
  const cleanReply = reply.replace('[RECOMMEND_AGENT]','').trim();
  hist.push({ role:'assistant', content:cleanReply });

  const messages = [{ type:'text', text:cleanReply }];
  if (needsAgent) messages.push(makeAgentCard());

  return lineClient.replyMessage({ replyToken: event.replyToken, messages });
}

// ===== WEBHOOK =====
app.post('/webhook',
  express.json(),
  async (req, res) => {
    // Verify signature
    const signature = req.headers['x-line-signature'];
    if (!line.validateSignature(
      JSON.stringify(req.body),
      process.env.LINE_CHANNEL_SECRET,
      signature
    )) {
      return res.status(403).end();
    }

// ===== DAILY BROADCAST =====
cron.schedule('0 8 * * *', async () => {
  console.log('Running daily broadcast...');
  // TODO: ใส่ userId list จาก database แล้ว push message
  // const userIds = await getUserIds();
  // for (const uid of userIds) {
  //   await lineClient.pushMessage({ to:uid, messages:[{ type:'text', text:tip }] });
  // }
}, { timezone: 'Asia/Bangkok' });

// ===== TAX REMINDER (ธันวาคม) =====
cron.schedule('0 9 1 12 *', async () => {
  const tipMsg = `📊 แจ้งเตือน! ใกล้สิ้นปีแล้วครับ\n\nอย่าลืมซื้อประกัน AIA เพื่อลดหย่อนภาษีปีนี้นะครับ:\n\n✅ ประกันชีวิต ลดหย่อนได้สูงสุด 100,000 ฿\n✅ ประกันสุขภาพ ลดหย่อนได้เพิ่มอีก 25,000 ฿\n\nรวมลดหย่อนได้ถึง 125,000 ฿/ปี!\n\nสนใจปรึกษา WIT-K ได้เลยครับ 📞 088-965-6635`;
  console.log('Dec tax reminder:', tipMsg);
}, { timezone: 'Asia/Bangkok' });

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔴 AIA Line BOT by ${AGENT.name} — Port ${PORT}`));
