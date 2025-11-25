"use client";

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, RefreshCw, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FaceCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (imageData: string) => void;
  title?: string;
  description?: string;
}

export function FaceCaptureDialog({
  open,
  onOpenChange,
  onCapture,
  title = "📸 Capture Your Face",
  description = "Position your face in the center and click capture"
}: FaceCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Start camera when dialog opens
  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
      setError(null);
    }

    return () => {
      stopCamera();
    };
  }, [open]);

  const startCamera = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser or environment');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Front camera
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraReady(true);
          setIsLoading(false);
        };
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError('Unable to access camera. Please grant camera permissions.');
      toast({
        title: 'Camera Access Denied',
        description: 'Please allow camera access to continue.',
        variant: 'destructive'
      });
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data as base64
    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(imageData);
    
    // Stop camera after capture to save resources
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    // Restart camera when retaking
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      stopCamera();
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    stopCamera();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera/Preview Area */}
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
            {!capturedImage ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* Camera overlay guide */}
                {isCameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-80 border-4 border-white/50 rounded-full"></div>
                  </div>
                )}

                {/* Loading state */}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center text-white">
                      <Loader2 className="h-12 w-12 animate-spin mx-auto mb-2" />
                      <p>Starting camera...</p>
                    </div>
                  </div>
                )}

                {/* Error state */}
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className="text-center text-white p-4">
                      <Camera className="h-12 w-12 mx-auto mb-2 text-red-400" />
                      <p className="text-sm">{error}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <img
                src={capturedImage}
                alt="Captured face"
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Hidden canvas for image capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Instructions */}
          {!capturedImage && isCameraReady && (
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                💡 <strong>Tips:</strong> Look directly at the camera, ensure good lighting, and keep your face centered.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            {!capturedImage ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={captureImage}
                  disabled={!isCameraReady || isLoading}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Capture
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleRetake}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retake
                </Button>
                <Button onClick={handleConfirm}>
                  <Check className="h-4 w-4 mr-2" />
                  Confirm
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
