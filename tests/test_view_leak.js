import assert from 'node:assert/strict';
import { getAnonClient } from './helpers.js';

async function testWorkerViewLeak() {
  const client = getAnonClient();
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: 'worker_1@whap.local',
    password: 'whap_demo_password_123'
  });
  assert(!authErr);
  console.log('Worker 1 logged in. User ID:', authData.user.id);

  const outsideId1 = '7193aae6-10ab-4a54-987d-c017b7ca396c';
  const outsideId2 = 'ce47a3f9-9e87-4919-91c5-47c6c6b8845c';

  // Test 1: Query tasks table
  const { data: rawData, error: rawErr } = await client
    .from('tasks')
    .select('id, title')
    .eq('id', outsideId1);
  console.log(`Query on 'tasks' table for outside task 7: rows=${rawData?.length}, error=${rawErr?.message}`);

  // Test 2: Query tasks_view
  const { data: viewData, error: viewErr } = await client
    .from('tasks_view')
    .select('id, title, budget, status')
    .eq('id', outsideId1);
  console.log(`Query on 'tasks_view' for outside task 7: rows=${viewData?.length}, error=${viewErr?.message}`);
  if (viewData && viewData.length > 0) {
    console.log('LEAKED TASK DATA VIA tasks_view:', viewData[0]);
  }

  // Test 3: List all from tasks_view
  const { data: allView, error: allErr } = await client
    .from('tasks_view')
    .select('id, title');
  console.log(`Total tasks returned by tasks_view to Worker 1: ${allView?.length}`);
  const hasTask7 = allView?.some(t => t.id === outsideId1);
  const hasTask8 = allView?.some(t => t.id === outsideId2);
  console.log(`Does tasks_view include outside Task 7 (> 2.8km)? ${hasTask7}`);
  console.log(`Does tasks_view include outside Task 8 (> 3.1km)? ${hasTask8}`);
}

testWorkerViewLeak().catch(console.error);
