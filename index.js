require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const Anthropic = require('@anthropic-ai/sdk');
const cron = require('node-cron');
const {
  calcSeniorPremium, T_PKG_C, T_PKG_D
} = require('./premiumTables');

const app = express();
const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AGENT = {
  name: 'WIT-K',
  phone: '088-965-6635',
  title: 'ตัวแทน AIA ที่ได้รับการรับรอง',
};

function buildSystemPrompt(profile) {
  return `คุณคือ ${AGENT.name} ตัวแทนประกัน AIA ที่เชี่ยวชาญและเป็นมิตร
อายุ: ${profile?.age || 'ไม่ทราบ'} เพศ: ${profile?.gender || 'ไม่ทราบ'} เป้าหมาย: ${profile?.goal || 'ทั่วไป'}
ตอบภาษาไทย กระชับ แนะนำเฉพาะ AIA เพิ่ม [RECOMMEND_AGENT] เมื่อผู้ใช้ขอสมัคร`;
}

const userProfiles = new Map();
const userHistory = new Map();
const userState = new Map();

function makeAgentCard() {
  return {
    type: 'flex', altText: `ติดต่อ ${AGENT.name} — ${AGENT.phone}`,
    contents: {
      type: 'bubble',
      body: { type:'box', layout:'vertical', spacing:'sm', contents: [
        { type:'text', text:`🔴 ${AGENT.name} — ${AGENT.title}`, weight:'bold', size:'sm', color:'#C8102E' },
        { type:'text', text:`📞 ${AGENT.phone}`, size:'sm', margin:'sm' },
        { type:'text', text:'✅ ตัวแทน AIA โดยตรง', size:'xs', color:'#555' },
        { type:'text', text:'✅ ให้คำปรึกษาฟรี', size:'xs', color:'#555' },
      ]},
      footer: { type:'box', layout:'vertical', contents: [{
        type:'button', style:'primary', color:'#C8102E',
        action:{ type:'uri', label:'📞 โทรหา WIT-K', uri:`tel:${AGENT.phone.replace(/-/g,'')}` }
      }]}
    }
  };
}

function makePremiumCard(title, rows, total) {
  return {
    type:'flex', altText:title,
    contents: {
      type:'bubble',
      header:{ type:'box', layout:'vertical', backgroundColor:'#C8102E', paddingAll:'12px',
        contents:[{ type:'text', text:title, color:'#ffffff', weight:'bold', size:'sm' }]},
      body:{ type:'box', layout:'vertical', spacing:'sm', contents:[
        ...rows.map(r=>({ type:'box', layout:'horizontal', contents:[
          { type:'text', text:r.label, size:'xs', color:'#555', flex:3 },
          { type:'text', text:r.value, size:'xs', color:'#C8102E', weight:'bold', align:'end', flex:2 }
        ]})),
        { type:'separator', margin:'md' },
        { type:'box', layout:'horizontal', margin:'md', contents:[
          { type:'text', text:'เบี้ยรวม/ปี', size:'sm', weight:'bold', flex:3 },
          { type:'text', text:total, size:'sm', weight:'bold', color:'#C8102E', align:'end', flex:2 }
        ]}
      ]},
      footer:{ type:'box', layout:'vertical', contents:[{
        type:'button', style:'primary', color:'#C8102E',
        action:{ type:'message', label:'สนใจ ติดต่อ WIT-K', text:'สนใจสอบถามรายละเอียดเพิ่มเติมครับ' }
      }]}
    }
  };
}

function makeMenuMessage() {
  return {
    type:'text',
    text:`🔴 ${AGENT.name} Insurance Advisor\n\n1️⃣ ประกันชีวิต\n2️⃣ CI SuperCare\n3️⃣ Package C\n4️⃣ Package D\n5️⃣ Senior Happy\n\nพิมพ์เลขหรือถามได้เลยครับ 😊`,
    quickReply:{ items:[
      { type:'action', action:{ type:'message', label:'ประกันชีวิต', text:'ประกันชีวิต AIA' }},
      { type:'action', action:{ type:'message', label:'Package C', text:'package c' }},
      { type:'action', action:{ type:'message', label:'Package D', text:'package d' }},
      { type:'action', action:{ type:'message', label:'ติดต่อ WIT-K', text:'ขอคำแนะนำจาก WIT-K' }},
    ]}
  };
}

