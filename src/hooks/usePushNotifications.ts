"use client";

import { useState, useEffect, useCallback } from 'react';
import { getMessagingInstance } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export const usePushNotifications = () => {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    token: null,
    isLoading: true,
    error: null,
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Monitor auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  // Check if notifications are supported
  useEffect(() => {
    const checkSupport = async () => {
      if (typeof window === 'undefined') {
        setState(prev => ({ ...prev, isSupported: false, isLoading: false }));
        return;
      }

      const messaging = await getMessagingInstance();
      const isSupported = !!messaging && 'Notification' in window;
      
      setState(prev => ({
        ...prev,
        isSupported,
        permission: isSupported ? Notification.permission : 'denied',
        isLoading: false,
      }));
    };

    checkSupport();
  }, []);

  // Request notification permission and get FCM token
  const requestPermission = useCallback(async (): Promise<string | null> => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: 'Push notifications are not supported in this browser' }));
      return null;
    }

    if (!currentUserId) {
      setState(prev => ({ ...prev, error: 'You must be logged in to enable notifications' }));
      return null;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        setState(prev => ({
          ...prev,
          permission,
          isLoading: false,
          error: 'Notification permission denied',
        }));
        return null;
      }

      // Get FCM token
      const messaging = await getMessagingInstance();
      if (!messaging) {
        throw new Error('Firebase Messaging not available');
      }

      // VAPID key from Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      
      if (!vapidKey) {
        throw new Error('VAPID key not configured. Please add NEXT_PUBLIC_FIREBASE_VAPID_KEY to your .env file');
      }

      const token = await getToken(messaging, { vapidKey });

      if (!token) {
        throw new Error('Failed to get FCM token');
      }

      // Save token to Firestore
      await saveTokenToFirestore(currentUserId, token);

      setState(prev => ({
        ...prev,
        permission: 'granted',
        token,
        isLoading: false,
      }));

      // Listen for foreground messages
      onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
        
        // Show notification if app is in foreground
        if (payload.notification) {
          new Notification(payload.notification.title || 'HostelHQ', {
            body: payload.notification.body,
            icon: '/hostelhq-icon-new.png',
            badge: '/hostelhq-icon-new.png',
          });
        }
      });

      return token;
    } catch (error: any) {
      console.error('Error requesting notification permission:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to enable notifications',
      }));
      return null;
    }
  }, [state.isSupported, currentUserId]);

  // Save FCM token to Firestore
  const saveTokenToFirestore = async (userId: string, token: string) => {
    try {
      const tokenRef = doc(db, 'users', userId, 'fcmTokens', token);
      await setDoc(tokenRef, {
        token,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      }, { merge: true });

      console.log('FCM token saved to Firestore:', token);
    } catch (error) {
      console.error('Error saving FCM token to Firestore:', error);
      throw error;
    }
  };

  // Load existing token from Firestore
  useEffect(() => {
    const loadExistingToken = async () => {
      if (!currentUserId || !state.isSupported || state.permission !== 'granted') {
        return;
      }

      try {
        const messaging = await getMessagingInstance();
        if (!messaging) return;

        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) return;

        const token = await getToken(messaging, { vapidKey });
        
        if (token) {
          setState(prev => ({ ...prev, token }));
          
          // Update token in Firestore
          await saveTokenToFirestore(currentUserId, token);
        }
      } catch (error) {
        console.error('Error loading existing token:', error);
      }
    };

    loadExistingToken();
  }, [currentUserId, state.isSupported, state.permission]);

  return {
    ...state,
    requestPermission,
  };
};
