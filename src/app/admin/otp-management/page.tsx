"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc, writeBatch, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OTPRecord {
  id: string;
  phoneNumber: string;
  otp: string;
  createdAt: any;
  expiresAt: any;
  verified?: boolean;
}

export default function OTPManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [otpRecords, setOtpRecords] = useState<OTPRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk'>('single');
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  // Load OTP records
  const loadOTPRecords = async () => {
    setIsLoading(true);
    try {
      const otpQuery = query(collection(db, 'otpVerifications'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(otpQuery);
      
      const records: OTPRecord[] = [];
      snapshot.forEach((doc) => {
        records.push({
          id: doc.id,
          ...doc.data(),
        } as OTPRecord);
      });
      
      setOtpRecords(records);
      toast({
        title: 'OTP Records Loaded',
        description: `Found ${records.length} OTP record(s)`,
      });
    } catch (error: any) {
      console.error('Error loading OTP records:', error);
      toast({
        title: 'Error',
        description: 'Failed to load OTP records',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOTPRecords();
  }, []);

  // Toggle individual record selection
  const toggleRecordSelection = (id: string) => {
    const newSelection = new Set(selectedRecords);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRecords(newSelection);
  };

  // Toggle all records selection
  const toggleAllRecords = () => {
    if (selectedRecords.size === otpRecords.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(otpRecords.map(r => r.id)));
    }
  };

  // Delete single record
  const handleDeleteSingle = async (id: string) => {
    setSingleDeleteId(id);
    setDeleteTarget('single');
    setShowDeleteDialog(true);
  };

  // Delete selected records (bulk)
  const handleDeleteBulk = () => {
    if (selectedRecords.size === 0) {
      toast({
        title: 'No Records Selected',
        description: 'Please select at least one record to delete',
        variant: 'destructive',
      });
      return;
    }
    setDeleteTarget('bulk');
    setShowDeleteDialog(true);
  };

  // Confirm deletion
  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteTarget === 'single' && singleDeleteId) {
        // Delete single record
        await deleteDoc(doc(db, 'otpVerifications', singleDeleteId));
        
        setOtpRecords(prev => prev.filter(r => r.id !== singleDeleteId));
        
        toast({
          title: 'Record Deleted',
          description: 'OTP record has been deleted successfully',
        });
      } else if (deleteTarget === 'bulk') {
        // Bulk delete using batch
        const batch = writeBatch(db);
        
        selectedRecords.forEach(id => {
          batch.delete(doc(db, 'otpVerifications', id));
        });
        
        await batch.commit();
        
        setOtpRecords(prev => prev.filter(r => !selectedRecords.has(r.id)));
        setSelectedRecords(new Set());
        
        toast({
          title: 'Records Deleted',
          description: `${selectedRecords.size} OTP record(s) have been deleted successfully`,
        });
      }
    } catch (error: any) {
      console.error('Error deleting OTP records:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete OTP record(s)',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setSingleDeleteId(null);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  // Check if expired
  const isExpired = (expiresAt: any) => {
    if (!expiresAt) return false;
    try {
      const expiry = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
      return expiry < new Date();
    } catch {
      return false;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">OTP Management</CardTitle>
          <CardDescription>
            View and manage all OTP verification records stored in Firestore
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={loadOTPRecords}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
            
            <Button
              onClick={handleDeleteBulk}
              disabled={selectedRecords.size === 0 || isDeleting}
              variant="destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected ({selectedRecords.size})
            </Button>
          </div>

          {/* OTP Records Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : otpRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No OTP records found</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedRecords.size === otpRecords.length && otpRecords.length > 0}
                        onCheckedChange={toggleAllRecords}
                      />
                    </TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>OTP Code</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Expires At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otpRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRecords.has(record.id)}
                          onCheckedChange={() => toggleRecordSelection(record.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{record.phoneNumber}</TableCell>
                      <TableCell className="font-mono font-bold">{record.otp}</TableCell>
                      <TableCell className="text-sm">{formatTimestamp(record.createdAt)}</TableCell>
                      <TableCell className="text-sm">{formatTimestamp(record.expiresAt)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          record.verified 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : isExpired(record.expiresAt)
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {record.verified ? 'Verified' : isExpired(record.expiresAt) ? 'Expired' : 'Pending'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => handleDeleteSingle(record.id)}
                          variant="ghost"
                          size="sm"
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Summary */}
          {otpRecords.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Total: {otpRecords.length} record(s) | 
              Verified: {otpRecords.filter(r => r.verified).length} | 
              Expired: {otpRecords.filter(r => isExpired(r.expiresAt)).length} | 
              Pending: {otpRecords.filter(r => !r.verified && !isExpired(r.expiresAt)).length}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget === 'single' 
                ? 'This will permanently delete this OTP record from Firestore. This action cannot be undone.'
                : `This will permanently delete ${selectedRecords.size} OTP record(s) from Firestore. This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