async function handleFollow(event) {
  const uid = event.source.userId;
  userState.set(uid, 'onboarding_1');
  await lineClient.replyMessage({ replyToken:event.replyToken, messages:[
    { type:'text', text:`สวัสดีครับ! 🎉 ผม ${AGENT.name} ตัวแทนประกัน AIA\nขอถามสั้นๆ 3 ข้อนะครับ` },
    { type:'text', text:'📌 ข้อ 1: เพศของคุณ?',
      quickReply:{ items:[
        { type:'action', action:{ type:'message', label:'ชาย', text:'เพศ: ชาย' }},
        { type:'action', action:{ type:'message', label:'หญิง', text:'เพศ: หญิง' }},
      ]}
    }
  ]});
}

function handleCalculator(text, profile) {
  const age = profile?.age;
  const gender = profile?.gender === 'หญิง' ? 'female' : 'male';
  if (!age) return { type:'text', text:'กรุณาบอกอายุก่อนนะครับ เช่น "อายุ 35 ปี"' };

  if (text.includes('package c') || text.includes('แพ็กเกจ c')) {
    const table = gender==='male' ? T_PKG_C.M : T_PKG_C.F;
    const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
    let closest = keys[0];
    for (const k of keys) { if(Math.abs(k-age)<Math.abs(closest-age)) closest=k; }
    const ann = table[closest];
    return makePremiumCard('📦 Package C', [
      { label:'20 PLNP ชีวิต', value:'100,000 ฿' },
      { label:'CI Plus โรคร้ายแรง', value:'500,000 ฿' },
      { label:'Health Happy สุขภาพ', value:'5,000,000 ฿/ปี' },
      { label:'เบี้ย/เดือน', value:`${Math.round(ann/12).toLocaleString()} ฿` },
      { label:'เบี้ย/วัน', value:`${Math.round(ann/365)} ฿` },
    ], `${Math.round(ann).toLocaleString()} ฿`);
  }

  if (text.includes('package d') || text.includes('แพ็กเกจ d')) {
    const table = gender==='male' ? T_PKG_D.M : T_PKG_D.F;
    const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
    let closest = keys[0];
    for (const k of keys) { if(Math.abs(k-age)<Math.abs(closest-age)) closest=k; }
    const ann = table[closest];
    return makePremiumCard('📦 Package D', [
      { label:'20 PLNP ชีวิต', value:'100,000 ฿' },
      { label:'CI Plus โรคร้ายแรง', value:'2,000,000 ฿' },
      { label:'AHC 7 โรคร้ายแรง', value:'1,000,000 ฿' },
      { label:'HBX ค่าชดเชยรายวัน', value:'1,000 ฿/วัน' },
      { label:'Health Happy สุขภาพ', value:'5,000,000 ฿/ปี' },
      { label:'เบี้ย/เดือน', value:`${Math.round(ann/12).toLocaleString()} ฿` },
      { label:'เบี้ย/วัน', value:`${Math.round(ann/365)} ฿` },
    ], `${Math.round(ann).toLocaleString()} ฿`);
  }

  if (text.includes('senior') || text.includes('ผู้สูงอายุ')) {
    if (age<50||age>70) return { type:'text', text:'Senior Happy รับอายุ 50-70 ปีครับ' };
    const result = calcSeniorPremium(age, 200000, gender);
    if (!result) return { type:'text', text:'ไม่พบข้อมูลครับ' };
    return makePremiumCard('👴 Senior Happy ไม่ตรวจสุขภาพ', [
      { label:'ทุนประกัน', value:'200,000 ฿' },
      { label:'คุ้มครองถึงอายุ', value:'90 ปี' },
      { label:'ตรวจสุขภาพ', value:'ไม่ต้อง ✅' },
      { label:'เบี้ย/เดือน', value:`${Math.round(result.monthly).toLocaleString()} ฿` },
    ], `${Math.round(result.annualNet).toLocaleString()} ฿/ปี`);
  }
  return null;
}

