const {test}=require('node:test');
const assert=require('node:assert/strict');
require('reflect-metadata');
const {mergeProgress,validateImage,hashToken}=require('../dist/backend/src/domain');
const {assertSafe,assertBudget}=require('../dist/backend/src/safety');
const {questPlanSchema,emptyProgress}=require('../dist/backend/src/shared');
const {validateEnvironment}=require('../dist/backend/src/config');
const {MemoryStore}=require('../dist/backend/src/store');
const config={minutes:30,mood:'peaceful',location:'A public park',mobility:'standard',company:'solo'};
const createTestPlan = (minutes = 30) => {
  const count = minutes <= 20 ? 3 : minutes <= 45 ? 4 : 5;
  const base = Math.floor(minutes / count);
  const rem = minutes % count;
  const steps = Array(count).fill(0).map((_, i) => ({
    title: `Step ${i + 1}`,
    instruction: 'Observe the shapes and colors from a safe public path.',
    minutes: base + (i < rem ? 1 : 0),
    phoneAway: i % 2 === 1
  }));
  return {
    title: 'Mindful Walk in Park',
    description: 'A quiet nature observation stroll.',
    steps,
    bingo: ['leaf','bird','stone','moss','cloud','breeze','flower','bark','sun']
  };
};
test('sample quests validate and exactly match every offered time budget',()=>{for(const minutes of [15,30,45,60,120]){const p=questPlanSchema.parse(createTestPlan(minutes));assertBudget(p,minutes);}});
test('reject malformed plans, repeated bingo and duration mismatch',()=>{const p=createTestPlan(30);assert.throws(()=>questPlanSchema.parse({...p,bingo:Array(9).fill('leaf')}));assert.throws(()=>assertBudget(p,45));assert.throws(()=>questPlanSchema.parse({...p,steps:[]}));});
test('safety layer rejects hazardous outdoor actions',()=>{for(const instruction of ['Eat this mushroom to find its flavor.','Climb the cliff for a better view.','Try an off-trail route toward the lake.','Feed the birds some of your lunch.']){const p=createTestPlan(30);p.steps[0].instruction=instruction;assert.throws(()=>assertSafe(p));}const p=createTestPlan(30);assert.doesNotThrow(()=>assertSafe(p));});
test('progress preserves order, merges offline state, and completes monotonically',()=>{
  const now=new Date('2026-10-07T10:00:00Z');
  const patch={status:'active',completedSteps:[],bingo:[],screenSeconds:0,elapsedSeconds:0};
  const active=mergeProgress(emptyProgress(),patch,3,now);
  assert.equal(active.startedAt,now.toISOString());
  assert.throws(()=>mergeProgress(active,{...patch,completedSteps:[1]},3,now));
  assert.throws(()=>mergeProgress(active,{...patch,status:'completed',completedSteps:[0]},3,now));
  assert.throws(()=>mergeProgress(active,{...patch,elapsedSeconds:100},3,now));
  assert.throws(()=>mergeProgress(active,{...patch,elapsedSeconds:1,screenSeconds:2},3,now));
  const progress=mergeProgress(active,{...patch,completedSteps:[0],bingo:[1],elapsedSeconds:30,screenSeconds:5},3,new Date(now.getTime()+30000));
  const stale=mergeProgress(progress,{...patch,status:'ready',bingo:[2]},3,new Date(now.getTime()+30000));
  assert.equal(stale.status,'active');assert.deepEqual(stale.bingo,[1,2]);assert.deepEqual(stale.completedSteps,[0]);
  const complete=mergeProgress(stale,{...patch,status:'completed',completedSteps:[0,1,2]},3,new Date(now.getTime()+30000));
  assert.equal(complete.status,'completed');assert.deepEqual(mergeProgress(complete,patch,3,now),complete);
});
test('file validation checks the image bytes and declared MIME type',()=>{assert.throws(()=>validateImage({mimetype:'image/jpeg',buffer:Buffer.from('<script>no</script>')}));assert.throws(()=>validateImage({mimetype:'image/png',buffer:Buffer.from([255,216,255])}));assert.equal(validateImage({mimetype:'image/jpeg',buffer:Buffer.from([255,216,255,0])}).mimeType,'image/jpeg');});
test('memory persistence enforces ownership and optimistic progress writes',async()=>{const s=new MemoryStore();const q={id:'q',userId:'owner',...createTestPlan(30),config,source:'gemma',safety:[],progress:emptyProgress(),createdAt:new Date().toISOString()};await s.saveQuest(q);await assert.rejects(s.quest('q','other'));await s.progress('q','owner',{...emptyProgress(),revision:1},0);await assert.rejects(s.progress('q','owner',emptyProgress(),0));const retrieved=await s.quest('q','owner');retrieved.title='changed';assert.notEqual((await s.quest('q','owner')).title,'changed');});
test('environment validation requires MONGODB_URI and validates defaults',()=>{assert.throws(()=>validateEnvironment({}));assert.equal(validateEnvironment({MONGODB_URI:'mongodb://localhost:27017/earthly'}).PORT,4000);assert.notEqual(hashToken('token'),'token');});

