import assert from 'node:assert/strict';
import { getAdminClient, getAnonClient, getOrCreateTestUser } from './helpers.js';

async function testAssignedWorkerVisibility() {
  const adminClient = getAdminClient();
  const CAMPUS_CENTER = { lat: 13.0184, lng: 77.5684 };
  const campusPoint = `SRID=4326;POINT(${CAMPUS_CENTER.lng} ${CAMPUS_CENTER.lat})`;

  const requester = await getOrCreateTestUser({
    email: 'test_req_assigned@whap.local',
    name: 'Req Assigned',
    role: 'REQUESTER',
    lat: CAMPUS_CENTER.lat,
    lng: CAMPUS_CENTER.lng
  });

  const worker = await getOrCreateTestUser({
    email: 'test_worker_assigned@whap.local',
    name: 'Worker Assigned',
    role: 'WORKER',
    lat: CAMPUS_CENTER.lat,
    lng: CAMPUS_CENTER.lng
  });

  // Create an ASSIGNED task
  const { data: task, error: taskErr } = await adminClient
    .from('tasks')
    .insert({
      requester_id: requester.userId,
      assigned_worker_id: worker.userId,
      title: 'Assigned Job Visibility Probe',
      category: 'OTHER',
      budget: 100.00,
      location: campusPoint,
      status: 'ASSIGNED',
      agreed_price: 90.00,
      otp_code: '1234'
    })
    .select()
    .single();
  assert.ifError(taskErr);

  console.log('Created ASSIGNED task:', task.id, 'assigned to worker:', worker.userId);

  // Worker queries tasks table for their own assigned task
  const { data: directData, error: directErr } = await worker.client
    .from('tasks')
    .select('id, title, status')
    .eq('id', task.id);

  console.log(`Assigned worker direct query on 'tasks' table: rows=${directData?.length}, error=${directErr?.message}`);

  // Worker queries tasks_view for their own assigned task
  const { data: viewData, error: viewErr } = await worker.client
    .from('tasks_view')
    .select('id, title, status')
    .eq('id', task.id);

  console.log(`Assigned worker query on 'tasks_view': rows=${viewData?.length}, error=${viewErr?.message}`);

  // Cleanup
  await adminClient.from('tasks').delete().eq('id', task.id);
}

testAssignedWorkerVisibility().catch(console.error);
