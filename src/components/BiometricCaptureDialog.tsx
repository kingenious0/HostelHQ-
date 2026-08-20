"use client";

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Fingerprint, Loader2, Shield, AlertTriangle, Smartphone, Monitor, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  isBiometricSupported,
  isPlatformAuthenticatorAvailable,
  registerBiometric,
  verifyBiometric,
  getDeviceTypeName,
} from '@/lib/webauthn';
import { FaceCaptureDialog } from './FaceCaptureDialog';

interface BiometricCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture?: (biometricData: any) => void;
  onVerify?: (verified: boolean) => void;
  mode: 'register' | 'verify';
  userId: string;
  userName?: string;
  title?: string;
  description?: string;
}

export function BiometricCaptureDialog({
  open,
  onOpenChange,
  onCapture,
  onVerify,
  mode,
  userId,
  userName = '',
  title,
  description
}: BiometricCaptureDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [deviceType, setDeviceType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  
  const { toast } = useToast();

  // Check biometric support when dialog opens
  useEffect(() => {
    if (open) {
      checkBiometricSupport();
    }
  }, [open]);

  const checkBiometricSupport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supported = isBiometricSupported();
      setIsSupported(supported);

      if (supported) {
        const available = await isPlatformAuthenticatorAvailable();
        setIsAvailable(available);
        setDeviceType(getDeviceTypeName('platform'));
      }
    } catch (err: any) {
      console.error('Error checking biometric support:', err);
      setError('Unable to check biometric support');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricAction = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'register') {
        console.log('Starting biometric registration for user:', userId);
        const credential = await registerBiometric(userId, userName);
        console.log('Registration result:', credential);
        
        if (credential) {
          if (onCapture) {
            onCapture(credential);
          }
          toast({
            title: '✅ Biometric Setup Complete',
            description: `${deviceType} has been registered successfully!`,
          });
          onOpenChange(false);
        } else {
          // Registration returned null - this means it failed silently
          console.error('Registration returned null credential');
          setError('Fingerprint registration failed. Please try again or use camera instead.');
          toast({
            title: 'Registration Failed',
            description: 'Could not register fingerprint. Please try again or use camera.',
            variant: 'destructive',
          });
        }
      } else if (mode === 'verify') {
        const result = await verifyBiometric(userId);
        if (onVerify) {
          onVerify(result.success);
          if (result.success) {
            toast({
              title: '✅ Identity Verified',
              description: 'Biometric verification successful!',
            });
            onOpenChange(false);
          } else {
            setError(result.error || 'Biometric verification failed. Please try again.');
          }
        }
      }
    } catch (err: any) {
      console.error('Biometric action error:', err);
      const errorMessage = err.message || 'Biometric operation failed';
      setError(errorMessage);
      toast({
        title: 'Biometric Error',
        description: errorMessage + '. Please try again or use camera instead.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFallback = () => {
    setShowFallback(true);
  };

  const handleFaceCaptureComplete = (imageData: string) => {
    setShowFallback(false);
    if (onCapture) {
      // Convert face capture to legacy format for backward compatibility
      onCapture({ type: 'face', data: imageData });
    }
    onOpenChange(false);
  };

  const getIcon = () => {
    if (deviceType.includes('Face ID')) return <Smartphone className="h-12 w-12" />;
    if (deviceType.includes('Windows Hello')) return <Monitor className="h-12 w-12" />;
    return <Fingerprint className="h-12 w-12" />;
  };

  const getDefaultTitle = () => {
    if (mode === 'register') {
      return `🔒 Set Up ${deviceType}`;
    }
    return `🔐 Verify Your Identity`;
  };

  const getDefaultDescription = () => {
    if (mode === 'register') {
      return `Secure your account with ${deviceType} for quick and safe authentication.`;
    }
    return `Use ${deviceType} to verify it's really you making this change.`;
  };

  return (
    <>
      <Dialog open={open && !showFallback} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title || getDefaultTitle()}</DialogTitle>
            <DialogDescription>
              {description || getDefaultDescription()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Biometric Status */}
            <div className="flex flex-col items-center space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center space-y-2">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Checking biometric support...
                  </p>
                </div>
              ) : !isSupported ? (
                <div className="flex flex-col items-center space-y-2 text-center">
                  <AlertTriangle className="h-12 w-12 text-amber-500" />
                  <p className="text-sm font-medium">Biometric Not Supported</p>
                  <p className="text-xs text-muted-foreground">
                    Your browser doesn't support biometric authentication
                  </p>
                </div>
              ) : !isAvailable ? (
                <div className="flex flex-col items-center space-y-2 text-center">
                  <AlertTriangle className="h-12 w-12 text-amber-500" />
                  <p className="text-sm font-medium">No Biometric Sensor</p>
                  <p className="text-xs text-muted-foreground">
                    No fingerprint or face recognition available on this device
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2 text-center">
                  <div className="p-4 rounded-full bg-primary/10">
                    {getIcon()}
                  </div>
                  <p className="text-sm font-medium">{deviceType} Ready</p>
                  <p className="text-xs text-muted-foreground">
                    {mode === 'register' 
                      ? 'Tap the button below to set up biometric authentication'
                      : 'Tap the button below to verify your identity'
                    }
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg border border-red-200 dark:border-red-800 w-full">
                  <p className="text-sm text-red-900 dark:text-red-100 text-center">
                    {error}
                  </p>
                </div>
              )}
            </div>

            {/* Security Info */}
            {isSupported && isAvailable && (
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start space-x-2">
                  <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-900 dark:text-blue-100">
                    <p className="font-medium mb-1">Secure & Private</p>
                    <p>Your biometric data stays on your device and is never shared with our servers.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              {isSupported && isAvailable ? (
                <Button
                  onClick={handleBiometricAction}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {mode === 'register' ? 'Setting up...' : 'Verifying...'}
                    </>
                  ) : (
                    <>
                      {getIcon()}
                      <span className="ml-2">
                        {mode === 'register' ? `Set Up ${deviceType}` : `Use ${deviceType}`}
                      </span>
                    </>
                  )}
                </Button>
              ) : null}

              {/* Fallback Options */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleFallback}
                  className="flex-1"
                >
                  Use Camera Instead
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fallback Face Capture Dialog */}
      <FaceCaptureDialog
        open={showFallback}
        onOpenChange={setShowFallback}
        onCapture={handleFaceCaptureComplete}
        title="📸 Camera Verification"
        description="Since biometric authentication isn't available, please use your camera to verify your identity."
      />
    </>
  );
}
