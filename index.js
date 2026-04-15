require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const Anthropic = require('@anthropic-ai/sdk');
const { calcSeniorPremium, T_PKG_C, T_PKG_D } = require('./premiumTables');

const app = express();
app.use(express.json());

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AGENT = { name:'WIT-K', phone:'088-965-6635' };
const userProfiles = new Map();
const userHistory  = new Map();
const userState    = new Map();

function makeMenuMessage() {
  return {
    type:'text',
    text:`ЁЯФ┤ ${AGENT.name} Insurance Advisor\n\n1 р╕Ыр╕гр╕░р╕Бр╕▒р╕Щр╕Кр╕╡р╕зр╕┤р╕Х\n2 CI SuperCare\n3 Package C\n4 Package D\n5 Senior Happy\n\nр╕Юр╕┤р╕бр╕Юр╣Мр╣Ар╕ер╕Вр╕лр╕гр╕╖р╕нр╕Цр╕▓р╕бр╣Др╕Фр╣Йр╣Ар╕ер╕вр╕Др╕гр╕▒р╕Ъ`,
    quickReply:{ items:[
      { type:'action', action:{ type:'message', label:'Package C', text:'package c' }},
      { type:'action', action:{ type:'message', label:'Package D', text:'package d' }},
      { type:'action', action:{ type:'message', label:'р╕Хр╕┤р╕Фр╕Хр╣Ир╕н WIT-K', text:'р╕Вр╕нр╕Др╕│р╣Бр╕Щр╕░р╕Щр╕│р╕Ир╕▓р╕Б WIT-K' }},
    ]}
  };
}

function makePremiumCard(title, rows, total) {
  return {
    type:'flex', altText:title,
    contents:{
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
          { type:'text', text:'р╣Ар╕Ър╕╡р╣Йр╕вр╕гр╕зр╕б/р╕Ыр╕╡', size:'sm', weight:'bold', flex:3 },
          { type:'text', text:total, size:'sm', weight:'bold', color:'#C8102E', align:'end', flex:2 }
        ]}
      ]},
      footer:{ type:'box', layout:'vertical', contents:[{
        type:'button', style:'primary', color:'#C8102E',
        action:{ type:'message', label:'р╕кр╕Щр╣Гр╕И р╕Хр╕┤р╕Фр╕Хр╣Ир╕н WIT-K', text:'р╕Вр╕нр╕Др╕│р╣Бр╕Щр╕░р╕Щр╕│р╕Ир╕▓р╕Б WIT-K' }
      }]}
    }
  };
}

function makeAgentCard() {
  return {
    type:'flex', altText:`р╕Хр╕┤р╕Фр╕Хр╣Ир╕н ${AGENT.name} ${AGENT.phone}`,
    contents:{
      type:'bubble',
      body:{ type:'box', layout:'vertical', spacing:'sm', contents:[
        { type:'text', text:`ЁЯФ┤ ${AGENT.name} тАФ р╕Хр╕▒р╕зр╣Бр╕Чр╕Щ AIA`, weight:'bold', size:'sm', color:'#C8102E' },
        { type:'text', text:`ЁЯУЮ ${AGENT.phone}`, size:'sm', margin:'sm' },
        { type:'text', text:'тЬЕ р╕Ыр╕гр╕╢р╕Бр╕йр╕▓р╕Яр╕гр╕╡ р╣Др╕бр╣Ир╕бр╕╡р╕Др╣Ир╕▓р╣Гр╕Кр╣Йр╕Ир╣Ир╕▓р╕в', size:'xs', color:'#555' },
      ]},
      footer:{ type:'box', layout:'vertical', contents:[{
        type:'button', style:'primary', color:'#C8102E',
        action:{ type:'uri', label:'ЁЯУЮ р╣Вр╕Чр╕гр╣Ар╕ер╕в', uri:`tel:${AGENT.phone.replace(/-/g,'')}` }
      }]}
    }
  };
}

