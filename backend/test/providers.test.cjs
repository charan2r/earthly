const {test}=require('node:test');const assert=require('node:assert/strict');require('reflect-metadata');
const {GemmaService,SerpApiService,ElevenLabsService}=require('../dist/backend/src/providers');
const createTestPlan = (minutes = 30) => ({
  title: 'Peaceful Stroll in Park',
  description: 'A mindful walk in nature.',
  steps: [
    { title: 'Step 1', instruction: 'Observe the world from a safe public path.', minutes: 10 },
    { title: 'Step 2', instruction: 'Observe tree patterns from a safe public path.', minutes: 10 },
    { title: 'Step 3', instruction: 'Mindful return along the public path.', minutes: 10 }
  ],
  bingo: ['leaf','bird','stone','moss','cloud','breeze','flower','bark','sun']
});
test('provider adapters form correct requests and validate model responses without paid calls',async()=>{
 const saved=global.fetch;const captured=[];let response;
 const config={GEMMA_PROVIDER:'google',GEMMA_BASE_URL:'https://example.test/v1beta',GEMMA_MODEL:'gemma-test',GEMMA_API_KEY:'test',SERPAPI_API_KEY:'test',SERPAPI_BASE_URL:'https://example.test/search',ELEVENLABS_API_KEY:'test',ELEVENLABS_VOICE_ID:'voice-test',ELEVENLABS_BASE_URL:'https://example.test/v1',ELEVENLABS_MODEL:'voice-model'};
 const env={get:key=>config[key]};
 global.fetch=async(url,init)=>{captured.push({url,init});return new Response(response,{status:200,headers:{'Content-Type':'application/json'}});};
 try{
  const pref={minutes:30,mood:'peaceful',location:'Park',mobility:'standard',company:'solo'};const plan=createTestPlan(30);
  response=JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(plan)}]}}]});
  assert.equal((await new GemmaService(env).generate(pref)).title,plan.title);
  assert.match(captured[0].url,/gemma-test:generateContent/);assert.equal(captured[0].init.headers['x-goog-api-key'],'test');
  const insight={label:'A possible leaf',insight:'Notice the visible shape and color from a distance.',curiosity:'What patterns can you see?',confidence:'low'};
  response=JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(insight)}]}}]});
  await new GemmaService(env).observe('Leaf',{mimeType:'image/jpeg',base64:'aW1hZ2U='});assert.equal(JSON.parse(captured.at(-1).init.body).contents[0].parts[1].inlineData.mimeType,'image/jpeg');
  config.GEMMA_PROVIDER='openai-compatible';response=JSON.stringify({choices:[{message:{content:JSON.stringify(insight)}}]});await new GemmaService(env).observe('Leaf');assert.match(captured.at(-1).url,/chat\/completions/);
  response=JSON.stringify({local_results:[{place_id:'park',title:'Public Park',address:'Main Road',gps_coordinates:{latitude:1,longitude:2}}]});assert.equal((await new SerpApiService(env).discover('Town',1,2))[0].source,'serpapi');assert.match(captured.at(-1).url,/engine=google_maps/);
  response='audio';assert.equal((await new ElevenLabsService(env).speak('Notice the trees.')).toString(),'audio');assert.equal(captured.at(-1).init.headers['xi-api-key'],'test');
  response=JSON.stringify({choices:[{message:{content:'not JSON'}}]});await assert.rejects(new GemmaService(env).observe('Leaf'));
 }finally{global.fetch=saved;}
});

