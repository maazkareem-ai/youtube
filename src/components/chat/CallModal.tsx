import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Sparkles, Heart } from 'lucide-react';
import { UserProfile } from '../../types';
import { sounds } from '../../lib/sound';

interface CallModalProps {
  isOpen: boolean;
  callState: 'outgoing' | 'incoming' | 'connected';
  callType: 'audio' | 'video';
  partner: UserProfile | null;
  currentUser: UserProfile;
  callDurationSeconds: number;
  isMuted: boolean;
  isVideoOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onAcceptCall: () => void;
  onDeclineCall: () => void;
  onEndCall: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  callState,
  callType,
  partner,
  callDurationSeconds,
  isMuted,
  isVideoOff,
  localStream,
  remoteStream,
  onToggleMute,
  onToggleVideo,
  onAcceptCall,
  onDeclineCall,
  onEndCall,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Stop ringtone audio as soon as call becomes connected or modal unmounts
  useEffect(() => {
    if (callState === 'connected') {
      sounds.stopRingtone();
    }
    return () => {
      sounds.stopRingtone();
    };
  }, [callState]);

  // Attach local media stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  // Attach remote media stream to remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  if (!isOpen) return null;

  const partnerName = partner?.display_name || 'Partner';
  const partnerAvatar = partner?.avatar_url;

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const isVideoCall = callType === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xl animate-fade-in select-none">
      <div
        className={`w-full ${
          isVideoCall && callState === 'connected'
            ? 'max-w-4xl h-[85vh] sm:h-[80vh]'
            : 'max-w-sm min-h-[420px]'
        } bg-[#121214] border border-[#262629] rounded-3xl p-4 sm:p-6 flex flex-col items-center justify-between shadow-2xl text-white relative overflow-hidden transition-all duration-300`}
      >
        {/* Ambient Pulsing Background Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Status Bar Overlay */}
        <div className="w-full flex items-center justify-between z-20 px-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-widest bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>
              {callState === 'outgoing' && `Calling (${isVideoCall ? 'Video' : 'Voice'})...`}
              {callState === 'incoming' && `Incoming ${isVideoCall ? 'Video' : 'Voice'} Call`}
              {callState === 'connected' && `Live ${isVideoCall ? 'HD Video' : 'Audio'} Call`}
            </span>
          </div>

          <div className="text-xs font-mono text-emerald-400 font-bold bg-black/40 px-3 py-1 rounded-full border border-emerald-500/30">
            {callState === 'connected' ? formatDuration(callDurationSeconds) : 'End-to-End Encrypted'}
          </div>
        </div>

        {/* Video Stream Container (for Video Calls in Connected State) */}
        {isVideoCall && callState === 'connected' ? (
          <div className="relative w-full flex-1 my-3 rounded-2xl overflow-hidden bg-black/60 border border-[#262629] flex items-center justify-center">
            {/* Remote Partner Video Stream */}
            <video
              ref={(el) => {
                remoteVideoRef.current = el;
                if (el && remoteStream && el.srcObject !== remoteStream) {
                  el.srcObject = remoteStream;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Local Video Stream Picture-in-Picture (PiP) */}
            <div className="absolute bottom-4 right-4 w-28 h-40 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border-2 border-rose-500/50 shadow-2xl bg-[#1C1C1E] z-30">
              <video
                ref={(el) => {
                  localVideoRef.current = el;
                  if (el && localStream && el.srcObject !== localStream) {
                    el.srcObject = localStream;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : 'block'}`}
              />
              {isVideoOff && (
                <div className="w-full h-full flex items-center justify-center bg-[#1C1C1E] text-gray-400 text-xs font-medium">
                  Camera Off
                </div>
              )}
            </div>

            {/* Remote Video Fallback if Remote Video Track is missing/disabled */}
            {!remoteStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#18181B] text-center p-4">
                <div className="w-24 h-24 rounded-full border-4 border-rose-500/40 bg-[#27272A] overflow-hidden mb-3 flex items-center justify-center shadow-xl">
                  {partnerAvatar ? (
                    <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-rose-400">
                      {partnerName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-200">{partnerName}</p>
                <p className="text-xs text-gray-400">Connecting video feed...</p>
              </div>
            )}
          </div>
        ) : (
          /* Standard Avatar Center (for Outgoing, Incoming, or Audio-only connected state) */
          <div className="flex flex-col items-center gap-4 my-6 z-10">
            <div className="relative">
              <div
                className={`absolute inset-0 rounded-full bg-rose-500/30 ${
                  callState === 'connected' ? 'animate-pulse' : 'animate-ping'
                }`}
              />

              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-rose-500/40 bg-[#1C1C1E] overflow-hidden flex items-center justify-center shadow-2xl">
                {partnerAvatar ? (
                  <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-rose-400">
                    {partnerName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center justify-center gap-2">
                <span>{partnerName}</span>
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0" />
              </h3>
              <p className="text-xs text-gray-400 mt-1 font-medium">
                {callState === 'outgoing' && 'Waiting for partner to answer...'}
                {callState === 'incoming' && `${partnerName} is requesting a ${isVideoCall ? 'video' : 'voice'} call...`}
                {callState === 'connected' && 'Audio Connected (HD Quality)'}
              </p>
            </div>
          </div>
        )}

        {/* Audio Element for Audio-only streams */}
        {!isVideoCall && (
          <audio
            ref={(el) => {
              if (el && remoteStream) el.srcObject = remoteStream;
            }}
            autoPlay
            playsInline
          />
        )}

        {/* Bottom Call Action Controls */}
        <div className="w-full flex items-center justify-center gap-4 sm:gap-6 z-20 pt-2">
          {callState === 'incoming' ? (
            /* Incoming Call Controls: Decline (Red) & Accept (Green) */
            <>
              <button
                type="button"
                onClick={onDeclineCall}
                className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-900/40 transition"
                title="Decline Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={onAcceptCall}
                className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-900/40 transition animate-bounce"
                title="Accept Call"
              >
                {isVideoCall ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
              </button>
            </>
          ) : (
            /* Connected / Outgoing Call Controls: Mute, Camera Toggle, End Call */
            <>
              {/* Mic Mute Toggle */}
              <button
                type="button"
                onClick={onToggleMute}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition shadow-md ${
                  isMuted
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-[#2C2C2E] hover:bg-[#3A3A3C] text-gray-200'
                }`}
                title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>

              {/* Camera Video Toggle (if Video Call) */}
              {isVideoCall && (
                <button
                  type="button"
                  onClick={onToggleVideo}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition shadow-md ${
                    isVideoOff
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-[#2C2C2E] hover:bg-[#3A3A3C] text-gray-200'
                  }`}
                  title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>
              )}

              {/* End Call Button */}
              <button
                type="button"
                onClick={onEndCall}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-rose-900/50 transition"
                title="End Call"
              >
                <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
