"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LiveIndicator } from "@/components/LiveIndicator";
import { LogoutButton } from "@/components/LogoutButton";
import { ProductRow } from "@/components/ProductRow";
import { GeminiLiveClient, type LiveStatus, type LiveToolCall } from "@/lib/live/client";
import { LiveAudioController } from "@/lib/live/audio";
import type { Product } from "@/lib/validation";

const FRAME_INTERVAL_MS = 1000;
const MAX_FRAME_DIMENSION = 512;
const JPEG_QUALITY = 0.55;

interface ScanScreenProps {
  storeId: string;
  storeName: string;
}

interface DebugLog {
  id: string;
  time: string;
  name: string;
  args: Record<string, unknown>;
  response: Record<string, unknown>;
}

export function ScanScreen({ storeId, storeName }: ScanScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDebug = searchParams.get("debug") === "1";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [status, setStatus] = useState<LiveStatus>("offline");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isSheetExpanded, setIsSheetExpanded] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("Point at a shelf and say what you see.");
  const [isPushToTalk, setIsPushToTalk] = useState<boolean>(true);
  const [isTalking, setIsTalking] = useState<boolean>(false);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);

  // Phase 3 Product state
  const [products, setProducts] = useState<Product[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [droppingTag, setDroppingTag] = useState<{ id: string; name: string } | null>(null);
  const [actionError, setActionError] = useState<{
    message: string;
    retry: () => void;
  } | null>(null);

  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const audioControllerRef = useRef<LiveAudioController | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pointerDownTimeRef = useRef<number>(0);
  const wasTalkingOnDownRef = useRef<boolean>(false);

  // Load existing products on page load
  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(`/api/tools?storeId=${storeId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.products)) {
          setProducts(data.products);
          if (data.products.length > 0) {
            setIsSheetExpanded(true);
          }
        }
      }
    } catch {
      // Offline or transient error; products stay empty or preserved in state
    }
  }, [storeId]);

  // Mint ephemeral token from server route
  const fetchToken = useCallback(async () => {
    const res = await fetch("/api/live-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || "Failed to mint live token");
    }

    return { token: data.token, model: data.model };
  }, [storeId]);

  // Capture a single frame from video element and send to Gemini
  const sendVideoFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !liveClientRef.current) return;
    if (liveClientRef.current.getStatus() !== "live") return;

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvasRef.current = canvas;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    let targetW = vw;
    let targetH = vh;
    if (vw > targetH) {
      if (vw > MAX_FRAME_DIMENSION) {
        targetW = MAX_FRAME_DIMENSION;
        targetH = Math.round((vh * MAX_FRAME_DIMENSION) / vw);
      }
    } else {
      if (vh > MAX_FRAME_DIMENSION) {
        targetH = MAX_FRAME_DIMENSION;
        targetW = Math.round((vw * MAX_FRAME_DIMENSION) / vh);
      }
    }

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, targetW, targetH);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const base64 = dataUrl.split(",")[1];
    if (base64) {
      liveClientRef.current.sendFrame(base64);
    }
  }, []);

  // Initialize camera
  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setHasMultipleCameras(videoInputs.length > 1);
      setPermissionDenied(false);
    } catch (err: unknown) {
      console.error("Camera error:", err);
      const isDenied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      if (isDenied) {
        setPermissionDenied(true);
      } else {
        setErrorMsg("Couldn't access camera on this device.");
      }
    }
  }, []);

  // Initialize Live audio and Live client session
  const startSession = useCallback(async () => {
    if (audioControllerRef.current) {
      audioControllerRef.current.close();
      audioControllerRef.current = null;
    }
    if (liveClientRef.current) {
      liveClientRef.current.disconnect();
      liveClientRef.current = null;
    }

    const audioCtrl = new LiveAudioController();
    audioControllerRef.current = audioCtrl;

    const client = new GeminiLiveClient({
      fetchToken,
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onModelAudio: (base64Audio) => {
        audioCtrl.playAudioChunk(base64Audio);
      },
      onTranscript: (source, text) => {
        const prefix = source === "user" ? "You" : "Stockeye";
        setTranscript(`${prefix}: ${text}`);
      },
      onInterrupted: () => {
        audioCtrl.stopPlayback();
      },
      onToolCall: async (call: LiveToolCall) => {
        try {
          const res = await fetch("/api/tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storeId,
              tool: call.name,
              args: call.args,
              source: "camera",
            }),
          });
          const data = await res.json();

          // Send result back to Gemini so the conversation continues
          client.sendToolResponse(call.id, call.name, data);

          setDebugLogs((prev) => [
            {
              id: call.id,
              time: new Date().toLocaleTimeString(),
              name: call.name,
              args: call.args,
              response: data,
            },
            ...prev.slice(0, 19),
          ]);

          if (data.ok) {
            setActionError(null);

            if (call.name === "add_product" && data.product) {
              const newProd = data.product as Product;

              // Tag drop animation
              setDroppingTag({ id: newProd.id, name: newProd.name });
              setTimeout(() => {
                setDroppingTag(null);
              }, 480);

              // Update product list
              setProducts((prev) => {
                const idx = prev.findIndex((p) => p.id === newProd.id);
                if (idx !== -1) {
                  const updated = [...prev];
                  updated[idx] = newProd;
                  return updated;
                }
                return [newProd, ...prev];
              });

              // Expand sheet so owner sees newly recognized product and Review catalogue button
              setIsSheetExpanded(true);

              // 600ms leaf tint highlight
              setHighlightedId(newProd.id);
              setTimeout(() => setHighlightedId(null), 600);
            } else if (
              (call.name === "update_product" || call.name === "confirm_product") &&
              data.product
            ) {
              const updatedProd = data.product as Product;
              setProducts((prev) =>
                prev.map((p) => (p.id === updatedProd.id ? updatedProd : p)),
              );
              setHighlightedId(updatedProd.id);
              setTimeout(() => setHighlightedId(null), 600);
            } else if (call.name === "remove_product" && data.removed_id) {
              setProducts((prev) => prev.filter((p) => p.id !== data.removed_id));
            } else if (call.name === "publish_store") {
              if (data.published || data.action === "review" || data.redirectUrl) {
                router.push(`/review/${storeId}`);
              }
            }
          } else {
            // Model tool execution returned error
            if (data.error !== "review_required" && data.error !== "ambiguous") {
              setActionError({
                message: "Couldn't save that. Nothing was changed.",
                retry: () => {
                  setActionError(null);
                  client.sendToolResponse(call.id, call.name, {
                    ok: true,
                    retry: true,
                  });
                },
              });
            }
          }
        } catch (e) {
          console.error("Tool execution network error:", e);
          client.sendToolResponse(call.id, call.name, {
            ok: false,
            error: "client_error",
            message: "Failed to communicate with server",
          });
          setActionError({
            message: "Couldn't save that. Nothing was changed.",
            retry: () => setActionError(null),
          });
        }
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : String(err);
        setErrorMsg(message);
      },
    });

    liveClientRef.current = client;

    try {
      await audioCtrl.startCapture((chunk) => {
        client.sendAudio(chunk);
      });
      audioCtrl.setMuted(isPushToTalk);

      await client.connect();

      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = setInterval(sendVideoFrame, FRAME_INTERVAL_MS);
    } catch (err) {
      console.error("Session start error:", err);
      setErrorMsg("Failed to start session. Check your connection.");
    }
  }, [fetchToken, sendVideoFrame, isPushToTalk, storeId, router]);

  // Flip camera between environment and user
  const toggleCamera = () => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    void startCamera(nextFacing);
  };

  // Push-to-talk press handlers supporting both hold-to-talk and tap-to-talk
  const handleMicDown = () => {
    pointerDownTimeRef.current = Date.now();
    wasTalkingOnDownRef.current = isTalking;

    if (!isPushToTalk) {
      const nextTalking = !isTalking;
      setIsTalking(nextTalking);
      audioControllerRef.current?.setMuted(!nextTalking);
      if (!nextTalking) {
        liveClientRef.current?.sendAudioStreamEnd();
      } else {
        audioControllerRef.current?.stopPlayback();
      }
      return;
    }

    // Push-to-talk: start streaming audio
    if (!isTalking) {
      setIsTalking(true);
      audioControllerRef.current?.stopPlayback();
      audioControllerRef.current?.setMuted(false);
    }
  };

  const handleMicUp = () => {
    if (!isPushToTalk) return;
    const pressDuration = Date.now() - pointerDownTimeRef.current;

    // If held for >= 300ms, release finishes speech immediately
    if (pressDuration >= 300) {
      setIsTalking(false);
      audioControllerRef.current?.setMuted(true);
      liveClientRef.current?.sendAudioStreamEnd();
    } else {
      // If quick tap:
      if (wasTalkingOnDownRef.current) {
        // User tapped while already listening -> finish speech and send immediately
        setIsTalking(false);
        audioControllerRef.current?.setMuted(true);
        liveClientRef.current?.sendAudioStreamEnd();
      } else {
        // User tapped while idle -> stay listening
        setIsTalking(true);
        audioControllerRef.current?.setMuted(false);
      }
    }
  };

  // Toggle push-to-talk mode vs open-mic
  const toggleMode = () => {
    const nextMode = !isPushToTalk;
    setIsPushToTalk(nextMode);
    setIsTalking(false);
    audioControllerRef.current?.setMuted(nextMode);
  };

  // Manual in-place row save
  const handleRowSave = async (
    product: Product,
    fields: {
      name?: string;
      size?: string | null;
      price?: number | null;
      stock?: number | null;
    },
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          tool: "update_product",
          args: {
            product_ref: product.id,
            name: fields.name,
            size: fields.size,
            price: fields.price,
            stock: fields.stock,
          },
          source: "manual",
        }),
      });
      const data = await res.json();
      if (data.ok && data.product) {
        const updated = data.product as Product;
        setProducts((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
        setHighlightedId(updated.id);
        setTimeout(() => setHighlightedId(null), 600);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Manual in-place row delete
  const handleRowDelete = async (productId: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          tool: "remove_product",
          args: {
            product_ref: productId,
          },
          source: "manual",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    let isCancelled = false;

    async function init() {
      await loadProducts();
      if (isCancelled) return;
      await startCamera(facingMode);
      if (isCancelled) return;
      await startSession();
    }

    void init();

    return () => {
      isCancelled = true;
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioControllerRef.current) {
        audioControllerRef.current.close();
        audioControllerRef.current = null;
      }
      if (liveClientRef.current) {
        liveClientRef.current.disconnect();
        liveClientRef.current = null;
      }
    };
  }, [facingMode, startCamera, startSession, loadProducts]);

  const totalProducts = products.length;
  const needInfoProducts = products.filter(
    (p) => p.price === null || p.stock === null,
  ).length;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-ink select-none">
      {/* Camera Video Feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Top Bar Scrim */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between bg-black/60 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <LiveIndicator status={status} />
          <span className="text-[14px] text-white/80 truncate max-w-[150px]">
            {storeName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasMultipleCameras && (
            <button
              type="button"
              onClick={toggleCamera}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[8px] bg-white/20 px-3.5 text-[14px] text-white hover:bg-white/30"
              aria-label="Switch camera"
            >
              Flip
            </button>
          )}

          <Link
            href={`/review/${storeId}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[8px] bg-white/20 px-4 text-[14px] font-medium text-white hover:bg-white/30"
          >
            Finish
          </Link>

          <LogoutButton className="inline-flex min-h-[44px] items-center justify-center rounded-[8px] bg-white/10 px-3 text-[13px] font-medium text-white/80 hover:bg-white/20 transition-colors" />
        </div>
      </div>

      {/* Viewfinder Center Corner Brackets */}
      <div
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="relative h-64 w-64 max-w-[70vw] max-h-[70vw]">
          <div className="absolute top-0 left-0 h-6 w-6 border-t-2 border-l-2 border-white/80" />
          <div className="absolute top-0 right-0 h-6 w-6 border-t-2 border-r-2 border-white/80" />
          <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-white/80" />
          <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-white/80" />
        </div>
      </div>

      {/* Tag Drop Animated Chip */}
      {droppingTag && (
        <div
          className="pointer-events-none fixed top-1/2 left-1/2 z-30 animate-tag-drop rounded-[8px] border border-line bg-surface px-4 py-2 text-ink flex items-center gap-2.5"
          aria-hidden="true"
        >
          <img
            src={`/api/product-image?name=${encodeURIComponent(droppingTag.name)}`}
            alt=""
            className="h-7 w-7 rounded-[4px] object-cover border border-line bg-paper shrink-0"
            onError={(e) => {
              const target = e.currentTarget;
              target.onerror = null;
              target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='88' height='88' viewBox='0 0 88 88'%3E%3Crect width='88' height='88' rx='8' fill='%231E5B43' fill-opacity='0.10'/%3E%3Ctext x='44' y='48' font-size='28' text-anchor='middle'%3E📦%3C/text%3E%3C/svg%3E";
            }}
          />
          <span className="font-medium text-[15px]">{droppingTag.name}</span>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="absolute top-16 inset-x-4 z-30 flex items-center justify-between rounded-[8px] border border-brick/30 bg-brick-tint p-3 text-[13px] text-ink">
          <span>{actionError.message}</span>
          <button
            type="button"
            onClick={actionError.retry}
            className="ml-3 min-h-[44px] px-2 font-semibold underline text-brick"
          >
            Retry
          </button>
        </div>
      )}

      {/* Permission Denied / Error Overlay */}
      {(permissionDenied || errorMsg) && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-paper/95 p-6 text-center text-ink">
          <div className="max-w-md">
            <h2 className="font-heading text-[20px] font-semibold text-ink">
              {permissionDenied
                ? "Camera and mic access required"
                : "Connection lost"}
            </h2>
            <p className="mt-2 text-[15px] text-ink-muted">
              {permissionDenied
                ? "Stockeye needs camera and microphone permissions to see your shelf and talk with you. Please enable them in your browser settings."
                : errorMsg || "The session ended unexpectedly. Tap Retry to reconnect."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  void startCamera(facingMode);
                  void startSession();
                }}
                className="inline-flex min-h-[44px] h-12 items-center justify-center rounded-[8px] bg-leaf px-6 text-[15px] font-medium text-white hover:bg-leaf/90"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[20px] bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.15)] transition-all duration-300 ease-out ${
          isSheetExpanded ? "h-[65dvh]" : "h-auto max-h-[40dvh]"
        }`}
      >
        {/* Header / Count / Pull Up Bar */}
        <button
          type="button"
          onClick={() => setIsSheetExpanded(!isSheetExpanded)}
          className="w-full min-h-[44px] px-4 pt-3 pb-2 text-left focus-visible:outline-none"
          aria-label={
            isSheetExpanded ? "Collapse product list" : "Expand product list"
          }
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-ink">
              {totalProducts} {totalProducts === 1 ? "product" : "products"},{" "}
              {needInfoProducts} need info
            </span>
            <span className="text-[13px] text-ink-muted">
              {isSheetExpanded ? "Tap to collapse" : "Pull up"}
            </span>
          </div>
        </button>

        {/* Latest Transcript Line */}
        <div className="px-4 py-2 border-t border-line">
          <p className="text-[14px] text-ink-muted truncate" aria-live="polite">
            {transcript}
          </p>
        </div>

        {/* Mic Control Bar */}
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-4 border-t border-line bg-paper/50">
          <button
            type="button"
            onPointerDown={handleMicDown}
            onPointerUp={handleMicUp}
            onPointerCancel={handleMicUp}
            className={`flex h-16 w-16 items-center justify-center rounded-full transition-transform active:scale-95 ${
              isTalking
                ? "bg-leaf ring-4 ring-leaf-tint text-white"
                : "bg-leaf text-white"
            }`}
            aria-label={isPushToTalk ? "Hold to talk" : "Tap to talk"}
          >
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>

          <div className="flex items-center gap-3 text-[13px] text-ink-muted">
            <span>
              {isPushToTalk
                ? isTalking
                  ? "Listening... Tap to finish"
                  : "Tap or hold to talk"
                : isTalking
                ? "Microphone open"
                : "Microphone muted"}
            </span>
            <span>•</span>
            <button
              type="button"
              onClick={toggleMode}
              className="min-h-[44px] px-2 py-2 underline hover:text-ink inline-flex items-center"
            >
              {isPushToTalk ? "Switch to open mic" : "Switch to push to talk"}
            </button>
          </div>
        </div>

        {/* Product List Content (Visible when expanded) */}
        {isSheetExpanded && (
          <div className="flex-1 flex flex-col overflow-hidden border-t border-line">
            <div className="flex-1 overflow-y-auto">
              {products.length === 0 ? (
                <div className="p-6 text-center text-ink-muted text-[14px]">
                  Nothing added yet. Point the camera at a shelf and say what you
                  see.
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {products.map((prod) => (
                    <ProductRow
                      key={prod.id}
                      product={prod}
                      isHighlighted={highlightedId === prod.id}
                      onSave={(fields) => handleRowSave(prod, fields)}
                      onDelete={() => handleRowDelete(prod.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Review Catalogue button below products */}
            {products.length > 0 && (
              <div className="p-4 border-t border-line bg-surface shrink-0">
                <Link
                  href={`/review/${storeId}`}
                  className="flex min-h-[44px] h-12 w-full items-center justify-center rounded-[8px] bg-leaf px-4 text-[15px] font-medium text-white hover:bg-leaf/90 transition-colors shadow-sm"
                >
                  Review catalogue ({totalProducts} {totalProducts === 1 ? "item" : "items"})
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Developer Debug Panel (?debug=1) */}
      {isDebug && (
        <div className="absolute top-16 left-4 right-4 z-40 max-h-48 overflow-y-auto rounded-[8px] bg-black/90 p-3 text-[12px] font-mono text-green-400">
          <div className="flex items-center justify-between border-b border-green-800 pb-1 mb-2">
            <span className="font-semibold text-white">Debug Tool Log</span>
            <span>{debugLogs.length} events</span>
          </div>
          {debugLogs.length === 0 ? (
            <p className="text-gray-400">No tool calls received yet.</p>
          ) : (
            debugLogs.map((log) => (
              <div key={log.id} className="mb-2 border-b border-gray-800 pb-1">
                <div>
                  <span className="text-gray-400">[{log.time}]</span>{" "}
                  <span className="text-yellow-400">{log.name}</span>
                </div>
                <div className="text-gray-300">
                  Args: {JSON.stringify(log.args)}
                </div>
                <div className="text-green-500">
                  Ack: {JSON.stringify(log.response)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