async function handleMessage(event) {
  const uid = event.source.userId;
  const msg = event.message.text.trim();
  const msgLower = msg.toLowerCase();
  const state = userState.get(uid) || 'chat';

  if (state === 'onboarding_1') {
    userProfiles.set(uid, { gender: msg.includes('ชาย')?'ชาย':'หญิง' });
    userState.set(uid, 'onboarding_2');
    return lineClient.replyMessage({ replyToken:event.replyToken, messages:[{
      type:'text', text:'📌 ข้อ 2: อายุของคุณ? (พิมพ์ตัวเลข เช่น 35)'
    }]});
  }

  if (state === 'onboarding_2') {
    const ageNum = parseInt(msg.replace(/[^0-9]/g,''));
    if (isNaN(ageNum)||ageNum<1||ageNum>99) {
      return lineClient.replyMessage({ replyToken:event.replyToken, messages:[{
        type:'text', text:'กรุณาพิมพ์เฉพาะตัวเลขครับ เช่น 35'
      }]});
    }
    userProfiles.set(uid, {...(userProfiles.get(uid)||{}), age:ageNum});
    userState.set(uid, 'onboarding_3');
    return lineClient.replyMessage({ replyToken:event.replyToken, messages:[{
      type:'text', text:'📌 ข้อ 3: เป้าหมายหลัก?',
      quickReply:{ items:[
        { type:'action', action:{ type:'message', label:'ประกันชีวิต', text:'เป้าหมาย: ประกันชีวิต' }},
        { type:'action', action:{ type:'message', label:'โรคร้ายแรง', text:'เป้าหมาย: โรคร้ายแรง' }},
        { type:'action', action:{ type:'message', label:'สุขภาพ', text:'เป้าหมาย: สุขภาพ' }},
        { type:'action', action:{ type:'message', label:'ครบทุกด้าน', text:'เป้าหมาย: ครบทุกด้าน' }},
      ]}
    }]});
  }

  if (state === 'onboarding_3') {
    const p = userProfiles.get(uid)||{};
    userProfiles.set(uid, {...p, goal:msg, onboarded:true});
    userState.set(uid, 'chat');
    const profile = userProfiles.get(uid);
    return lineClient.replyMessage({ replyToken:event.replyToken, messages:[
      { type:'text', text:`เยี่ยมเลยครับ! 🎯 อายุ ${profile.age} ปี (${profile.gender})\nพร้อมให้คำปรึกษาแล้วครับ!` },
      makeMenuMessage()
    ]});
  }

  if (['เมนู','menu','ดูเมนู'].includes(msgLower)) {
    return lineClient.replyMessage({ replyToken:event.replyToken, messages:[makeMenuMessage()] });
  }

  const profile = userProfiles.get(uid)||{};
  const calcResult = handleCalculator(msgLower, profile);
  if (calcResult) {
    return lineClient.replyMessage({ replyToken:event.replyToken, messages:[calcResult] });
  }

  if (!userHistory.has(uid)) userHistory.set(uid, []);
  const hist = userHistory.get(uid);
  hist.push({ role:'user', content:msg });
  if (hist.length > 20) hist.splice(0,2);

  const response = await anthropic.messages.create({
    model:'claude-sonnet-4-20250514', max_tokens:800,
    system:buildSystemPrompt(profile), messages:hist,
  });

  const reply = response.content[0].text;
  const needsAgent = reply.includes('[RECOMMEND_AGENT]');
  const cleanReply = reply.replace('[RECOMMEND_AGENT]','').trim();
  hist.push({ role:'assistant', content:cleanReply });

  const messages = [{ type:'text', text:cleanReply }];
  if (needsAgent) messages.push(makeAgentCard());
  return lineClient.replyMessage({ replyToken:event.replyToken, messages });
}

// ===== WEBHOOK — ใช้ line.middleware โดยตรง =====
const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

app.post('/webhook',
  line.middleware(lineConfig),
  async (req, res) => {
    res.status(200).end();
    for (const event of req.body.events || []) {
      try {
        if (event.type === 'follow') await handleFollow(event);
        else if (event.type === 'message' && event.message.type === 'text') await handleMessage(event);
      } catch (err) {
        console.error('Error:', err.message);
      }
    }
  }
);

app.get('/', (req, res) => res.send('🔴 AIA Line BOT is running!'));

cron.schedule('0 8 * * *', () => console.log('Daily...'), { timezone:'Asia/Bangkok' });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🔴 AIA Line BOT by ${AGENT.name} — Port ${PORT}`));
