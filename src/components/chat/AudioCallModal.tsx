import React from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Sparkles, Heart } from 'lucide-react';
import { UserProfile } from '../../types';

interface AudioCallModalProps {
  isOpen: boolean;
  callState: 'outgoing' | 'incoming' | 'connected';
  partner: UserProfile | null;
  currentUser: UserProfile;
  callDurationSeconds: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onAcceptCall: () => void;
  onDeclineCall: () => void;
  onEndCall: () => void;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
}

export const AudioCallModal: React.FC<AudioCallModalProps> = ({
  isOpen,
  callState,
  partner,
  callDurationSeconds,
  isMuted,
  onToggleMute,
  onAcceptCall,
  onDeclineCall,
  onEndCall,
  remoteAudioRef,
}) => {
  if (!isOpen) return null;

  const partnerName = partner?.display_name || 'Partner';
  const partnerAvatar = partner?.avatar_url;

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in select-none">
      {/* Invisible HTML5 Audio Tag to play partner's WebRTC audio stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="w-full max-w-sm bg-[#121214] border border-[#262629] rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-between min-h-[420px] shadow-2xl text-white relative overflow-hidden">
        {/* Ambient Pulsing Background Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Status Header */}
        <div className="flex flex-col items-center gap-1.5 z-10">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>
              {callState === 'outgoing' && 'Calling...'}
              {callState === 'incoming' && 'Incoming Call'}
              {callState === 'connected' && 'Live Audio Call'}
            </span>
          </div>

          <div className="text-xs text-gray-400 font-medium">
            {callState === 'connected' ? (
              <span className="font-mono text-emerald-400 font-bold text-sm tracking-wider">
                {formatDuration(callDurationSeconds)}
              </span>
            ) : (
              'End-to-end encrypted voice thread'
            )}
          </div>
        </div>

        {/* Center Partner Avatar & Pulsing Animation */}
        <div className="flex flex-col items-center gap-4 my-6 z-10">
          <div className="relative">
            {/* Animated Pulsing Ring */}
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
              {callState === 'incoming' && `${partnerName} is requesting a voice call...`}
              {callState === 'connected' && 'Audio Connected (HD Quality)'}
            </p>
          </div>

          {/* Animated Equalizer Waveform when connected */}
          {callState === 'connected' && (
            <div className="flex items-center gap-1.5 h-6 mt-2">
              {[40, 80, 50, 100, 60, 90, 30, 70, 50, 85].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-emerald-400 rounded-full animate-bounce"
                  style={{
                    height: `${h}%`,
                    animationDelay: `-${(i * 0.15).toFixed(2)}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom Call Controls */}
        <div className="w-full flex items-center justify-center gap-6 z-10 pt-2">
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
                <Phone className="w-7 h-7" />
              </button>
            </>
          ) : (
            /* Connected / Outgoing Call Controls: Mute Toggle & End Call */
            <>
              <button
                type="button"
                onClick={onToggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition shadow-md ${
                  isMuted
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-[#2C2C2E] hover:bg-[#3A3A3C] text-gray-200'
                }`}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>

              <button
                type="button"
                onClick={onEndCall}
                className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-rose-900/50 transition"
                title="End Call"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
