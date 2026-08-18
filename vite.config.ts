import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function sandboxSyncPlugin() {
  const sandboxStore: {
    invitations: Record<string, any>;
    messages: Record<string, any[]>;
    partners: Record<string, any>;
    users: Record<string, any>;
    callSignals: any[];
    activeConvId: string;
  } = {
    invitations: {},
    messages: { 'conv-sandbox-shared': [] },
    partners: {},
    users: {},
    callSignals: [],
    activeConvId: 'conv-sandbox-shared',
  };

  return {
    name: 'sandbox-sync-middleware',
    configureServer(server: any) {
      server.middlewares.use('/api/sandbox-sync', (req: any, res: any) => {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          try {
            const data = body ? JSON.parse(body) : {};
            const action = data.action;
            const convId = data.conversationId || sandboxStore.activeConvId || 'conv-sandbox-shared';

            if (action === 'register_user' && data.user) {
              const now = Date.now();
              const iso = new Date().toISOString();
              sandboxStore.users[data.user.id] = {
                ...data.user,
                last_heartbeat: now,
                last_seen: iso,
              };

              const allUsers = Object.values(sandboxStore.users);
              const otherUser = allUsers.find((u: any) => u && u.id !== data.user.id);
              let partnerObj = null;

              if (otherUser) {
                const isOnline = otherUser.last_heartbeat ? (now - otherUser.last_heartbeat < 6000) : true;
                partnerObj = {
                  ...otherUser,
                  is_online: isOnline,
                  last_seen: isOnline ? iso : (otherUser.last_seen || iso),
                };
              }

              res.end(JSON.stringify({ success: true, partner: partnerObj, convId: sandboxStore.activeConvId }));
              return;
            }

            if (action === 'send_message' && data.message) {
              if (!sandboxStore.messages[convId]) sandboxStore.messages[convId] = [];
              if (!sandboxStore.messages['conv-sandbox-shared']) sandboxStore.messages['conv-sandbox-shared'] = [];

              if (!sandboxStore.messages[convId].some((m) => m.id === data.message.id)) {
                sandboxStore.messages[convId].push(data.message);
              }
              if (convId !== 'conv-sandbox-shared' && !sandboxStore.messages['conv-sandbox-shared'].some((m) => m.id === data.message.id)) {
                sandboxStore.messages['conv-sandbox-shared'].push(data.message);
              }

              res.end(JSON.stringify({ success: true, messages: sandboxStore.messages[convId] }));
              return;
            }

            if (action === 'get_messages') {
              const specific = sandboxStore.messages[convId] || [];
              const shared = sandboxStore.messages['conv-sandbox-shared'] || [];
              const map = new Map();
              specific.forEach((m) => map.set(m.id, m));
              shared.forEach((m) => map.set(m.id, m));
              const merged = Array.from(map.values()).sort(
                (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              res.end(JSON.stringify({ messages: merged }));
              return;
            }

            if (action === 'save_invite' && data.invitation) {
              sandboxStore.invitations[data.invitation.code] = data.invitation;
              if (data.invitation.conversation_id) {
                sandboxStore.activeConvId = data.invitation.conversation_id;
              }
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (action === 'get_invite' && data.code) {
              const inv = sandboxStore.invitations[data.code];
              res.end(JSON.stringify({ invitation: inv || null }));
              return;
            }

            if (action === 'set_partner' && data.partner) {
              sandboxStore.partners[convId] = data.partner;
              if (data.userId) {
                sandboxStore.partners[data.userId] = data.partner;
              }
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (action === 'heartbeat' && data.userId) {
              const now = Date.now();
              const iso = new Date().toISOString();
              if (sandboxStore.users[data.userId]) {
                sandboxStore.users[data.userId].last_heartbeat = now;
                sandboxStore.users[data.userId].last_seen = iso;
                if (data.displayName && sandboxStore.users[data.userId].display_name === 'User') {
                  sandboxStore.users[data.userId].display_name = data.displayName;
                }
              } else {
                sandboxStore.users[data.userId] = {
                  id: data.userId,
                  display_name: data.displayName || (data.userId.includes('bee') ? 'Bee' : 'Partner'),
                  avatar_url: data.avatarUrl || null,
                  last_heartbeat: now,
                  last_seen: iso,
                  created_at: iso,
                };
              }
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (action === 'get_partner') {
              const currentUserId = data.currentUserId || data.userId;
              const currentName = (data.displayName || data.currentUserName || '').toLowerCase();
              const now = Date.now();
              const iso = new Date().toISOString();

              const isBeeUser = currentName.includes('bee') || (!currentName.includes('hon') && currentUserId.includes('bee'));
              const partnerName = isBeeUser ? 'Honey' : 'Bee';
              const partnerId = isBeeUser ? 'user-honey-simulated' : 'user-bee-simulated';

              const updatedPartner = {
                id: partnerId,
                display_name: partnerName,
                avatar_url: null,
                is_online: true,
                last_seen: iso,
                created_at: iso,
              };
              sandboxStore.users[partnerId] = updatedPartner;

              res.end(JSON.stringify({ partner: updatedPartner, convId: sandboxStore.activeConvId }));
              return;
            }

            if (action === 'send_call_signal' && data.signal) {
              sandboxStore.callSignals.push({
                ...data.signal,
                timestamp: Date.now(),
              });
              // Keep only last 50 signals
              if (sandboxStore.callSignals.length > 50) {
                sandboxStore.callSignals = sandboxStore.callSignals.slice(-50);
              }
              res.end(JSON.stringify({ success: true }));
              return;
            }

            if (action === 'get_call_signals' && data.userId) {
              const currentUserId = data.userId;
              const pending = sandboxStore.callSignals.filter(
                (s) => s.senderId !== currentUserId && !s.consumedBy?.includes(currentUserId)
              );
              pending.forEach((s) => {
                if (!s.consumedBy) s.consumedBy = [];
                s.consumedBy.push(currentUserId);
              });
              res.end(JSON.stringify({ signals: pending }));
              return;
            }

            res.end(JSON.stringify({ status: 'ok' }));
          } catch {
            res.end(JSON.stringify({ status: 'error' }));
          }
        });
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), sandboxSyncPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