function handleCalculator(text, profile) {
  const age = profile?.age;
  const gender = profile?.gender==='р╕лр╕Нр╕┤р╕З' ? 'female' : 'male';
  if (!age) return { type:'text', text:'р╕Бр╕гр╕╕р╕Ур╕▓р╕Ър╕нр╕Бр╕нр╕▓р╕вр╕╕р╕Бр╣Ир╕нр╕Щр╕Щр╕░р╕Др╕гр╕▒р╕Ъ р╣Ар╕Кр╣Ир╕Щ р╕нр╕▓р╕вр╕╕ 35 р╕Ыр╕╡' };

  if (text.includes('package c')) {
    const table = gender==='male' ? T_PKG_C.M : T_PKG_C.F;
    const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
    let cl=keys[0]; for(const k of keys){if(Math.abs(k-age)<Math.abs(cl-age))cl=k;}
    const ann=table[cl];
    return makePremiumCard('Package C',[
      { label:'р╕Кр╕╡р╕зр╕┤р╕Х 20PLNP', value:'100,000 B' },
      { label:'CI Plus', value:'500,000 B' },
      { label:'Health Happy', value:'5,000,000 B/yr' },
      { label:'р╣Ар╕Ър╕╡р╣Йр╕в/р╣Ар╕Фр╕╖р╕нр╕Щ', value:`${Math.round(ann/12).toLocaleString()} B` },
      { label:'р╣Ар╕Ър╕╡р╣Йр╕в/р╕зр╕▒р╕Щ', value:`${Math.round(ann/365)} B` },
    ],`${Math.round(ann).toLocaleString()} B`);
  }

  if (text.includes('package d')) {
    const table = gender==='male' ? T_PKG_D.M : T_PKG_D.F;
    const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
    let cl=keys[0]; for(const k of keys){if(Math.abs(k-age)<Math.abs(cl-age))cl=k;}
    const ann=table[cl];
    return makePremiumCard('Package D',[
      { label:'р╕Кр╕╡р╕зр╕┤р╕Х 20PLNP', value:'100,000 B' },
      { label:'CI Plus', value:'2,000,000 B' },
      { label:'AHC', value:'1,000,000 B' },
      { label:'HBX', value:'1,000 B/day' },
      { label:'Health Happy', value:'5,000,000 B/yr' },
      { label:'р╣Ар╕Ър╕╡р╣Йр╕в/р╣Ар╕Фр╕╖р╕нр╕Щ', value:`${Math.round(ann/12).toLocaleString()} B` },
    ],`${Math.round(ann).toLocaleString()} B`);
  }

  if (text.includes('senior')||text.includes('senior happy')) {
    if(age<50||age>70) return { type:'text', text:'Senior Happy р╕гр╕▒р╕Ър╕нр╕▓р╕вр╕╕ 50-70 р╕Ыр╕╡р╕Др╕гр╕▒р╕Ъ' };
    const r=calcSeniorPremium(age,200000,gender);
    if(!r) return { type:'text', text:'р╣Др╕бр╣Ир╕Юр╕Ър╕Вр╣Йр╕нр╕бр╕╣р╕ер╕Др╕гр╕▒р╕Ъ' };
    return makePremiumCard('Senior Happy',[
      { label:'р╕Чр╕╕р╕Щр╕Ыр╕гр╕░р╕Бр╕▒р╕Щ', value:'200,000 B' },
      { label:'р╕Др╕╕р╣Йр╕бр╕Др╕гр╕нр╕Зр╕Цр╕╢р╕Зр╕нр╕▓р╕вр╕╕', value:'90 р╕Ыр╕╡' },
      { label:'р╕Хр╕гр╕зр╕Ир╕кр╕╕р╕Вр╕ар╕▓р╕Ю', value:'р╣Др╕бр╣Ир╕Хр╣Йр╕нр╕З' },
      { label:'р╣Ар╕Ър╕╡р╣Йр╕в/р╣Ар╕Фр╕╖р╕нр╕Щ', value:`${Math.round(r.monthly).toLocaleString()} B` },
    ],`${Math.round(r.annualNet).toLocaleString()} B/yr`);
  }
  return null;
}

