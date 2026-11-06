import assert from 'node:assert/strict';
import { getAdminClient, getOrCreateTestUser } from './helpers.js';

async function testCrossRequester() {
  const adminClient = getAdminClient();
  const CAMPUS_CENTER = { lat: 13.0184, lng: 77.5684 };
  const OUTSIDE_LOCATION = { lat: 13.0460, lng: 77.5684 }; // ~3.0 km away

  const req1 = await getOrCreateTestUser({
    email: 'test_cross_req1@whap.local',
    name: 'Req 1',
    role: 'REQUESTER',
    lat: CAMPUS_CENTER.lat,
    lng: CAMPUS_CENTER.lng
  });

  const req2 = await getOrCreateTestUser({
    email: 'test_cross_req2@whap.local',
    name: 'Req 2',
    role: 'REQUESTER',
    lat: CAMPUS_CENTER.lat,
    lng: CAMPUS_CENTER.lng
  });

  const outsidePoint = `SRID=4326;POINT(${OUTSIDE_LOCATION.lng} ${OUTSIDE_LOCATION.lat})`;
  const { data: outsideTask, error: outErr } = await adminClient
    .from('tasks')
    .insert({
      requester_id: req2.userId,
      title: 'Req2 Far Outside Task',
      category: 'OTHER',
      budget: 150.00,
      location: outsidePoint,
      status: 'OPEN'
    })
    .select()
    .single();
  assert.ifError(outErr);

  // Req 1 queries Req 2's outside task on tasks and tasks_view
  const { data: rawData } = await req1.client
    .from('tasks')
    .select('id, title')
    .eq('id', outsideTask.id);

  const { data: viewData } = await req1.client
    .from('tasks_view')
    .select('id, title')
    .eq('id', outsideTask.id);

  console.log('Req 1 query for Req 2 outside task on tasks:', rawData?.length);
  console.log('Req 1 query for Req 2 outside task on tasks_view:', viewData?.length);

  // Cleanup
  await adminClient.from('tasks').delete().eq('id', outsideTask.id);
}

testCrossRequester().catch(console.error);
