const {test}=require('node:test');const assert=require('node:assert/strict');const request=require('supertest');const {randomUUID}=require('node:crypto');
process.env.NODE_ENV='test';
require('reflect-metadata');
const {createApp}=require('../dist/backend/src/main');
test('full API journey, ownership, DTO validation and session management',async()=>{
 const app=await createApp();app.useLogger(false);await app.init();const agent=request(app.getHttpServer());
 try{
  const health=(await agent.get('/api/v1/health').expect(200)).body;
  assert.equal(health.status,'ok');
  assert.equal(health.database,'connected');
  await agent.post('/api/v1/quests').send({}).expect(401);
  await agent.post('/api/v1/users/session').send({name:'E',unexpected:true}).expect(400);
  const session=(await agent.post('/api/v1/users/session').send({name:'Explorer'}).expect(201)).body;
  const auth={Authorization:`Bearer ${session.token}`};
  assert.equal(session.user.tokenHash,undefined);assert.equal(session.token.length,43);
  await agent.patch('/api/v1/users/me').set(auth).send({voice:true,name:'Walker'}).expect(200);
  const me=(await agent.get('/api/v1/users/me').set(auth).expect(200)).body;
  assert.equal(me.name,'Walker');assert.equal(me.voice,true);
  const list=(await agent.get('/api/v1/quests').set(auth).expect(200)).body;
  assert.ok(Array.isArray(list));
 }finally{await app.close();}
});

