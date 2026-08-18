import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, Message, TypingEvent, AppTheme, Conversation, Invitation } from '../../types';
import { ChatService } from '../../lib/chatService';
import { sounds } from '../../lib/sound';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { ImageLightbox } from './ImageLightbox';
import { SettingsModal } from '../settings/SettingsModal';
import { ConnectionBanner } from './ConnectionBanner';
import { ConfirmationModal } from './ConfirmationModal';
import { Toast } from './Toast';
import { InvitePartnerModal } from './InvitePartnerModal';
import { CallModal } from './CallModal';
import { CallService, CallSignal } from '../../lib/callService';
import { PushService } from '../../lib/pushService';
import { Heart, UserPlus, Sparkles, Copy, Check, Bell } from 'lucide-react';

interface SingleChatPaneProps {
  forcedUser?: UserProfile;
  theme: AppTheme;
  onToggleTheme: () => void;
  onLogout?: () => void;
  isEmbedded?: boolean;
  onPartnerChange?: (partner: UserProfile | null) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const SingleChatPane: React.FC<SingleChatPaneProps> = ({
  forcedUser,
  theme,
  onToggleTheme,
  onLogout,
  isEmbedded = false,
  onPartnerChange,
  isSidebarCollapsed,
  onToggleSidebar,
}) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(forcedUser || null);
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typingState, setTypingState] = useState<TypingEvent | null>(null);
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return PushService.getPermissionState();
  });

  // Message Editing State
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // WebRTC Audio & Video Calling State
  const [callState, setCallState] = useState<'idle' | 'outgoing' | 'incoming' | 'connected'>('idle');
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingOfferRef = useRef<CallSignal | null>(null);
  const pendingIceCandidatesRef = useRef<any[]>([]);
  const isRealtimeOnlineRef = useRef<boolean>(false);
  const lastOnlineTimeRef = useRef<number>(0);

  // Poll & handle incoming WebRTC call signals
  useEffect(() => {
    if (!currentUser) return;

    const cleanup = CallService.pollSignals(currentUser.id, async (sig) => {
      if (sig.type === 'offer' && callState === 'idle') {
        pendingOfferRef.current = sig;
        setCallType(sig.callType || 'audio');
        setCallState('incoming');
        setIsCallModalOpen(true);
      } else if (sig.type === 'answer' && callState === 'outgoing') {
        const pc = peerConnectionRef.current;
        if (pc && sig.payload) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
            setCallState('connected');
            sounds.playReceiveSound();

            // Process any queued ICE candidates
            while (pendingIceCandidatesRef.current.length > 0) {
              const cand = pendingIceCandidatesRef.current.shift();
              if (cand) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch {
                  // ignore
                }
              }
            }

            if (callTimerRef.current) clearInterval(callTimerRef.current);
            callTimerRef.current = setInterval(() => {
              setCallDurationSeconds((prev) => prev + 1);
            }, 1000);
          } catch (err) {
            console.error('Error setting remote description on answer:', err);
          }
        }
      } else if (sig.type === 'candidate') {
        const pc = peerConnectionRef.current;
        if (pc && pc.remoteDescription && sig.payload) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
          } catch (err) {
            console.warn('ICE candidate add error:', err);
          }
        } else if (sig.payload) {
          pendingIceCandidatesRef.current.push(sig.payload);
        }
      } else if (sig.type === 'reject' || sig.type === 'end') {
        CallService.endActiveCall();
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        setCallState('idle');
        setIsCallModalOpen(false);
        setCallDurationSeconds(0);
        setLocalStream(null);
        setRemoteStream(null);
        pendingOfferRef.current = null;
        pendingIceCandidatesRef.current = [];
      }
    });

    return () => cleanup();
  }, [currentUser, callState]);

  // Continuous Call Ringing Audio & Single Persistent OS Notification
  useEffect(() => {
    if (callState === 'incoming' || callState === 'outgoing') {
      sounds.startRingtone();

      if (callState === 'incoming') {
        PushService.showNotification(`📞 Incoming Call`, {
          body: `Incoming ${callType === 'video' ? 'HD Video' : 'Audio'} Call from ${partner?.display_name || 'your partner'}! Tap to answer.`,
          tag: 'incoming-call',
          requireInteraction: true,
        });
      }
    } else {
      sounds.stopRingtone();
    }

    return () => {
      sounds.stopRingtone();
    };
  }, [callState, callType, partner]);

  // Start outgoing audio call
  const handleStartAudioCall = async () => {
    if (!currentUser || !partner) return;
    try {
      setCallType('audio');
      setCallState('outgoing');
      setIsCallModalOpen(true);
      setCallDurationSeconds(0);
      setIsCallMuted(false);
      setIsVideoOff(false);

      const stream = await CallService.getMicrophoneStream();
      setLocalStream(stream);

      const pc = CallService.createPeerConnection(
        (remote) => setRemoteStream(remote),
        (candidate) => {
          CallService.sendSignal({
            senderId: currentUser.id,
            targetUserId: partner.id,
            callType: 'audio',
            type: 'candidate',
            payload: candidate.toJSON(),
          });
        }
      );
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await CallService.sendSignal({
        senderId: currentUser.id,
        targetUserId: partner.id,
        callType: 'audio',
        type: 'offer',
        payload: offer,
      });
    } catch (err) {
      console.error('Failed to initiate audio call:', err);
      alert('Microphone access is required to start a voice call.');
      setCallState('idle');
      setIsCallModalOpen(false);
    }
  };

  // Start outgoing video call
  const handleStartVideoCall = async () => {
    if (!currentUser || !partner) return;
    try {
      setCallType('video');
      setCallState('outgoing');
      setIsCallModalOpen(true);
      setCallDurationSeconds(0);
      setIsCallMuted(false);
      setIsVideoOff(false);

      const stream = await CallService.getVideoStream();
      setLocalStream(stream);

      const pc = CallService.createPeerConnection(
        (remote) => setRemoteStream(remote),
        (candidate) => {
          CallService.sendSignal({
            senderId: currentUser.id,
            targetUserId: partner.id,
            callType: 'video',
            type: 'candidate',
            payload: candidate.toJSON(),
          });
        }
      );
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await CallService.sendSignal({
        senderId: currentUser.id,
        targetUserId: partner.id,
        callType: 'video',
        type: 'offer',
        payload: offer,
      });
    } catch (err) {
      console.error('Failed to initiate video call:', err);
      alert('Camera & microphone access are required to start a video call.');
      setCallState('idle');
      setIsCallModalOpen(false);
    }
  };

  // Accept incoming call (Audio or Video)
  const handleAcceptCall = async () => {
    sounds.stopRingtone();
    if (!currentUser || !pendingOfferRef.current) return;
    try {
      const offerSignal = pendingOfferRef.current;
      const targetUserId = partner?.id || offerSignal.senderId;
      const isVideo = offerSignal.callType === 'video';

      setCallState('connected');

      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => {
        setCallDurationSeconds((prev) => prev + 1);
      }, 1000);

      const stream = isVideo
        ? await CallService.getVideoStream()
        : await CallService.getMicrophoneStream();
      setLocalStream(stream);

      const pc = CallService.createPeerConnection(
        (remote) => setRemoteStream(remote),
        (candidate) => {
          CallService.sendSignal({
            senderId: currentUser.id,
            targetUserId: targetUserId,
            callType: isVideo ? 'video' : 'audio',
            type: 'candidate',
            payload: candidate.toJSON(),
          });
        }
      );
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offerSignal.payload));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await CallService.sendSignal({
        senderId: currentUser.id,
        targetUserId: targetUserId,
        callType: isVideo ? 'video' : 'audio',
        type: 'answer',
        payload: answer,
      });
    } catch (err) {
      console.error('Failed to accept call:', err);
      handleEndCall();
    }
  };

  // Decline incoming call
  const handleDeclineCall = async () => {
    sounds.stopRingtone();
    if (currentUser) {
      const targetUserId = partner?.id || pendingOfferRef.current?.senderId || 'all';
      await CallService.sendSignal({
        senderId: currentUser.id,
        targetUserId: targetUserId,
        type: 'reject',
      });
    }
    handleEndCall();
  };

  // End active call
  const handleEndCall = async () => {
    sounds.stopRingtone();
    if (currentUser) {
      const targetUserId = partner?.id || pendingOfferRef.current?.senderId || 'all';
      await CallService.sendSignal({
        senderId: currentUser.id,
        targetUserId: targetUserId,
        type: 'end',
      });
    }
    CallService.endActiveCall();
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setCallState('idle');
    setIsCallModalOpen(false);
    setCallDurationSeconds(0);
    setLocalStream(null);
    setRemoteStream(null);
    pendingOfferRef.current = null;
  };

  // Toggle microphone mute
  const handleToggleMute = () => {
    const nextMute = !isCallMuted;
    setIsCallMuted(nextMute);
    const stream = CallService.getLocalStream();
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !nextMute;
      });
    }
  };

  // Toggle camera video feed
  const handleToggleVideo = () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);
    const stream = CallService.getLocalStream();
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !nextVideoOff;
      });
    }
  };

  // Confirmation Modals State
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    onConfirm: () => {},
  });

  // Toast / Undo State
  const [toastState, setToastState] = useState<{
    isOpen: boolean;
    message: string;
    undoAction?: () => void;
  }>({
    isOpen: false,
    message: '',
  });

  // Monitor network online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Reload messages helper with state equality check to prevent tick flickering
  const reloadMessages = useCallback(async (convId: string, userId: string) => {
    const { messages: fetched, hasMore: more } = await ChatService.getMessages(convId, userId, 50);
    setMessages((prev) => {
      if (
        prev.length === fetched.length &&
        prev.every(
          (m, i) =>
            m.id === fetched[i]?.id &&
            m.is_read === fetched[i]?.is_read &&
            m.content === fetched[i]?.content &&
            m.status === fetched[i]?.status &&
            m.is_edited === fetched[i]?.is_edited
        )
      ) {
        return prev;
      }
      return fetched;
    });
    setHasMore(more);
  }, []);

  const onPartnerChangeRef = useRef(onPartnerChange);
  useEffect(() => {
    onPartnerChangeRef.current = onPartnerChange;
  }, [onPartnerChange]);

  // Fetch / Refresh Conversation and Partner details with state memoization
  const refreshConversationState = useCallback(async (activeUser: UserProfile) => {
    const details = await ChatService.getConversationDetails(activeUser);
    if (details.conversation) setConversation(details.conversation);
    if (details.invitation) setInvitation(details.invitation);

    if (details.partner) {
      const p = details.partner;
      const onlineStatus = true;

      setPartner((prev) => {
        if (
          prev &&
          prev.id === p.id &&
          prev.display_name === p.display_name &&
          prev.avatar_url === p.avatar_url &&
          Boolean(prev.is_online) === true
        ) {
          return prev;
        }
        return { ...p, is_online: true, last_seen: new Date().toISOString() };
      });

      setIsPartnerOnline(true);
      if (onPartnerChangeRef.current) onPartnerChangeRef.current({ ...p, is_online: true });
    } else {
      setPartner(null);
      setIsPartnerOnline(false);
      if (onPartnerChangeRef.current) onPartnerChangeRef.current(null);
    }
  }, []);

  // Initialize on mount or when user changes
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const activeUser = forcedUser || (await ChatService.getCurrentUser());
      if (!isMounted || !activeUser) return;
      setCurrentUser(activeUser);
      await refreshConversationState(activeUser);
      const convId = typeof window !== 'undefined'
        ? localStorage.getItem('two_chat_active_conversation_id') || 'conv-sandbox-shared'
        : 'conv-sandbox-shared';
      await reloadMessages(convId, activeUser.id);
    }

    init();
    return () => {
      isMounted = false;
    };
  }, [forcedUser, refreshConversationState]);

  // Subscribe to Realtime Supabase changes
  useEffect(() => {
    if (!conversation || !currentUser) return;

    const cleanup = ChatService.subscribeToConversation(
      conversation.id,
      currentUser.id,
      {
        onNewMessage: (newMsg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) {
              return prev.map((m) => (m.id === newMsg.id ? newMsg : m));
            }
            return [...prev, newMsg];
          });

          // If incoming message from partner, play chime and mark as read
          if (newMsg.sender_id !== currentUser.id) {
            sounds.playReceiveSound();
            ChatService.markMessagesAsRead(conversation.id, currentUser.id);

            // Native System Push Notification when tab/window is in background
            if (typeof document !== 'undefined' && document.hidden) {
              PushService.showNotification(`💬 ${partner?.display_name || 'Partner'}`, {
                body: newMsg.content || (newMsg.image_url ? '📷 Sent an image' : '🎤 Sent a voice note'),
                tag: 'new-message',
                requireInteraction: false,
              });
            }
          }
        },
        onMessageUpdated: (updatedMsg) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
          );
        },
        onMessageDeletedForMe: (deletedId) => {
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
        },
        onMessageRestoredForMe: () => {
          reloadMessages(conversation.id, currentUser.id);
        },
        onHistoryCleared: () => {
          setMessages([]);
          setHasMore(false);
        },
        onMessagesRead: () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.sender_id === currentUser.id ? { ...m, is_read: true, status: 'read' } : m
            )
          );
        },
        onTyping: (event) => {
          setTypingState(event);
          if (event.is_typing) {
            setTimeout(() => {
              setTypingState((curr) => (curr?.timestamp === event.timestamp ? null : curr));
            }, 3000);
          }
        },
        onPresence: (state) => {
          isRealtimeOnlineRef.current = state.is_online;
          if (state.is_online) lastOnlineTimeRef.current = Date.now();
          setIsPartnerOnline(state.is_online);
          setPartner((prev) => (prev ? { ...prev, is_online: state.is_online } : null));
          if (onPartnerChange) {
            setPartner((prev) => {
              if (prev) onPartnerChange({ ...prev, is_online: state.is_online });
              return prev;
            });
          }
        },
        onMemberJoined: () => {
          // Refresh partner details when a new member joins the conversation
          refreshConversationState(currentUser);
        },
      }
    );

    return () => {
      cleanup();
    };
  }, [conversation, currentUser, reloadMessages, refreshConversationState]);

  // Periodic 1.2-second presence heartbeat & two-way partner status sync
  useEffect(() => {
    if (!currentUser) return;

    // Send heartbeat immediately on mount with display name and avatar
    ChatService.sendHeartbeat(currentUser.id, currentUser.display_name, currentUser.avatar_url);

    const interval = setInterval(async () => {
      ChatService.sendHeartbeat(currentUser.id, currentUser.display_name, currentUser.avatar_url);
      if (conversation) {
        reloadMessages(conversation.id, currentUser.id);
      }
      refreshConversationState(currentUser);
    }, 1200);

    return () => clearInterval(interval);
  }, [conversation, currentUser, reloadMessages, refreshConversationState]);

  // Load older messages (pagination)
  const handleLoadMore = useCallback(async () => {
    if (!conversation || !currentUser || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldestMessage = messages[0];
      const { messages: olderMessages, hasMore: more } = await ChatService.getMessages(
        conversation.id,
        currentUser.id,
        35,
        oldestMessage.created_at
      );
      setMessages((prev) => [...olderMessages, ...prev]);
      setHasMore(more);
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [conversation, currentUser, loadingMore, hasMore, messages]);

  // Send message handler with instant optimistic rendering
  const handleSendMessage = async (
    content: string,
    imageFile?: File | null,
    audioUrl?: string | null,
    audioDuration?: number | null
  ) => {
    if (!currentUser || !conversation) return;
    const convId = conversation.id;
    const tempId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Instant local compressed image preview if attached
    let previewDataUrl: string | null = null;
    if (imageFile) {
      previewDataUrl = await ChatService.uploadImage(imageFile, currentUser.id);
    }

    // 1. Optimistic instant message in UI
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: convId,
      sender_id: currentUser.id,
      content: content.trim() || (audioUrl ? '🎙️ Voice Message' : ''),
      image_url: previewDataUrl,
      audio_url: audioUrl || null,
      audio_duration: audioDuration || null,
      created_at: new Date().toISOString(),
      is_read: false,
      is_edited: false,
      is_deleted_for_everyone: false,
      status: 'sent',
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    sounds.playSendSound();

    // 2. Background async upload and dispatch to PostgreSQL
    try {
      let finalImageUrl: string | null = null;
      if (imageFile) {
        finalImageUrl = await ChatService.uploadImage(imageFile, currentUser.id);
      }

      const sent = await ChatService.sendMessage(
        convId,
        currentUser.id,
        content,
        finalImageUrl,
        tempId,
        audioUrl,
        audioDuration
      );

      // Reconcile optimistic message with persisted message
      setMessages((prev) => {
        const existingIdx = prev.findIndex((m) => m.id === tempId || m.id === sent.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...sent,
            image_url: finalImageUrl || previewDataUrl,
            audio_url: audioUrl || sent.audio_url,
            audio_duration: audioDuration || sent.audio_duration,
          };
          return updated;
        }
        return [
          ...prev,
          {
            ...sent,
            image_url: finalImageUrl || previewDataUrl,
            audio_url: audioUrl || sent.audio_url,
            audio_duration: audioDuration || sent.audio_duration,
          },
        ];
      });
    } catch (err) {
      console.error('Failed to dispatch message:', err);
    }
  };

  // Edit Message: Trigger edit mode
  const handleStartEdit = (msg: Message) => {
    if (!currentUser || msg.sender_id !== currentUser.id) return;
    setEditingMessage(msg);
  };

  // Edit Message: Submit update
  const handleUpdateMessage = async (messageId: string, newContent: string) => {
    if (!currentUser || !conversation) return;
    const convId = conversation.id;

    // Optimistically update local message state
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, content: newContent.trim(), is_edited: true, updated_at: new Date().toISOString() }
          : m
      )
    );
    setEditingMessage(null);

    try {
      const res = await ChatService.editMessage(messageId, convId, currentUser.id, newContent);
      if (res.error) {
        console.error('Failed to edit message:', res.error);
        setToastState({ isOpen: true, message: `Could not update message: ${res.error}` });
      }
    } catch (err) {
      console.error('Error in edit message:', err);
    }
  };

  // Delete for me
  const handleDeleteForMe = async (msg: Message) => {
    if (!currentUser || !conversation) return;
    const convId = conversation.id;
    const removedMessage = msg;

    // Optimistically remove from state
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));

    // Show undo toast
    setToastState({
      isOpen: true,
      message: 'Message deleted for you',
      undoAction: async () => {
        await ChatService.undoDeleteMessageForMe(removedMessage.id, currentUser.id);
        reloadMessages(convId, currentUser.id);
        setToastState({ isOpen: false, message: '' });
      },
    });

    try {
      await ChatService.deleteMessageForMe(msg.id, convId, currentUser.id);
    } catch (err) {
      console.error('Failed to delete for me:', err);
    }
  };

  // Delete for everyone (Sender only)
  const handleDeleteForEveryone = (msg: Message) => {
    if (!currentUser || !conversation || msg.sender_id !== currentUser.id) return;
    const convId = conversation.id;

    setConfirmModalState({
      isOpen: true,
      title: 'Delete for everyone?',
      description: 'This message will be removed for both you and your partner. A "This message was deleted" placeholder will remain.',
      confirmLabel: 'Delete for Everyone',
      onConfirm: async () => {
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));

        // Optimistically update message state
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? {
                  ...m,
                  content: 'This message was deleted',
                  image_url: null,
                  is_deleted_for_everyone: true,
                  deleted_for_everyone_at: new Date().toISOString(),
                }
              : m
          )
        );

        try {
          const res = await ChatService.deleteMessageForEveryone(msg.id, convId, currentUser.id);
          if (res.error) {
            setToastState({ isOpen: true, message: `Failed to delete: ${res.error}` });
          }
        } catch (err) {
          console.error('Error deleting for everyone:', err);
        }
      },
    });
  };

  // Clear history for me
  const handleClearHistoryForMe = () => {
    if (!currentUser || !conversation) return;
    const convId = conversation.id;

    setConfirmModalState({
      isOpen: true,
      title: 'Clear history for me?',
      description: 'This will remove all existing messages from your screen only. Your partner will still keep their chat history.',
      confirmLabel: 'Clear for Me',
      onConfirm: async () => {
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        setMessages([]);
        setHasMore(false);

        try {
          await ChatService.clearChatHistoryForMe(convId, currentUser.id);
          setToastState({ isOpen: true, message: 'Chat history cleared for you' });
        } catch (err) {
          console.error('Failed to clear history for me:', err);
        }
      },
    });
  };

  // Clear history for everyone
  const handleClearHistoryForEveryone = () => {
    if (!currentUser || !conversation) return;
    const convId = conversation.id;

    setConfirmModalState({
      isOpen: true,
      title: 'Clear history for everyone?',
      description: 'This will permanently erase the conversation history for both you and your partner.',
      confirmLabel: 'Clear for Everyone',
      onConfirm: async () => {
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        setMessages([]);
        setHasMore(false);

        try {
          await ChatService.clearChatHistoryForEveryone(convId, currentUser.id);
          setToastState({ isOpen: true, message: 'Chat history cleared for everyone' });
        } catch (err) {
          console.error('Failed to clear history for everyone:', err);
        }
      },
    });
  };

  // Typing indicator trigger
  const handleTyping = (isTyping: boolean) => {
    if (!currentUser || !conversation) return;
    ChatService.broadcastTyping(currentUser.id, currentUser.display_name, isTyping, conversation.id);
  };

  // Copy quick invite link from banner
  const handleQuickCopyInvite = async () => {
    if (!invitation) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/?invite=${invitation.code}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = inviteUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className={`flex flex-col h-full w-full bg-gray-50 dark:bg-[#0A0A0B] text-gray-900 dark:text-[#E4E4E6] overflow-hidden relative transition-colors duration-200 ${isEmbedded ? 'rounded-2xl border border-gray-200 dark:border-[#262629]' : ''}`}>
      {/* Offline Status Warning */}
      <ConnectionBanner isOnline={isOnline} />

      {/* Enable Push Notifications Banner */}
      {notificationPermission === 'default' && (
        <div className="bg-rose-500/10 dark:bg-rose-500/15 border-b border-rose-500/20 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs select-none z-30">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <Bell className="w-4 h-4 text-rose-500 shrink-0 animate-bounce" />
            <span className="font-medium">
              Enable notifications to get call & message alerts when Chrome is closed
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              const res = await PushService.requestPermission();
              setNotificationPermission(res);
              if (res === 'granted') {
                PushService.showNotification('🎉 Notifications Enabled!', {
                  body: 'You will now receive incoming call and message alerts!',
                });
              }
            }}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-500 hover:bg-rose-600 active:scale-95 text-white shadow-xs shrink-0 transition"
          >
            Enable Notifications 🔔
          </button>
        </div>
      )}

      {/* Header */}
      <ChatHeader
        currentUser={currentUser}
        partner={partner}
        isPartnerOnline={isPartnerOnline}
        typingState={typingState}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
        onStartAudioCall={handleStartAudioCall}
        onStartVideoCall={handleStartVideoCall}
        onLogout={onLogout || (() => {})}
        isOnline={isOnline}
        onClearHistoryForMe={handleClearHistoryForMe}
        onClearHistoryForEveryone={handleClearHistoryForEveryone}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={onToggleSidebar}
      />

      {/* Waiting for Partner Banner if user is alone in channel */}
      {!partner && (
        <div className="bg-rose-500/10 dark:bg-rose-500/15 border-b border-rose-500/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0" />
            <span className="font-medium">
              Waiting for your partner to join this private channel
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickCopyInvite}
              className={`min-h-[32px] px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-500 hover:bg-rose-600 active:scale-95 text-white shadow-xs'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Invite Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Invite Link</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="min-h-[32px] px-3 rounded-lg text-xs font-medium bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629] text-gray-700 dark:text-white hover:bg-gray-100 transition"
            >
              View Invite
            </button>
          </div>
        </div>
      )}

      {/* Message List */}
      <MessageList
        messages={messages}
        currentUser={currentUser}
        partner={partner}
        typingState={typingState}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={handleLoadMore}
        onImageClick={(url) => setLightboxImageUrl(url)}
        onEditMessage={handleStartEdit}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
      />

      {/* Message Composer */}
      <MessageComposer
        onSendMessage={handleSendMessage}
        onUpdateMessage={handleUpdateMessage}
        onCancelEdit={() => setEditingMessage(null)}
        editingMessage={editingMessage}
        onTyping={handleTyping}
      />

      {/* Image Lightbox */}
      <ImageLightbox
        imageUrl={lightboxImageUrl}
        onClose={() => setLightboxImageUrl(null)}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        description={confirmModalState.description}
        confirmLabel={confirmModalState.confirmLabel}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Toast Notification with Undo */}
      {toastState.isOpen && (
        <Toast
          message={toastState.message}
          undoAction={toastState.undoAction}
          onClose={() => setToastState({ isOpen: false, message: '' })}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        onUpdateUser={(updated) => setCurrentUser(updated)}
        theme={theme}
        onSetTheme={(newTheme) => {
          if (newTheme !== theme) onToggleTheme();
        }}
        onLogout={onLogout || (() => {})}
        onClearHistoryForMe={handleClearHistoryForMe}
        onClearHistoryForEveryone={handleClearHistoryForEveryone}
      />

      {/* Invite Partner Modal */}
      <InvitePartnerModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        invitation={invitation}
        conversationId={conversation?.id || ''}
        currentUserId={currentUser?.id}
        onInvitationUpdated={(newInv) => setInvitation(newInv)}
      />

      {/* WebRTC Audio & Video Call Modal */}
      <CallModal
        isOpen={isCallModalOpen}
        callState={callState}
        callType={callType}
        partner={partner}
        currentUser={currentUser}
        callDurationSeconds={callDurationSeconds}
        isMuted={isCallMuted}
        isVideoOff={isVideoOff}
        localStream={localStream}
        remoteStream={remoteStream}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onAcceptCall={handleAcceptCall}
        onDeclineCall={handleDeclineCall}
        onEndCall={handleEndCall}
      />
    </div>
  );
};
