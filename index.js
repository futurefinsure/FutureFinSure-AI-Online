require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const Anthropic = require('@anthropic-ai/sdk');
const { calcSeniorPremium, T_PKG_C, T_PKG_D } = require('./premiumTables');

const app = express();
app.use(express.json({ type: '*/*' }));

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AGENT = { name: 'WIT-K', phone: '088-965-6635' };
const userProfiles = new Map();
const userHistory  = new Map();
const userState    = new Map();

// แก้ UTF-8: ส่งข้อความผ่าน Line API โดยตรงแทน SDK
const https = require('https');

function lineReply(replyToken, messages) {
  const body = JSON.stringify({ replyToken, messages });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.line.me',
      path: '/v2/bot/message/reply',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Reply status:', res.statusCode, data);
        resolve(data);
      });
    });
    req.on('error', reject);
    req.write(body, 'utf8');
    req.end();
  });
}

function txt(text) { return { type: 'text', text }; }

function makeMenuMessage() {
  return txt('WIT-K Insurance Advisor\n\n1 - ประกันชีวิต\n2 - CI SuperCare\n3 - Package C\n4 - Package D\n5 - Senior Happy\n\nพิมพ์เลขหรือถามได้เลยครับ');
}

function makePremiumText(title, rows, total) {
  const lines = rows.map(r => `${r.label}: ${r.value}`).join('\n');
  return txt(`${title}\n\n${lines}\n\nเบี้ยรวม/ปี: ${total}`);
}

function handleCalculator(text, profile) {
  const age = profile?.age;
  const gender = profile?.gender === 'หญิง' ? 'female' : 'male';
  if (!age) return txt('กรุณาบอกอายุก่อนนะครับ เช่น 35');

  if (text.includes('package c')) {
    const table = gender === 'male' ? T_PKG_C.M : T_PKG_C.F;
    const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
    let cl = keys[0];
    for (const k of keys) { if (Math.abs(k-age) < Math.abs(cl-age)) cl = k; }
    const ann = table[cl];
    return makePremiumText('Package C - ชีวิต + CI + สุขภาพ', [
      { label: 'ชีวิต 20PLNP', value: '100,000 บาท' },
      { label: 'CI Plus โรคร้ายแรง', value: '500,000 บาท' },
      { label: 'Health Happy', value: '5,000,000 บาท/ปี' },
      { label: 'เบี้ย/เดือน', value: `${Math.round(ann/12).toLocaleString()} บาท` },
      { label: 'เบี้ย/วัน', value: `${Math.round(ann/365)} บาท` },
    ], `${Math.round(ann).toLocaleString()} บาท`);
  }

  if (text.includes('package d')) {
    const table = gender === 'male' ? T_PKG_D.M : T_PKG_D.F;
    const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
    let cl = keys[0];
    for (const k of keys) { if (Math.abs(k-age) < Math.abs(cl-age)) cl = k; }
    const ann = table[cl];
    return makePremiumText('Package D - ครบ 5 ด้าน', [
      { label: 'ชีวิต 20PLNP', value: '100,000 บาท' },
      { label: 'CI Plus', value: '2,000,000 บาท' },
      { label: 'AHC', value: '1,000,000 บาท' },
      { label: 'HBX ค่าชดเชยรายวัน', value: '1,000 บาท/วัน' },
      { label: 'Health Happy', value: '5,000,000 บาท/ปี' },
      { label: 'เบี้ย/เดือน', value: `${Math.round(ann/12).toLocaleString()} บาท` },
    ], `${Math.round(ann).toLocaleString()} บาท`);
  }

  if (text.includes('senior') || text.includes('senior happy')) {
    if (age < 50 || age > 70) return txt('Senior Happy รับอายุ 50-70 ปีครับ');
    const r = calcSeniorPremium(age, 200000, gender);
    if (!r) return txt('ไม่พบข้อมูลครับ');
    return makePremiumText('Senior Happy - ไม่ตรวจสุขภาพ', [
      { label: 'ทุนประกัน', value: '200,000 บาท' },
      { label: 'คุ้มครองถึงอายุ', value: '90 ปี' },
      { label: 'ไม่ต้องตรวจสุขภาพ', value: 'ใช่' },
      { label: 'เบี้ย/เดือน', value: `${Math.round(r.monthly).toLocaleString()} บาท` },
    ], `${Math.round(r.annualNet).toLocaleString()} บาท/ปี`);
  }
  return null;
}

