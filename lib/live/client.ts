"use client";

import { GoogleGenAI, Modality, type Session } from "@google/genai";
import { LIVE_SYSTEM_INSTRUCTION } from "./system-instruction";
import { LIVE_TOOL_DECLARATIONS } from "./tools-declaration";

export type LiveStatus = "live" | "reconnecting" | "offline";

export interface LiveToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LiveClientOptions {
  fetchToken: () => Promise<{ token: string; model: string }>;
  onStatusChange?: (status: LiveStatus) => void;
  onModelAudio?: (base64Audio: string) => void;
  onTranscript?: (source: "user" | "model", text: string) => void;
  onToolCall?: (call: LiveToolCall) => void;
  onError?: (error: Error | string) => void;
  onInterrupted?: () => void;
}

export class GeminiLiveClient {
  private session: Session | null = null;
  private status: LiveStatus = "offline";
  private resumptionHandle: string | null = null;
  private isExplicitlyClosed: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private options: LiveClientOptions;

  constructor(options: LiveClientOptions) {
    this.options = options;
  }

  private setStatus(newStatus: LiveStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.options.onStatusChange?.(newStatus);
    }
  }

  getStatus(): LiveStatus {
    return this.status;
  }

  async connect(resumeHandle?: string): Promise<void> {
    this.isExplicitlyClosed = false;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    try {
      this.setStatus(this.reconnectAttempts > 0 ? "reconnecting" : "reconnecting");

      const { token, model } = await this.options.fetchToken();

      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: "v1alpha" },
      });

      const handleToUse = resumeHandle || this.resumptionHandle || undefined;

      const session = await ai.live.connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: {
            parts: [{ text: LIVE_SYSTEM_INSTRUCTION }],
          },
          tools: [
            {
              functionDeclarations: LIVE_TOOL_DECLARATIONS,
            },
          ],
          contextWindowCompression: {
            slidingWindow: {},
          },
          sessionResumption: handleToUse ? { handle: handleToUse } : {},
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            this.reconnectAttempts = 0;
            this.setStatus("live");
          },
          onmessage: (message) => {
            this.handleServerMessage(message);
          },
          onerror: (err) => {
            const message = err?.message || "Gemini Live error";
            console.error("Gemini Live connection error:", err);
            this.handleConnectionDrop(new Error(message));
          },
          onclose: (e) => {
            if (!this.isExplicitlyClosed) {
              console.warn("Gemini Live closed unexpectedly:", e.reason);
              this.handleConnectionDrop(new Error(e.reason || "Connection closed"));
            } else {
              this.setStatus("offline");
            }
          },
        },
      });

      this.session = session;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("Failed to connect to Gemini Live:", error);
      this.handleConnectionDrop(error);
    }
  }

  private handleServerMessage(message: unknown): void {
    if (!message || typeof message !== "object") return;
    const msg = message as Record<string, unknown>;

    // 1. Session Resumption Update
    if (msg.sessionResumptionUpdate) {
      const update = msg.sessionResumptionUpdate as {
        resumable?: boolean;
        newHandle?: string;
      };
      if (update.newHandle) {
        this.resumptionHandle = update.newHandle;
      }
    }

    // 2. GoAway signal
    if (msg.goAway) {
      console.warn("Received GoAway signal from Gemini server. Reconnecting...");
      this.handleConnectionDrop(new Error("Server requested reconnection (GoAway)"));
      return;
    }

    // 3. Server Content (Audio, Transcriptions, Interruption)
    if (msg.serverContent) {
      const content = msg.serverContent as {
        modelTurn?: {
          parts?: Array<{
            inlineData?: {
              data?: string;
              mimeType?: string;
            };
          }>;
        };
        inputTranscription?: { text?: string };
        outputTranscription?: { text?: string };
        interrupted?: boolean;
      };

      if (content.interrupted) {
        this.options.onInterrupted?.();
      }

      if (content.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.inlineData?.data) {
            this.options.onModelAudio?.(part.inlineData.data);
          }
        }
      }

      if (content.inputTranscription?.text) {
        this.options.onTranscript?.("user", content.inputTranscription.text);
      }

      if (content.outputTranscription?.text) {
        this.options.onTranscript?.("model", content.outputTranscription.text);
      }
    }

    // 4. Tool Calls
    if (msg.toolCall) {
      const toolCall = msg.toolCall as {
        functionCalls?: Array<{
          id: string;
          name: string;
          args?: Record<string, unknown>;
        }>;
      };

      if (toolCall.functionCalls) {
        for (const call of toolCall.functionCalls) {
          this.options.onToolCall?.({
            id: call.id,
            name: call.name,
            args: call.args || {},
          });
        }
      }
    }
  }

  private handleConnectionDrop(reason: Error): void {
    if (this.isExplicitlyClosed) return;

    if (this.session) {
      try {
        this.session.close();
      } catch {
        // Ignored
      }
      this.session = null;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.setStatus("reconnecting");
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), 5000);
      this.reconnectTimeoutId = setTimeout(() => {
        this.connect(this.resumptionHandle || undefined);
      }, delay);
    } else {
      this.setStatus("offline");
      this.options.onError?.(
        new Error(
          `Connection lost: ${reason.message}. Please check your connection and tap Retry.`,
        ),
      );
    }
  }

  sendAudio(base64Pcm: string): void {
    if (!this.session || this.status !== "live") return;
    try {
      this.session.sendRealtimeInput({
        audio: {
          data: base64Pcm,
          mimeType: "audio/pcm;rate=16000",
        },
      });
    } catch (e) {
      console.error("Error sending audio frame:", e);
    }
  }

  sendAudioStreamEnd(): void {
    if (!this.session || this.status !== "live") return;
    try {
      this.session.sendRealtimeInput({
        audioStreamEnd: true,
      });
    } catch (e) {
      console.error("Error sending audioStreamEnd:", e);
    }
  }

  sendFrame(jpegBase64: string): void {
    if (!this.session || this.status !== "live") return;
    try {
      this.session.sendRealtimeInput({
        video: {
          data: jpegBase64,
          mimeType: "image/jpeg",
        },
      });
    } catch (e) {
      console.error("Error sending video frame:", e);
    }
  }

  sendToolResponse(
    callId: string,
    name: string,
    response: Record<string, unknown>,
  ): void {
    if (!this.session || this.status !== "live") return;
    try {
      this.session.sendToolResponse({
        functionResponses: [
          {
            id: callId,
            name,
            response,
          },
        ],
      });
    } catch (e) {
      console.error("Error sending tool response:", e);
    }
  }

  disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.session) {
      try {
        this.session.close();
      } catch {
        // Ignored
      }
      this.session = null;
    }
    this.setStatus("offline");
  }
}
