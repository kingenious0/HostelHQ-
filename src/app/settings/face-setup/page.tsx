"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FaceCaptureDialog } from '@/components/FaceCaptureDialog';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getFaceDescriptorFromBase64, descriptorToArray } from '@/lib/faceDetection';
import { Loader2, Shield, CheckCircle, Camera, AlertTriangle } from 'lucide-react';

export default function FaceSetupPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFaceCaptureOpen, setIsFaceCaptureOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasFaceData, setHasFaceData] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Check if user already has face data
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setHasFaceData(!!userData.faceDescriptor);
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleFaceCapture = async (capturedImageBase64: string) => {
    setIsProcessing(true);
    
    try {
      // Extract face descriptor from captured image
      const faceDescriptor = await getFaceDescriptorFromBase64(capturedImageBase64);
      
      if (!faceDescriptor) {
        toast({
          title: 'No Face Detected',
          description: 'Please ensure your face is clearly visible and try again.',
          variant: 'destructive'
        });
        setIsProcessing(false);
        return;
      }

      // Convert descriptor to array for storage
      const descriptorArray = descriptorToArray(faceDescriptor);

      // Save to Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        faceDescriptor: descriptorArray,
        faceSetupDate: new Date().toISOString()
      });

      toast({
        title: '✅ Face Verification Set Up!',
        description: 'Your face has been registered successfully. You can now use face verification for security.',
      });

      setHasFaceData(true);
      setIsProcessing(false);
    } catch (error: any) {
      console.error('Face setup error:', error);
      toast({
        title: 'Setup Failed',
        description: error.message || 'Could not set up face verification. Please try again.',
        variant: 'destructive'
      });
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 py-12 px-4 bg-gray-50/50">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold font-headline">Face Verification Setup</h1>
            <p className="text-muted-foreground">
              Add an extra layer of security to your account
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Why Set Up Face Verification?
              </CardTitle>
              <CardDescription>
                Face verification adds biometric security to protect your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Secure Phone Number Changes</p>
                    <p className="text-sm text-muted-foreground">
                      Verify your identity when changing your phone number
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Prevent Unauthorized Access</p>
                    <p className="text-sm text-muted-foreground">
                      Protect against account takeover attempts
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Privacy Protected</p>
                    <p className="text-sm text-muted-foreground">
                      Your face data is encrypted and stored securely
                    </p>
                  </div>
                </div>
              </div>

              {hasFaceData ? (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-900 dark:text-green-100">
                        Face Verification Active
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-200">
                        Your face has been registered and is ready to use
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsFaceCaptureOpen(true)}
                    variant="outline"
                    className="w-full mt-4"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Update Face Data
                  </Button>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-100">
                        Face Verification Not Set Up
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-200">
                        Set up face verification to enhance your account security
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsFaceCaptureOpen(true)}
                    className="w-full"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
                    Set Up Face Verification
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  1
                </div>
                <div>
                  <p className="font-medium">Capture Your Face</p>
                  <p className="text-sm text-muted-foreground">
                    Take a clear selfie using your device camera
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  2
                </div>
                <div>
                  <p className="font-medium">Face Analysis</p>
                  <p className="text-sm text-muted-foreground">
                    Our system creates a unique face descriptor (not the actual photo)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  3
                </div>
                <div>
                  <p className="font-medium">Secure Storage</p>
                  <p className="text-sm text-muted-foreground">
                    The face descriptor is encrypted and stored in your account
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  4
                </div>
                <div>
                  <p className="font-medium">Verification</p>
                  <p className="text-sm text-muted-foreground">
                    When changing sensitive settings, you'll verify your identity with a selfie
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <FaceCaptureDialog
        open={isFaceCaptureOpen}
        onOpenChange={setIsFaceCaptureOpen}
        onCapture={handleFaceCapture}
        title="📸 Capture Your Face"
        description="Position your face in the center and ensure good lighting"
      />
    </div>
  );
}