async function handleFollow(event) {
  const uid = event.source.userId;
  userState.set(uid, 'onboarding_1');
  await lineClient.replyMessage({ replyToken:event.replyToken, messages:[
    { type:'text', text:`р╕кр╕зр╕▒р╕кр╕Фр╕╡р╕Др╕гр╕▒р╕Ъ! р╕Ьр╕б ${AGENT.name} р╕Хр╕▒р╕зр╣Бр╕Чр╕Щр╕Ыр╕гр╕░р╕Бр╕▒р╕Щ AIA р╕Вр╕нр╕Цр╕▓р╕бр╕кр╕▒р╣Йр╕Щр╣Ж 3 р╕Вр╣Йр╕нр╕Щр╕░р╕Др╕гр╕▒р╕Ъ` },
    { type:'text', text:'р╕Вр╣Йр╕н 1: р╣Ар╕Юр╕ир╕Вр╕нр╕Зр╕Др╕╕р╕У?',
      quickReply:{ items:[
        { type:'action', action:{ type:'message', label:'р╕Кр╕▓р╕в', text:'р╣Ар╕Юр╕и: р╕Кр╕▓р╕в' }},
        { type:'action', action:{ type:'message', label:'р╕лр╕Нр╕┤р╕З', text:'р╣Ар╕Юр╕и: р╕лр╕Нр╕┤р╕З' }},
      ]}
    }
  ]});
}

