import { getAnonClient } from './helpers.js';

async function testAnonAccess() {
  const anon = getAnonClient();

  const { data: rawTasks, error: rawErr } = await anon.from('tasks').select('id, title');
  console.log('Anon query on tasks:', { count: rawTasks?.length, error: rawErr?.message });

  const { data: viewTasks, error: viewErr } = await anon.from('tasks_view').select('id, title');
  console.log('Anon query on tasks_view:', { count: viewTasks?.length, error: viewErr?.message });

  const { data: profiles, error: profErr } = await anon.from('profiles').select('id');
  console.log('Anon query on profiles:', { count: profiles?.length, error: profErr?.message });

  const { data: wallets, error: walErr } = await anon.from('wallets').select('id');
  console.log('Anon query on wallets:', { count: wallets?.length, error: walErr?.message });
}

testAnonAccess().catch(console.error);
