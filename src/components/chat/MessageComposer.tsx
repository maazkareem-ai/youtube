import React, { useState, useRef, useEffect } from 'react';
import { Smile, Paperclip, Send, X, Check, Pencil, Heart, Mic, Trash2 } from 'lucide-react';
import { compressImage } from '../../lib/utils';
import { Message } from '../../types';

interface MessageComposerProps {
  onSendMessage: (content: string, imageFile?: File | null, audioUrl?: string | null, audioDuration?: number | null) => Promise<void>;
  onUpdateMessage?: (messageId: string, content: string) => Promise<void>;
  onCancelEdit?: () => void;
  editingMessage?: Message | null;
  onTyping: (isTyping: boolean) => void;
  disabled?: boolean;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Love & Hearts',
    emojis: ['❤️', '💖', '💕', '💗', '💓', '💞', '💘', '💝', '💌', '🥰', '😍', '😘', '😻', '✨', '🌹', '💐', '💍'],
  },
  {
    name: 'Smiles & Faces',
    emojis: ['😊', '🥺', '😌', '🤗', '😋', '😇', '😴', '🥳', '😎', '🤩', '😉', '🤭', '🤫', '🤤', '🫠', '🤍', '🫶'],
  },
  {
    name: 'Gestures & Food',
    emojis: ['👋', '🙌', '🤝', '☕', '🥐', '🍝', '🍕', '🍰', '🍓', '🥂', '🍿', '🎬', '✈️', '🏖️', '🌙', '⭐', '🌈'],
  },
];

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  onUpdateMessage,
  onCancelEdit,
  editingMessage,
  onTyping,
  disabled = false,
}) => {
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Voice Note Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingSecondsRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const duration = recordingSecondsRef.current || 1;
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size > 0) {
          const reader = new FileReader();
          reader.onload = async () => {
            const base64Audio = reader.result as string;
            await onSendMessage('', null, base64Audio, duration);
          };
          reader.readAsDataURL(audioBlob);
        }
        setIsRecording(false);
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;
      };

      recorder.start(100);
      setIsRecording(true);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone permission is required to record voice notes.');
    }
  };

  const stopAndSendRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;
    audioChunksRef.current = [];
  };

  // Sync editing message text into input when edit mode starts
  useEffect(() => {
    if (editingMessage) {
      setContent(editingMessage.content);
      setSelectedImage(null);
      setImagePreviewUrl(null);
      if (textareaRef.current) {
        textareaRef.current.focus();
        setTimeout(adjustHeight, 10);
      }
    } else {
      setContent('');
      setTimeout(adjustHeight, 10);
    }
  }, [editingMessage]);

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Adjust textarea height dynamically
  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    adjustHeight();

    if (!editingMessage) {
      // Trigger typing event (debounced)
      onTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 1800);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && editingMessage && onCancelEdit) {
      e.preventDefault();
      onCancelEdit();
      return;
    }

    // Send/Update on Enter (without Shift) on desktop & mobile keyboards
    if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Compress image client side
    try {
      const compressed = await compressImage(file);
      setSelectedImage(compressed);
      const url = URL.createObjectURL(compressed);
      setImagePreviewUrl(url);
    } catch {
      setSelectedImage(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleClearImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    setTimeout(adjustHeight, 10);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();

    // If in edit mode:
    if (editingMessage) {
      if (!trimmed) return;
      const msgId = editingMessage.id;
      setContent('');
      if (onCancelEdit) onCancelEdit();
      if (onUpdateMessage) {
        await onUpdateMessage(msgId, trimmed);
      }
      return;
    }

    // Normal Send Mode:
    const imageToSend = selectedImage;
    if (!trimmed && !imageToSend) return;

    // Clear inputs immediately
    setContent('');
    handleClearImage();
    setShowEmojiPicker(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping(false);

    try {
      await onSendMessage(trimmed, imageToSend);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <footer className="relative shrink-0 p-2.5 sm:p-4 md:p-5 bg-white dark:bg-[#121214] border-t border-gray-200 dark:border-[#262629] pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-20 select-none transition-colors duration-200">
      {/* Edit Mode Banner */}
      {editingMessage && (
        <div className="max-w-4xl mx-auto mb-2 flex items-center justify-between px-3.5 py-2 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl text-blue-900 dark:text-blue-200 animate-slide-down">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Pencil className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 text-xs">
              <div className="font-semibold text-blue-700 dark:text-blue-300">Editing message</div>
              <div className="text-[11px] text-blue-600/80 dark:text-blue-400/80 truncate max-w-xs sm:max-w-md">
                {editingMessage.content}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 px-2 py-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      )}

      {/* Image Preview Banner */}
      {imagePreviewUrl && !editingMessage && (
        <div className="max-w-4xl mx-auto mb-2.5 flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-[#1C1C1E] rounded-2xl border border-gray-200 dark:border-[#2C2C2E] text-gray-900 dark:text-[#F2F2F2]">
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/10 dark:bg-black border border-gray-200 dark:border-[#2C2C2E]">
            <img src={imagePreviewUrl} alt="Upload preview" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-900 dark:text-[#F2F2F2] truncate">
              {selectedImage?.name || 'Attached photo'}
            </div>
            <div className="text-[10px] text-gray-400 dark:text-[#8E8E93]">
              {selectedImage ? `${(selectedImage.size / 1024).toFixed(0)} KB ready to send` : 'Image selected'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearImage}
            className="min-w-[40px] min-h-[40px] rounded-full text-gray-500 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2C2C2E] flex items-center justify-center transition"
            aria-label="Remove image"
            title="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-full mb-2.5 left-2 sm:left-6 md:left-8 z-50 w-72 sm:w-80 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#262629] rounded-2xl shadow-2xl p-3 max-h-72 overflow-y-auto text-gray-900 dark:text-[#F2F2F2]"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-[#262629]">
            <span className="text-xs font-semibold text-gray-900 dark:text-[#F2F2F2] flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              Emojis & Reactions
            </span>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(false)}
              className="text-gray-400 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-white text-xs p-1"
              aria-label="Close emoji picker"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.name}>
                <div className="text-[10px] font-medium text-gray-400 dark:text-[#8E8E93] uppercase tracking-wider mb-1">
                  {cat.name}
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-7 gap-1">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleAddEmoji(emoji)}
                      className="w-9 h-9 flex items-center justify-center text-lg rounded-xl hover:bg-gray-100 dark:hover:bg-[#2C2C2E] active:scale-110 transition"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden File Input for Attachment */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        onChange={handleImageSelect}
        className="hidden"
      />

      {/* Composer Input Bar */}
      {isRecording ? (
        <div className="max-w-4xl mx-auto flex items-center justify-between p-2 rounded-[26px] bg-rose-50 dark:bg-[#1C1C1E] border border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 shadow-md">
          <div className="flex items-center gap-3 px-3">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping shrink-0" />
            <span className="text-sm font-mono font-bold tracking-wider">
              {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
            </span>
            <div className="flex items-center gap-1 h-4">
              {[60, 100, 40, 80, 50, 90, 30, 70].map((h, i) => (
                <div key={i} className="w-1 bg-rose-500 dark:bg-rose-400 rounded-full animate-pulse" style={{ height: `${h}%` }} />
              ))}
            </div>
            <span className="text-xs text-rose-600/80 dark:text-rose-400/80 hidden sm:inline font-medium">Recording voice note...</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="w-10 h-10 rounded-full bg-gray-200 dark:bg-[#2C2C2E] hover:bg-rose-100 dark:hover:bg-rose-900/40 text-gray-600 dark:text-gray-300 hover:text-rose-600 flex items-center justify-center transition"
              title="Cancel recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={stopAndSendRecording}
              className="px-4 py-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-900/20 active:scale-95 transition"
              title="Send voice note"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Note</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className={`flex items-center gap-1.5 sm:gap-2.5 p-1 sm:p-1.5 rounded-[26px] border transition shadow-inner ${
            editingMessage
              ? 'bg-blue-50/40 dark:bg-[#151C2C] border-blue-300 dark:border-blue-700/60 focus-within:border-blue-500'
              : 'bg-gray-100 dark:bg-[#1C1C1E] border-gray-200 dark:border-[#2C2C2E] focus-within:border-gray-300 dark:focus-within:border-[#48484A]'
          }`}>
            {/* Emoji Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`min-w-[40px] min-h-[40px] sm:min-w-[38px] sm:min-h-[38px] rounded-full flex items-center justify-center shrink-0 transition ${
                showEmojiPicker
                  ? 'bg-rose-500/20 text-rose-500 dark:text-rose-400'
                  : 'text-gray-500 dark:text-[#8E8E93] hover:text-rose-500 dark:hover:text-rose-400 hover:bg-gray-200 dark:hover:bg-[#2C2C2E]'
              }`}
              aria-label="Choose emoji"
              title="Insert emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Text Input Area */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={content}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={editingMessage ? 'Update your message...' : 'Type a message... (Press Enter to send)'}
              disabled={disabled}
              className="flex-1 bg-transparent border-none outline-none text-base sm:text-sm text-gray-900 dark:text-[#F2F2F2] px-2 placeholder:text-gray-400 dark:placeholder:text-[#48484A] resize-none max-h-32 leading-relaxed focus:ring-0 focus:outline-none"
            />

            {/* Attachment Button (disabled during edit) */}
            {!editingMessage && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-w-[40px] min-h-[40px] sm:min-w-[38px] sm:min-h-[38px] rounded-full flex items-center justify-center shrink-0 text-gray-500 dark:text-[#8E8E93] hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2C2C2E] transition"
                aria-label="Attach photo"
                title="Attach image"
              >
                <Paperclip className="w-5 h-5" />
              </button>
            )}

            {/* Microphone Voice Note Button (when input is empty) */}
            {!editingMessage && !content.trim() && !selectedImage ? (
              <button
                type="button"
                onClick={startRecording}
                disabled={disabled}
                className="min-w-[40px] min-h-[40px] sm:min-w-[38px] sm:min-h-[38px] rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-900/20 active:scale-95 transition"
                aria-label="Record voice note"
                title="Record voice note"
              >
                <Mic className="w-5 h-5" />
              </button>
            ) : editingMessage ? (
              <button
                type="submit"
                disabled={!content.trim() || disabled}
                className="min-w-[40px] min-h-[40px] sm:min-w-[38px] sm:min-h-[38px] rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-900/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Update message"
                title="Update message (Enter)"
              >
                <Check className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={(!content.trim() && !selectedImage) || disabled}
                className="min-w-[40px] min-h-[40px] sm:min-w-[38px] sm:min-h-[38px] rounded-full bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-900/20 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                aria-label="Send message"
                title="Send (Enter)"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            )}
          </div>
        </form>
      )}
    </footer>
  );
};
