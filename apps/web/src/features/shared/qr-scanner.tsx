"use client";

import { normalizeManualTransferCode } from "@scraptrace/contracts";
import jsQR from "jsqr";
import { Camera, CameraOff, Keyboard, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type CameraState = "idle" | "starting" | "running" | "denied" | "unsupported" | "failed";

interface QrScannerProps {
  /** Called with the scanned symbol text or the typed transfer code. */
  onResult: (value: string) => void;
  busy?: boolean;
}

const SCAN_INTERVAL_MILLISECONDS = 250;

/**
 * QR intake with three routes to the same result.
 *
 * The camera is only requested when the user starts it (FR-ACC-004). An image the user selects is
 * decoded locally, and typing the transfer code always works, so a denied permission or a browser
 * without camera support never blocks intake (FR-HND-001).
 */
export function QrScanner({ onResult, busy = false }: QrScannerProps) {
  const translate = useTranslations("qr");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | undefined>();
  const [imageError, setImageError] = useState<string | undefined>();

  const stopCamera = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const decodeFromCanvas = useCallback((width: number, height: number): string | null => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !context || width === 0 || height === 0) return null;
    const frame = context.getImageData(0, 0, width, height);
    return (
      jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "attemptBoth" })?.data ??
      null
    );
  }, []);

  const startCamera = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraState("unsupported");
      return;
    }
    setCameraState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraState("running");
    } catch (error) {
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      setCameraState(denied ? "denied" : "failed");
      stopCamera();
    }
  }, [stopCamera]);

  useEffect(() => {
    if (cameraState !== "running") return;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const found = decodeFromCanvas(canvas.width, canvas.height);
      if (found) {
        stopCamera();
        setCameraState("idle");
        onResult(found);
      }
    }, SCAN_INTERVAL_MILLISECONDS);
    return () => window.clearInterval(timer);
  }, [cameraState, decodeFromCanvas, onResult, stopCamera]);

  const readImageFile = async (file: File) => {
    setImageError(undefined);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("decode_failed"));
        image.src = url;
      });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      const found = decodeFromCanvas(canvas.width, canvas.height);
      if (found) onResult(found);
      else setImageError(translate("imageNoSymbol"));
    } catch {
      setImageError(translate("imageUnreadable"));
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (manualCode.trim().length === 0) {
      setManualError(translate("codeRequired"));
      return;
    }
    const normalized = normalizeManualTransferCode(manualCode);
    if (!normalized) {
      setManualError(translate("codeInvalid"));
      return;
    }
    setManualError(undefined);
    onResult(normalized);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="bg-surface-subtle relative aspect-square w-full max-w-xs overflow-hidden rounded-md border">
          <video
            aria-label={translate("cameraPreview")}
            className="size-full object-cover"
            muted
            playsInline
            ref={videoRef}
          />
          {cameraState !== "running" ? (
            <span className="text-muted-foreground absolute inset-0 grid place-items-center px-4 text-center text-xs">
              {translate("cameraIdle")}
            </span>
          ) : null}
        </div>
        <canvas className="hidden" ref={canvasRef} />
        <div className="flex flex-wrap gap-2">
          {cameraState === "running" ? (
            <Button
              onClick={() => {
                stopCamera();
                setCameraState("idle");
              }}
              variant="secondary"
            >
              <CameraOff aria-hidden="true" className="size-4" />
              {translate("stopCamera")}
            </Button>
          ) : (
            <Button
              disabled={busy || cameraState === "starting"}
              loading={cameraState === "starting"}
              onClick={() => void startCamera()}
            >
              <Camera aria-hidden="true" className="size-4" />
              {translate("startCamera")}
            </Button>
          )}
          <label
            className="min-h-touch border-border bg-surface hover:bg-surface-subtle has-[:focus-visible]:outline-focus inline-flex cursor-pointer items-center gap-2 rounded-sm border px-4 text-sm font-semibold has-[:focus-visible]:outline-[length:var(--focus-ring-width)]"
            data-testid="qr-image-upload"
          >
            <Upload aria-hidden="true" className="size-4" />
            {translate("useImage")}
            <input
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readImageFile(file);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
        </div>
        {cameraState === "denied" ? (
          <Alert title={translate("cameraDeniedTitle")} tone="warning">
            {translate("cameraDenied")}
          </Alert>
        ) : null}
        {cameraState === "unsupported" ? (
          <Alert title={translate("cameraUnsupportedTitle")} tone="info">
            {translate("cameraUnsupported")}
          </Alert>
        ) : null}
        {cameraState === "failed" ? (
          <Alert title={translate("cameraFailedTitle")} tone="warning">
            {translate("cameraFailed")}
          </Alert>
        ) : null}
        {imageError ? (
          <Alert title={translate("imageErrorTitle")} tone="warning">
            {imageError}
          </Alert>
        ) : null}
      </div>

      <form className="space-y-2" noValidate onSubmit={submitManual}>
        <Field
          error={manualError}
          hint={translate("codeHint")}
          label={translate("codeLabel")}
          required
        >
          {(control) => (
            <Input
              autoCapitalize="characters"
              autoComplete="off"
              className="font-mono"
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              spellCheck={false}
              value={manualCode}
              {...control}
            />
          )}
        </Field>
        <Button block disabled={busy} loading={busy} type="submit" variant="secondary">
          <Keyboard aria-hidden="true" className="size-4" />
          {translate("lookUp")}
        </Button>
      </form>
    </div>
  );
}
