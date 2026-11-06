import assert from 'node:assert/strict';
import { getAdminClient, getOrCreateTestUser } from './helpers.js';

async function testOtpOnTasksTable() {
  const adminClient = getAdminClient();
  const CAMPUS_CENTER = { lat: 13.0184, lng: 77.5684 };
  const campusPoint = `SRID=4326;POINT(${CAMPUS_CENTER.lng} ${CAMPUS_CENTER.lat})`;

  const requester = await getOrCreateTestUser({
    email: 'test_otp_req@whap.local',
    name: 'Req OTP Test',
    role: 'REQUESTER',
    lat: CAMPUS_CENTER.lat,
    lng: CAMPUS_CENTER.lng
  });

  const worker = await getOrCreateTestUser({
    email: 'test_otp_worker@whap.local',
    name: 'Worker OTP Test',
    role: 'WORKER',
    lat: CAMPUS_CENTER.lat,
    lng: CAMPUS_CENTER.lng
  });

  // Create an ASSIGNED task with secret OTP 9999
  const { data: task, error: taskErr } = await adminClient
    .from('tasks')
    .insert({
      requester_id: requester.userId,
      assigned_worker_id: worker.userId,
      title: 'Secret OTP Exposure Test',
      category: 'OTHER',
      budget: 100.00,
      location: campusPoint,
      status: 'ASSIGNED',
      agreed_price: 90.00,
      otp_code: '9999'
    })
    .select()
    .single();
  assert.ifError(taskErr);

  console.log('Task created with secret OTP: 9999');

  // 1. Worker queries tasks_view
  const { data: viewData, error: viewErr } = await worker.client
    .from('tasks_view')
    .select('id, otp_code')
    .eq('id', task.id)
    .single();

  console.log('Worker query on tasks_view:', {
    otp_code: viewData?.otp_code,
    error: viewErr?.message
  });

  // 2. Worker queries raw tasks table directly
  const { data: rawData, error: rawErr } = await worker.client
    .from('tasks')
    .select('id, otp_code')
    .eq('id', task.id)
    .single();

  console.log('Worker query on raw tasks table:', {
    otp_code: rawData?.otp_code,
    error: rawErr?.message
  });

  // 3. Worker queries raw tasks table for OPEN task (not assigned to them)
  const { data: openTask, error: openErr } = await adminClient
    .from('tasks')
    .insert({
      requester_id: requester.userId,
      title: 'Open Task with OTP',
      category: 'OTHER',
      budget: 100.00,
      location: campusPoint,
      status: 'OPEN',
      otp_code: '8888'
    })
    .select()
    .single();
  assert.ifError(openErr);

  const { data: rawOpenData, error: rawOpenErr } = await worker.client
    .from('tasks')
    .select('id, otp_code')
    .eq('id', openTask.id)
    .single();

  console.log('Worker query on raw tasks table for OPEN task:', {
    otp_code: rawOpenData?.otp_code,
    error: rawOpenErr?.message
  });

  // Cleanup
  await adminClient.from('tasks').delete().eq('id', task.id);
  await adminClient.from('tasks').delete().eq('id', openTask.id);
}

testOtpOnTasksTable().catch(console.error);
