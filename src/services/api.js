// src/services/api.js
import { supabase } from './supabaseClient';

/**
 * Universal RPC invoker with dual-parameter fallback and normalized errors
 */
async function invokeRpc(fnName, primaryParams, fallbackParams = null) {
  let { data, error } = await supabase.rpc(fnName, primaryParams);

  if (error && (error.code === 'PGRST202' || error.message?.includes('schema')) && fallbackParams) {
    const retry = await supabase.rpc(fnName, fallbackParams);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    const cleanMessage = error.message || error.details || error.hint || 'Database operation failed';
    const err = new Error(cleanMessage);
    err.code = error.code;
    err.details = error.details;
    err.hint = error.hint;
    err.raw = error;
    throw err;
  }

  return data;
}

export const api = {
  // =========================================================================
  // 1. Task Operations
  // =========================================================================

  /**
   * Post a new campus task (Requester)
   * Enforces: budget ₹50-₹300, max 3 open tasks
   */
  async postTask({ title, description, category, budget, latitude, longitude, address }) {
    return invokeRpc(
      'post_task',
      {
        p_title: title,
        p_category: category,
        p_budget: Number(budget),
        p_lat: Number(latitude),
        p_lng: Number(longitude),
        p_description: description || null,
        p_address: address || null,
      },
      {
        p_title: title,
        p_category: category,
        p_budget: Number(budget),
        p_latitude: Number(latitude),
        p_longitude: Number(longitude),
        p_description: description || null,
        p_address: address || null,
      }
    );
  },

  /**
   * Discover open tasks within 1.5 km (Worker)
   * Strictly filtered by PostGIS ST_DWithin <= 1500m
   */
  async getNearbyTasks({ latitude, longitude, radiusMeters = 1500 }) {
    return invokeRpc(
      'nearby_tasks',
      {
        p_lat: Number(latitude),
        p_lng: Number(longitude),
        p_radius_meters: Number(radiusMeters),
      },
      {
        p_latitude: Number(latitude),
        p_longitude: Number(longitude),
        p_radius_meters: Number(radiusMeters),
      }
    );
  },

  /**
   * Fetch single task with requester, worker, bids, and escrow context.
   * Uses tasks_view to ensure worker cannot see requester OTP code.
   */
  async getTaskById(taskId) {
    const { data: task, error: taskError } = await supabase
      .from('tasks_view')
      .select(`
        *,
        requester:requester_id (id, name, rating_average, rating_count),
        worker:assigned_worker_id (id, name, rating_average, rating_count)
      `)
      .eq('id', taskId)
      .maybeSingle();

    if (taskError) throw taskError;
    if (!task) throw new Error('Task not found');

    // Associated bids
    const { data: bids, error: bidsError } = await supabase
      .from('bids')
      .select(`
        *,
        worker:worker_id (id, name, rating_average, rating_count)
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (bidsError) console.warn('Bids query warning:', bidsError);

    // Escrow info
    const { data: escrow, error: escrowError } = await supabase
      .from('escrow_transactions')
      .select('*')
      .eq('task_id', taskId)
      .maybeSingle();

    if (escrowError) console.warn('Escrow query warning:', escrowError);

    // Reviews if completed
    const { data: reviews } = await supabase
      .from('reviews')
      .select('*')
      .eq('task_id', taskId);

    return {
      ...task,
      bids: bids || [],
      escrow: escrow || null,
      reviews: reviews || [],
    };
  },

  /**
   * Fetch active tasks posted by a requester
   */
  async getRequesterTasks(requesterId) {
    const { data, error } = await supabase
      .from('tasks_view')
      .select('*, bids(id, price, status)')
      .eq('requester_id', requesterId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // =========================================================================
  // 2. Bidding & Acceptance (Reverse Bidding & Concurrency-Safe Escrow)
  // =========================================================================

  /**
   * Submit or update reverse bid on an open task (Worker)
   * Enforces: min ₹20, max 2x budget, <=1500m
   */
  async placeBid({ taskId, price, latitude = null, longitude = null, message = null }) {
    return invokeRpc(
      'place_bid',
      {
        p_task_id: taskId,
        p_price: Number(price),
        p_lat: latitude ? Number(latitude) : null,
        p_lng: longitude ? Number(longitude) : null,
        p_message: message,
      },
      {
        p_task_id: taskId,
        p_amount: Number(price),
        p_latitude: latitude ? Number(latitude) : null,
        p_longitude: longitude ? Number(longitude) : null,
        p_message: message,
      }
    );
  },

  /**
   * Concurrency-safe bid acceptance (Requester)
   * Locks task row (FOR UPDATE), deducts wallet, locks escrow, generates OTP
   */
  async acceptBid({ taskId, bidId }) {
    return invokeRpc(
      'accept_bid',
      {
        p_task_id: taskId,
        p_bid_id: bidId,
      },
      {
        p_bid_id: bidId,
        p_task_id: taskId,
      }
    );
  },

  /**
   * Fetch worker's bids across tasks
   */
  async getWorkerBids(workerId) {
    const { data, error } = await supabase
      .from('bids')
      .select(`
        *,
        task:task_id (id, title, category, budget, status, address, requester_id)
      `)
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch worker's current active assigned job (max 1 active job)
   */
  async getWorkerActiveJob(workerId) {
    const { data, error } = await supabase
      .from('tasks_view')
      .select(`
        *,
        requester:requester_id (id, name, rating_average, rating_count),
        escrow:escrow_transactions (id, amount, platform_fee, status)
      `)
      .eq('assigned_worker_id', workerId)
      .eq('status', 'ASSIGNED')
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // =========================================================================
  // 3. OTP Completion, Cancellation & Disputes
  // =========================================================================

  /**
   * Retrieve the 4-digit completion OTP (Requester & Admin only)
   */
  async getTaskOtp(taskId) {
    return invokeRpc('get_task_otp', { p_task_id: taskId });
  },

  /**
   * Complete task via 4-digit OTP submission (Worker)
   * 3 wrong attempts triggers DISPUTED transition
   */
  async completeTask({ taskId, otpCode }) {
    try {
      const data = await invokeRpc('complete_task', {
        p_task_id: taskId,
        p_otp_code: String(otpCode).trim(),
      });
      return { success: true, ...data };
    } catch (err) {
      const msg = err.message || '';
      const isDisputed = msg.includes('DISPUTED') || msg.includes('3 failed attempts');
      const matchAttempts = msg.match(/Attempt (\d+) of (\d+)/i);
      const attemptNum = matchAttempts ? parseInt(matchAttempts[1], 10) : (isDisputed ? 3 : 1);

      return {
        success: false,
        isDisputed,
        attemptCount: attemptNum,
        remainingAttempts: Math.max(0, 3 - attemptNum),
        error: msg,
      };
    }
  },

  /**
   * Cancel task (Requester / Admin)
   * OPEN: zero penalty; ASSIGNED: full escrow refund to requester
   */
  async cancelTask({ taskId, reason = 'Cancelled by user' }) {
    return invokeRpc('cancel_task', {
      p_task_id: taskId,
      p_reason: reason,
    });
  },

  /**
   * Resolve task dispute (Admin only)
   * Decision: 'REFUND_REQUESTER' | 'PAY_WORKER'
   */
  async resolveDispute({ taskId, decision, workerShare = null }) {
    return invokeRpc(
      'resolve_dispute',
      {
        p_task_id: taskId,
        p_decision: decision,
        p_worker_share: workerShare,
      },
      {
        p_task_id: taskId,
        p_resolution: decision,
        p_worker_share: workerShare,
      }
    );
  },

  /**
   * Fetch disputed tasks for admin
   */
  async getDisputedTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        requester:requester_id (id, name),
        worker:assigned_worker_id (id, name),
        escrow:escrow_transactions (id, amount, status)
      `)
      .eq('status', 'DISPUTED')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // =========================================================================
  // 4. Double-Blind Reviews & Maintenance
  // =========================================================================

  /**
   * Submit 1-5 star review (Double-blind: hidden until paired review or 7 days)
   */
  async submitReview({ taskId, rating, comment = '' }) {
    return invokeRpc('submit_review', {
      p_task_id: taskId,
      p_rating: Math.round(Number(rating)),
      p_comment: comment || null,
    });
  },

  /**
   * Trigger maintenance task expiration
   */
  async expireStaleTasks() {
    return invokeRpc('expire_tasks', {});
  },

  // =========================================================================
  // 5. Simulated Wallet & Double-Entry Ledger
  // =========================================================================

  /**
   * Fetch current user's wallet
   */
  async getWallet(userId) {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Fetch double-entry transaction history
   */
  async getLedgerEntries(walletId) {
    const { data, error } = await supabase
      .from('ledger_entries')
      .select(`
        *,
        task:task_id (id, title)
      `)
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Simulated deposit (+₹100, +₹200, +₹500)
   */
  async simulateTopup(amount) {
    return invokeRpc('simulate_topup', {
      p_amount: Number(amount),
    });
  },

  /**
   * Simulated withdrawal
   */
  async simulateWithdraw(amount) {
    return invokeRpc('simulate_withdraw', {
      p_amount: Number(amount),
    });
  },
};

export default api;