async function handleMessage(event) {
  const uid = event.source.userId;
  const msg = event.message.text.trim();
  const msgLower = msg.toLowerCase();
  const state = userState.get(uid) || 'chat';

  if (state==='onboarding_1') {
    userProfiles.set(uid,{ gender:msg.includes('р╕Кр╕▓р╕в')?'р╕Кр╕▓р╕в':'р╕лр╕Нр╕┤р╕З' });
    userState.set(uid,'onboarding_2');
    return lineClient.replyMessage({ replyToken:event.replyToken, messages:[{
      type:'text', text:'р╕Вр╣Йр╕н 2: р╕нр╕▓р╕вр╕╕? (р╕Юр╕┤р╕бр╕Юр╣Мр╕Хр╕▒р╕зр╣Ар╕ер╕В р╣Ар╕Кр╣Ир╕Щ 35)'
    }]});
  }

  if (state==='onboarding_2') {
    const n=parseInt(msg.replace(/[^0-9]/g,''));
    if(isNaN(n)||n<1||n>99){
      return lineClient.replyMessage({ replyToken:event.replyToken, messages:[{ type:'text', text:'р╕Юр╕┤р╕бр╕Юр╣Мр╣Ар╕Йр╕Юр╕▓р╕░р╕Хр╕▒р╕зр╣Ар╕ер╕Вр╕Щр╕░р╕Др╕гр╕▒р╕Ъ р╣Ар╕Кр╣Ир╕Щ 35' }]});
    }
    userProfiles.set(uid,{...(userProfiles.get(uid)||{}), age:n});
    userState.set(uid,'onboarding_3');
    return lineClient.replyMessage({ replyToken:event.replyToken, messages:[{
      type:'text', text:'р╕Вр╣Йр╕н 3: р╣Ар╕Ыр╣Йр╕▓р╕лр╕бр╕▓р╕вр╕лр╕ер╕▒р╕Б?',
      quickReply:{ items:[
        { type:'action', action:{ type:'message', label:'р╕Ыр╕гр╕░р╕Бр╕▒р╕Щр╕Кр╕╡р╕зр╕┤р╕Х', text:'р╣Ар╕Ыр╣Йр╕▓р╕лр╕бр╕▓р╕в: р╕Ыр╕гр╕░р╕Бр╕▒р╕Щр╕Кр╕╡р╕зр╕┤р╕Х' }},
        { type:'action', action:{ type:'message', label:'р╣Вр╕гр╕Др╕гр╣Йр╕▓р╕вр╣Бр╕гр╕З', text:'р╣Ар╕Ыр╣Йр╕▓р╕лр╕бр╕▓р╕в: р╣Вр╕гр╕Др╕гр╣Йр╕▓р╕вр╣Бр╕гр╕З' }},
        { type:'action', action:{ type:'message', label:'р╕кр╕╕р╕Вр╕ар╕▓р╕Ю', text:'р╣Ар╕Ыр╣Йр╕▓р╕лр╕бр╕▓р╕в: р╕кр╕╕р╕Вр╕ар╕▓р╕Ю' }},
        { type:'action', action:{ type:'message', label:'р╕Др╕гр╕Ър╕Чр╕╕р╕Бр╕Фр╣Йр╕▓р╕Щ', text:'р╣Ар╕Ыр╣Йр╕▓р╕лр╕бр╕▓р╕в: р╕Др╕гр╕Ър╕Чр╕╕р╕Бр╕Фр╣Йр╕▓р╕Щ' }},
      ]}
    }]});
  }

  if (state==='onboarding_3') {
    const p=userProfiles.get(uid)||{};
    userProfiles.set(uid,{...p,goal:msg,onboarded:true});
    userState.set(uid,'chat');
    const pf=userProfiles.get(uid);
    return lineClient.replyMessage({ replyToken:event.replyToken, messages:[
      { type:'text', text:`р╣Ар╕вр╕╡р╣Ир╕вр╕бр╣Ар╕ер╕вр╕Др╕гр╕▒р╕Ъ! р╕нр╕▓р╕вр╕╕ ${pf.age} р╕Ыр╕╡ (${pf.gender}) р╣Ар╕Ыр╣Йр╕▓р╕лр╕бр╕▓р╕в: ${pf.goal} р╕Юр╕гр╣Йр╕нр╕бр╣Гр╕лр╣Йр╕Др╕│р╕Ыр╕гр╕╢р╕Бр╕йр╕▓р╣Бр╕ер╣Йр╕зр╕Др╕гр╕▒р╕Ъ!` },
      makeMenuMessage()
    ]});
  }

  if(['р╣Ар╕бр╕Щр╕╣','menu'].includes(msgLower)){
    return lineClient.replyMessage({ replyToken:event.replyToken, messages:[makeMenuMessage()] });
  }

  const profile = userProfiles.get(uid)||{};
  const calc = handleCalculator(msgLower, profile);
  if (calc) return lineClient.replyMessage({ replyToken:event.replyToken, messages:[calc] });

  if(!userHistory.has(uid)) userHistory.set(uid,[]);
  const hist=userHistory.get(uid);
  hist.push({ role:'user', content:msg });
  if(hist.length>20) hist.splice(0,2);

  const resp=await anthropic.messages.create({
    model:'claude-sonnet-4-20250514', max_tokens:600,
    system:`р╕Др╕╕р╕Ур╕Др╕╖р╕н ${AGENT.name} р╕Хр╕▒р╕зр╣Бр╕Чр╕Щр╕Ыр╕гр╕░р╕Бр╕▒р╕Щ AIA р╕Хр╕нр╕Ър╕ар╕▓р╕йр╕▓р╣Др╕Чр╕в р╕Бр╕гр╕░р╕Кр╕▒р╕Ъ р╣Бр╕Щр╕░р╕Щр╕│р╣Ар╕Йр╕Юр╕▓р╕░ AIA р╣Ар╕Юр╕┤р╣Ир╕б [RECOMMEND_AGENT] р╣Ар╕бр╕╖р╣Ир╕нр╕Ьр╕╣р╣Йр╣Гр╕Кр╣Йр╕Вр╕нр╕кр╕бр╕▒р╕Др╕гр╕лр╕гр╕╖р╕нр╕Хр╣Йр╕нр╕Зр╕Бр╕▓р╕гр╣Гр╕Ър╣Ар╕кр╕Щр╕нр╕гр╕▓р╕Др╕▓`,
    messages:hist,
  });

  const reply=resp.content[0].text;
  const clean=reply.replace('[RECOMMEND_AGENT]','').trim();
  hist.push({ role:'assistant', content:clean });

  const msgs=[{ type:'text', text:clean }];
  if(reply.includes('[RECOMMEND_AGENT]')) msgs.push(makeAgentCard());
  return lineClient.replyMessage({ replyToken:event.replyToken, messages:msgs });
}

// ===== WEBHOOK тАФ р╣Др╕бр╣И verify signature р╣Ар╕Юр╕╖р╣Ир╕нр╕Чр╕Фр╕кр╕нр╕Ъ =====
app.post('/webhook', async (req, res) => {
  console.log('WEBHOOK HIT - events:', req.body?.events?.length || 0);
  res.status(200).json({ status:'ok' });

  for(const event of (req.body?.events||[])){
    try{
      console.log('Processing:', event.type, event.message?.text||'');
      if(event.type==='follow') await handleFollow(event);
      else if(event.type==='message'&&event.message?.type==='text') await handleMessage(event);
    }catch(err){
      console.error('Error:', err.message);
    }
  }
});

app.get('/', (req,res) => res.send('AIA Line BOT is running!'));

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`AIA Line BOT тАФ Port ${PORT}`));
