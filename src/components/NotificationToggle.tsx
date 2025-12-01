"use client";

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/hooks/use-toast';

export function NotificationToggle() {
  const { isSupported, permission, isLoading, requestPermission } = usePushNotifications();
  const { toast } = useToast();

  const handleToggle = async () => {
    if (permission === 'granted') {
      toast({
        title: 'Notifications Enabled',
        description: 'You can disable notifications in your browser settings.',
      });
      return;
    }

    try {
      const token = await requestPermission();
      if (token) {
        toast({
          title: 'Notifications Enabled!',
          description: 'You will now receive push notifications for bookings, reviews, and updates.',
        });
      }
    } catch (error) {
      toast({
        title: 'Failed to Enable Notifications',
        description: 'Please check your browser settings and try again.',
        variant: 'destructive',
      });
    }
  };

  if (!isSupported) {
    return null; // Don't show if not supported
  }

  return (
    <Button
      variant={permission === 'granted' ? 'default' : 'outline'}
      size="sm"
      onClick={handleToggle}
      disabled={isLoading}
      className="w-full justify-start"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : permission === 'granted' ? (
        <Bell className="h-4 w-4 mr-2" />
      ) : (
        <BellOff className="h-4 w-4 mr-2" />
      )}
      {permission === 'granted' ? 'Notifications On' : 'Enable Notifications'}
    </Button>
  );
}
