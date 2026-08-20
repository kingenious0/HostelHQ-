"use client";

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SecurityAlarmProps {
  open: boolean;
  onClose: () => void;
  message?: string;
}

export function SecurityAlarm({ 
  open, 
  onClose,
  message = "SECURITY ALERT: Face verification failed! Possible impersonation attempt detected."
}: SecurityAlarmProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (open) {
      // Start alarm sound
      playAlarm();
      // Start flashing effect
      setIsFlashing(true);
    } else {
      // Stop alarm sound
      stopAlarm();
      // Stop flashing
      setIsFlashing(false);
    }

    return () => {
      stopAlarm();
    };
  }, [open]);

  const playAlarm = () => {
    // Create alarm sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for beeping sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Set alarm frequency (high-pitched beep)
    oscillator.frequency.value = 1000; // 1000 Hz
    oscillator.type = 'sine';
    
    // Set volume
    gainNode.gain.value = 0.3;
    
    // Start oscillator
    oscillator.start();
    
    // Create pulsing effect (beep pattern)
    let isBeeping = true;
    const beepInterval = setInterval(() => {
      gainNode.gain.value = isBeeping ? 0.3 : 0;
      isBeeping = !isBeeping;
    }, 300); // Beep every 300ms
    
    // Store references for cleanup
    audioRef.current = {
      context: audioContext,
      oscillator: oscillator,
      interval: beepInterval
    } as any;
  };

  const stopAlarm = () => {
    if (audioRef.current) {
      const audio = audioRef.current as any;
      
      if (audio.interval) {
        clearInterval(audio.interval);
      }
      
      if (audio.oscillator) {
        try {
          audio.oscillator.stop();
        } catch (e) {
          // Oscillator already stopped
        }
      }
      
      if (audio.context) {
        try {
          audio.context.close();
        } catch (e) {
          // Context already closed
        }
      }
      
      audioRef.current = null;
    }
  };

  const handleClose = () => {
    stopAlarm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className={`sm:max-w-md border-4 border-red-600 ${
          isFlashing ? 'animate-pulse' : ''
        }`}
        style={{
          backgroundColor: isFlashing ? '#fee2e2' : 'white',
        }}
      >
        <div className="space-y-6 py-4">
          {/* Animated Alert Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <AlertTriangle 
                className="h-24 w-24 text-red-600 animate-bounce" 
                strokeWidth={2}
              />
              {/* Pulsing rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-32 w-32 rounded-full border-4 border-red-600 animate-ping opacity-75"></div>
              </div>
            </div>
          </div>

          {/* Alert Title */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-red-600 animate-pulse">
              🚨 SECURITY ALERT 🚨
            </h2>
            <p className="text-lg font-semibold text-red-700">
              UNAUTHORIZED ACCESS ATTEMPT
            </p>
          </div>

          {/* Alert Message */}
          <div className="bg-red-100 border-2 border-red-600 rounded-lg p-4">
            <p className="text-center text-red-900 font-medium">
              {message}
            </p>
          </div>

          {/* Warning Details */}
          <div className="bg-yellow-50 border-2 border-yellow-600 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-yellow-900">
              ⚠️ SECURITY MEASURES ACTIVATED:
            </p>
            <ul className="text-xs text-yellow-800 space-y-1 list-disc list-inside">
              <li>Phone number change has been blocked</li>
              <li>Security team has been notified</li>
              <li>This incident has been logged</li>
              <li>Account owner will be alerted via email and SMS</li>
            </ul>
          </div>

          {/* Close Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleClose}
              variant="destructive"
              size="lg"
              className="w-full"
            >
              <X className="h-5 w-5 mr-2" />
              Acknowledge & Close
            </Button>
          </div>

          {/* Footer Warning */}
          <p className="text-xs text-center text-gray-600">
            If this was you, please contact support immediately.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
