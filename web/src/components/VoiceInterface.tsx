"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { voiceConverse, textConverse } from "@/lib/api";

interface VoiceInterfaceProps {
  tripId: string;
  token?: string;
}

type Status = "idle" | "recording" | "processing" | "playing";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function VoiceInterface({ tripId, token }: VoiceInterfaceProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start recording audio
  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });

        if (audioBlob.size < 100) {
          setStatus("idle");
          return;
        }

        setStatus("processing");
        setMessages((prev) => [
          ...prev,
          { role: "user", content: "[Voice message]", timestamp: new Date() },
        ]);

        try {
          const responseBlob = await voiceConverse(tripId, audioBlob, token);
          await playAudioResponse(responseBlob);
        } catch (err: any) {
          console.error("Voice converse error:", err);
          setError(err.message || "Failed to process voice");
          setStatus("idle");
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // collect data every 100ms
      setStatus("recording");
    } catch (err: any) {
      console.error("Mic access error:", err);
      setError("Microphone access denied. Please allow mic access.");
    }
  }, [tripId, token]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Play WAV response using AudioContext
  const playAudioResponse = useCallback(async (blob: Blob) => {
    try {
      setStatus("playing");

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer =
        await audioContextRef.current.decodeAudioData(arrayBuffer);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      source.onended = () => {
        setStatus("idle");
      };

      source.start(0);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "[Voice response]",
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      console.error("Audio playback error:", err);
      setError("Failed to play audio response");
      setStatus("idle");
    }
  }, []);

  // Handle text input submit
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    const msg = textInput.trim();
    setTextInput("");
    setError(null);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: msg, timestamp: new Date() },
    ]);

    setStatus("processing");

    try {
      const response = await textConverse(tripId, msg, token);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.reply,
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      console.error("Text converse error:", err);
      setError(err.message || "Failed to get response");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="glass-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status === "idle"
                ? "bg-[var(--accent-green)]"
                : status === "recording"
                ? "bg-[var(--accent-red)] animate-pulse"
                : "bg-[var(--accent-amber)] animate-pulse"
            }`}
          />
          <span className="text-sm font-medium">
            {status === "idle"
              ? "Co-Pilot Ready"
              : status === "recording"
              ? "Listening..."
              : status === "processing"
              ? "Thinking..."
              : "Speaking..."}
          </span>
        </div>
        <button
          onClick={() => setShowText(!showText)}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {showText ? "Voice mode" : "Text mode"}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 rounded-full bg-[var(--accent-blue)]/10 flex items-center justify-center mb-4">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-blue)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Tap the mic to talk to your co-pilot
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Ask about stops, budget, directions, or anything
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-[var(--accent-blue)] text-white rounded-br-md"
                    : "bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-bl-md"
                }`}
              >
                {msg.content}
                <div
                  className={`text-xs mt-1 ${
                    msg.role === "user"
                      ? "text-white/50"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-[var(--accent-red)]/10 text-[var(--accent-red)] text-xs">
          {error}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-[var(--border-color)]">
        {showText ? (
          <form onSubmit={handleTextSubmit} className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a message..."
              disabled={status === "processing"}
              className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none focus:border-[var(--accent-blue)] transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status === "processing" || !textInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-[var(--accent-blue)] text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "processing" ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 12 7-7 7 7" />
                  <path d="M12 19V5" />
                </svg>
              )}
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-center">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={status === "processing" || status === "playing"}
              className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                status === "recording"
                  ? "bg-[var(--accent-red)] glow-blue scale-110"
                  : "bg-[var(--accent-blue)] hover:bg-blue-600"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {/* Pulse ring when recording */}
              {status === "recording" && (
                <div className="absolute inset-0 rounded-full bg-[var(--accent-red)]/30 animate-pulse-ring" />
              )}

              {status === "processing" ? (
                <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              )}
            </button>
          </div>
        )}

        {!showText && (
          <p className="text-center text-xs text-[var(--text-secondary)] mt-2">
            {status === "recording"
              ? "Release to send"
              : "Hold to talk"}
          </p>
        )}
      </div>
    </div>
  );
}