async function handleFollow(event) {
  const uid = event.source.userId;
  userState.set(uid, 'onboarding_1');
  await lineReply(event.replyToken, [
    txt(`สวัสดีครับ! ผม ${AGENT.name} ตัวแทนประกัน AIA ขอถามสั้นๆ 3 ข้อนะครับ`),
    {
      type: 'text',
      text: 'ข้อ 1: เพศของคุณ?',
      quickReply: { items: [
        { type: 'action', action: { type: 'message', label: 'ชาย', text: 'เพศ: ชาย' }},
        { type: 'action', action: { type: 'message', label: 'หญิง', text: 'เพศ: หญิง' }},
      ]}
    }
  ]);
}

async function handleMessage(event) {
  const uid = event.source.userId;
  const msg = event.message.text.trim();
  const msgLower = msg.toLowerCase();
  const state = userState.get(uid) || 'chat';

  if (state === 'onboarding_1') {
    userProfiles.set(uid, { gender: msg.includes('ชาย') ? 'ชาย' : 'หญิง' });
    userState.set(uid, 'onboarding_2');
    return lineReply(event.replyToken, [txt('ข้อ 2: อายุ? (พิมพ์ตัวเลข เช่น 35)')]);
  }

  if (state === 'onboarding_2') {
    const n = parseInt(msg.replace(/[^0-9]/g, ''));
    if (isNaN(n) || n < 1 || n > 99) {
      return lineReply(event.replyToken, [txt('พิมพ์เฉพาะตัวเลขนะครับ เช่น 35')]);
    }
    userProfiles.set(uid, { ...(userProfiles.get(uid)||{}), age: n });
    userState.set(uid, 'onboarding_3');
    return lineReply(event.replyToken, [{
      type: 'text',
      text: 'ข้อ 3: เป้าหมายหลัก?',
      quickReply: { items: [
        { type: 'action', action: { type: 'message', label: 'ประกันชีวิต', text: 'เป้าหมาย: ประกันชีวิต' }},
        { type: 'action', action: { type: 'message', label: 'โรคร้ายแรง', text: 'เป้าหมาย: โรคร้ายแรง' }},
        { type: 'action', action: { type: 'message', label: 'สุขภาพ', text: 'เป้าหมาย: สุขภาพ' }},
        { type: 'action', action: { type: 'message', label: 'ครบทุกด้าน', text: 'เป้าหมาย: ครบทุกด้าน' }},
      ]}
    }]);
  }

  if (state === 'onboarding_3') {
    const p = userProfiles.get(uid) || {};
    userProfiles.set(uid, { ...p, goal: msg, onboarded: true });
    userState.set(uid, 'chat');
    const pf = userProfiles.get(uid);
    return lineReply(event.replyToken, [
      txt(`เยี่ยมเลยครับ! อายุ ${pf.age} ปี (${pf.gender}) เป้าหมาย: ${pf.goal} พร้อมให้คำปรึกษาแล้วครับ!`),
      makeMenuMessage()
    ]);
  }

  if (['เมนู', 'menu'].includes(msgLower)) {
    return lineReply(event.replyToken, [makeMenuMessage()]);
  }

  const profile = userProfiles.get(uid) || {};
  const calc = handleCalculator(msgLower, profile);
  if (calc) return lineReply(event.replyToken, [calc]);

  // AI CHAT
  if (!userHistory.has(uid)) userHistory.set(uid, []);
  const hist = userHistory.get(uid);
  hist.push({ role: 'user', content: msg });
  if (hist.length > 20) hist.splice(0, 2);

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system: `คุณคือ ${AGENT.name} ตัวแทนประกัน AIA ตอบภาษาไทย กระชับ แนะนำเฉพาะ AIA`,
    messages: hist,
  });

  const reply = resp.content[0].text;
  hist.push({ role: 'assistant', content: reply });
  await lineReply(event.replyToken, [txt(reply)]);
}

// WEBHOOK
app.post('/webhook', async (req, res) => {
  console.log('WEBHOOK:', JSON.stringify(req.body).substring(0, 100));
  res.status(200).json({ status: 'ok' });
  for (const event of (req.body?.events || [])) {
    try {
      if (event.type === 'follow') await handleFollow(event);
      else if (event.type === 'message' && event.message?.type === 'text') await handleMessage(event);
    } catch (err) {
      console.error('Error:', err.message);
    }
  }
});

app.get('/', (req, res) => res.send('AIA Line BOT is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AIA BOT Port ${PORT}`));
