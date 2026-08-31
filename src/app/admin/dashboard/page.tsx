"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DollarSign, BarChart, Users, CheckCircle, XCircle, Loader2, Trash2, Repeat,
  UserCheck, UserX, Wifi, Bed, Bath, Star, MessageSquare, FileText, Shield,
  Settings, Building, ShieldCheck, GraduationCap, Eye, ExternalLink, FileCheck,
  AlertCircle, Filter, Search, AlertTriangle, Clock, CheckCircle2, KeyRound,
  Copy, Check, Link2, UserPlus2, Sparkles, RefreshCw, Lock
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, Timestamp, getDocs, updateDoc, writeBatch, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ably } from '@/lib/ably';
import { Types } from 'ably';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RoomType, Review, StudentVerification } from '@/lib/data';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { notifyAdminsOfNewHostelSubmission, notifyCreatorOfHostelStatus } from '@/app/actions/sms';
import { getAdminPaystackBalance } from '@/app/actions/payouts';
import { saveHostelAction, fetchStudentVerificationsAction, updateStudentVerificationStatusAction } from '@/app/actions/db';
import {
  createStaffInviteAction,
  fetchStaffInvitesAction,
  revokeStaffInviteAction,
  type StaffInvite,
  type StaffRole,
  STAFF_ROLE_TITLES,
  STAFF_ROLE_DESCRIPTIONS,
} from '@/app/actions/staff-invite';

type Hostel = {
  id: string;
  name: string;
  agentId: string;
  location: string;
  price: number;
  availability: 'Available' | 'Limited' | 'Full';
  isFeatured?: boolean;
  [key: string]: any;
};

type PendingHostel = Omit<Hostel, 'availability'> & {
  dateSubmitted: string;
  roomTypes: RoomType[];
  submittedBy?: string;
  createdBy?: {
    userId: string;
    fullName: string;
    email: string;
    role: 'manager' | 'admin';
    createdAt: string;
  };
};

type User = {
  id: string;
  fullName: string;
  email: string;
  role: 'student' | 'admin' | 'hostel_manager' | 'manager' | 'dean' | 'hostel_coordinator' | 'pro_vc' | 'vc';
  phoneNumber?: string;
  studentIndexNumber?: string;
  faculty?: string;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  verificationDocUrl?: string;
  verificationDocType?: 'student_id' | 'admission_letter';
  verificationReviewedAt?: string;
  verificationReviewedBy?: string;
  verificationRejectionReason?: string;
  rejectionReason?: string;
  createdAt?: string;
  [key: string]: any;
}

const availabilityCycle: Record<Hostel['availability'], Hostel['availability']> = {
  'Available': 'Limited',
  'Limited': 'Full',
  'Full': 'Available',
};

const availabilityVariant: Record<Hostel['availability'], "default" | "secondary" | "destructive"> = {
  'Available': 'default',
  'Limited': 'secondary',
  'Full': 'destructive'
}


export default function AdminDashboard() {
  const [pendingHostels, setPendingHostels] = useState<PendingHostel[]>([]);
  const [approvedHostels, setApprovedHostels] = useState<Hostel[]>([]);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedHostel, setSelectedHostel] = useState<PendingHostel | null>(null);
  const [isHostelDialogOpen, setIsHostelDialogOpen] = useState(false);
  const [adminBalance, setAdminBalance] = useState<{ balance: number, currency: string } | null>(null);
  const { toast } = useToast();

  // Student Account Verifications State
  const [verifications, setVerifications] = useState<StudentVerification[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<StudentVerification | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [verifActionLoading, setVerifActionLoading] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [verificationSearch, setVerificationSearch] = useState('');

  // Router & Auth Guard
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Staff Invites Management State
  const [staffInvites, setStaffInvites] = useState<StaffInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [isStaffInviteDialogOpen, setIsStaffInviteDialogOpen] = useState(false);
  const [selectedStaffRole, setSelectedStaffRole] = useState<StaffRole>('dean');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [newlyCreatedInvite, setNewlyCreatedInvite] = useState<{ inviteUrl: string; tempEmail: string; role: StaffRole; roleTitle: string } | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [userManagementTab, setUserManagementTab] = useState<'users' | 'invites'>('users');

  // Admin Auth & Role Guard
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setAuthLoading(false);
        router.replace('/login');
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists() || snap.data()?.role !== 'admin') {
          toast({
            title: 'Access Denied',
            description: 'This console requires system administrator privileges.',
            variant: 'destructive',
          });
          router.replace('/');
          return;
        }
      } catch (err) {
        console.error('Admin auth verification error:', err);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubAuth();
  }, [router, toast]);

  // Load Staff Invites
  const loadStaffInvites = async () => {
    setLoadingInvites(true);
    try {
      const res = await fetchStaffInvitesAction();
      if (res.success && res.data) {
        setStaffInvites(res.data);
      }
    } catch (err) {
      console.error('Failed to load staff invites:', err);
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    loadStaffInvites();
  }, []);

  const handleGenerateStaffInvite = async () => {
    setGeneratingInvite(true);
    try {
      const adminName = auth.currentUser?.displayName || 'System Administrator';
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await createStaffInviteAction({
        role: selectedStaffRole,
        adminName,
        adminUid: auth.currentUser?.uid,
        baseUrl: origin,
      });

      if (res.success && res.data) {
        setNewlyCreatedInvite({
          inviteUrl: res.data.inviteUrl,
          tempEmail: res.data.tempEmail,
          role: res.data.role,
          roleTitle: res.data.roleTitle,
        });
        toast({
          title: 'Staff Invite Link Generated! 🔗',
          description: `Single-use link for ${res.data.roleTitle} is ready to copy and share.`,
        });
        loadStaffInvites();
      } else {
        toast({
          title: 'Generation Failed',
          description: res.error || 'Could not generate invite link.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleRevokeStaffInvite = async (token: string) => {
    try {
      const res = await revokeStaffInviteAction(token, auth.currentUser?.displayName || 'Administrator');
      if (res.success) {
        toast({
          title: 'Invite Revoked',
          description: 'This invitation link has been permanently invalidated.',
        });
        loadStaffInvites();
      } else {
        toast({
          title: 'Failed to Revoke',
          description: res.error || 'Could not revoke invitation.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(url);
      setCopiedTokenId(id);
      toast({
        title: 'Link Copied! 📋',
        description: 'Staff onboarding link copied to clipboard.',
      });
      setTimeout(() => setCopiedTokenId(null), 2500);
    }
  };

  useEffect(() => {
    // Real-time pending hostels
    const unsubPending = onSnapshot(collection(db, 'pendingHostels'), (snapshot) => {
      const hostelsData = snapshot.docs.map(doc => {
        const data = doc.data();
        const date = (data.dateSubmitted as Timestamp)?.toDate ? (data.dateSubmitted as Timestamp).toDate().toLocaleDateString() : new Date(data.dateSubmitted).toLocaleDateString();
        return {
          id: doc.id,
          name: data.name || 'No Name',
          submittedBy: data.submittedBy || data.managerName || 'Hostel Management',
          location: data.location || 'No Location',
          dateSubmitted: date,
          price: data.price || 0,
          description: data.description || 'No description provided.',
          images: data.images || [],
          amenities: data.amenities || [],
          roomTypes: [], // Will be fetched on review
        } as PendingHostel
      });
      setPendingHostels(hostelsData);
      setLoading(false);
    });

    // Real-time approved hostels
    const unsubApproved = onSnapshot(collection(db, 'hostels'), (snapshot) => {
      const hostelsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hostel));
      setApprovedHostels(hostelsData);
    });

    // Fetch all users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(usersData);
    });

    // Real-time pending reviews
    const reviewsQuery = query(collection(db, 'reviews'), where('status', '==', 'pending'));
    const unsubReviews = onSnapshot(reviewsQuery, (snapshot) => {
      const reviewsData = snapshot.docs.map(doc => {
        const data = doc.data();
        const date = (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toLocaleDateString() : new Date(data.createdAt).toLocaleDateString();
        return {
          id: doc.id,
          ...data,
          createdAt: date
        } as Review;
      });
      setPendingReviews(reviewsData);
    });

    // Fetch Admin Balance
    const fetchBalance = async () => {
      const res = await getAdminPaystackBalance();
      if (res.success) {
        setAdminBalance({ balance: res.balance, currency: res.currency });
      }
    };
    fetchBalance();

    // Fetch Student Verifications
    const loadVerifications = async () => {
      try {
        const res = await fetchStudentVerificationsAction();
        if (res.success && res.data) {
          setVerifications(res.data);
        }
      } catch (err) {
        console.error("Failed to load student verifications:", err);
      }
    };
    loadVerifications();

    return () => {
      unsubPending();
      unsubApproved();
      unsubUsers();
      unsubReviews();
    };
  }, []);

  const handleApprove = async (hostelId: string) => {
    setProcessingId(hostelId);
    toast({ title: "Approving Hostel..." });
    try {
      const pendingDocRef = doc(db, 'pendingHostels', hostelId);
      const batch = writeBatch(db);

      const pendingDocSnap = await getDoc(pendingDocRef);

      if (!pendingDocSnap.exists()) {
        toast({ title: "Error", description: "Hostel not found.", variant: "destructive" });
        return;
      }

      const hostelData = pendingDocSnap.data() as PendingHostel;
      const newHostelRef = doc(db, 'hostels', hostelId);

      // Create the approved hostel with creator tracking and status
      const approvedHostel = {
        ...hostelData,
        availability: 'Available' as const,
        status: 'live' as const,
        approvedAt: new Date().toISOString(),
        approvedBy: auth.currentUser?.uid || 'unknown',
      };
      await setDoc(newHostelRef, approvedHostel);

      // Copy roomTypes subcollection if it exists
      const pendingRoomsRef = collection(pendingDocRef, 'roomTypes');
      const pendingRoomsSnapshot = await getDocs(pendingRoomsRef);

      if (!pendingRoomsSnapshot.empty) {
        const batch = writeBatch(db);

        for (const roomDoc of pendingRoomsSnapshot.docs) {
          const roomData = roomDoc.data();
          const newRoomRef = doc(collection(newHostelRef, 'roomTypes'), roomDoc.id);
          batch.set(newRoomRef, roomData);
        }

        // Delete the original pending document (subcollections are NOT automatically deleted)
        batch.delete(pendingDocRef);

        // Commit the batch
        await batch.commit();
        console.log(`[Approval] Copied ${pendingRoomsSnapshot.size} physical rooms to approved hostel`);
      } else {
        // Delete the original pending document if no room types
        await deleteDoc(pendingDocRef);
      }

      // PRIMARY: Save approved hostel to DynamoDB
      try {
        const approvedRooms = pendingRoomsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        await saveHostelAction({
          ...approvedHostel,
          id: hostelId,
          roomTypes: approvedRooms,
        } as any, false);
        console.log(`[Approval] Saved approved hostel ${hostelId} to DynamoDB primary database`);
      } catch (dynamoErr) {
        console.warn(`[Approval] Could not save approved hostel to DynamoDB:`, dynamoErr);
      }

      // Send SMS notification to creator
      if (hostelData.createdBy) {
        const creatorUserRef = doc(db, 'users', hostelData.createdBy.userId);
        const creatorUserSnap = await getDoc(creatorUserRef);

        if (creatorUserSnap.exists()) {
          const creatorData = creatorUserSnap.data();
          if (creatorData.phone) {
            await notifyCreatorOfHostelStatus(
              hostelData.name,
              creatorData.phone,
              'approved'
            );
          }
        }
      }

      toast({ title: "Hostel Approved", description: `${hostelData.name} is now live.` });
      setIsHostelDialogOpen(false);
      setSelectedHostel(null);

    } catch (error) {
      console.error("Error approving hostel: ", error);
      toast({ title: "Approval Failed", description: "An error occurred.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };


  const handleReject = async (hostelId: string) => {
    setProcessingId(hostelId);
    toast({ title: "Rejecting Hostel..." });
    try {
      const pendingDocRef = doc(db, 'pendingHostels', hostelId);
      const pendingDocSnap = await getDoc(pendingDocRef);

      if (pendingDocSnap.exists()) {
        const hostelData = pendingDocSnap.data() as PendingHostel;

        // Send SMS notification to creator before deletion
        if (hostelData.createdBy) {
          const creatorUserRef = doc(db, 'users', hostelData.createdBy.userId);
          const creatorUserSnap = await getDoc(creatorUserRef);

          if (creatorUserSnap.exists()) {
            const creatorData = creatorUserSnap.data();
            if (creatorData.phone) {
              await notifyCreatorOfHostelStatus(
                hostelData.name,
                creatorData.phone,
                'rejected',
                'Your hostel submission did not meet our quality standards. Please review our guidelines and submit again.'
              );
            }
          }
        }
      }

      await deleteDoc(pendingDocRef);
      toast({ title: "Hostel Rejected", description: "The submission has been removed." });
      setIsHostelDialogOpen(false);
      setSelectedHostel(null);
    } catch (error) {
      console.error("Error rejecting hostel: ", error);
      toast({ title: "Rejection Failed", description: "An error occurred.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };


  const handleReviewAction = async (reviewId: string, action: 'approve' | 'reject') => {
    setProcessingId(reviewId);
    const reviewRef = doc(db, 'reviews', reviewId);

    try {
      if (action === 'approve') {
        await updateDoc(reviewRef, { status: 'approved' });
        toast({ title: "Review Approved", description: "The review is now public." });
      } else { // reject
        await deleteDoc(reviewRef);
        toast({ title: "Review Rejected", description: "The review has been deleted." });
      }
    } catch (error) {
      console.error(`Error ${action}ing review: `, error);
      toast({ title: "Action Failed", description: `Could not ${action} the review.`, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteApproved = async (hostelId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this hostel? This action cannot be undone.")) {
      return;
    }
    setProcessingId(hostelId);
    toast({ title: "Deleting Hostel..." });
    try {
      await deleteDoc(doc(db, 'hostels', hostelId));
      toast({ title: "Hostel Deleted", description: "The listing has been permanently removed." });
    } catch (error) {
      console.error("Error deleting hostel: ", error);
      toast({ title: "Deletion Failed", description: "An error occurred.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleAvailability = async (hostel: Hostel) => {
    setProcessingId(hostel.id);
    const newAvailability = availabilityCycle[hostel.availability || 'Full'];
    try {
      const hostelRef = doc(db, 'hostels', hostel.id);
      await updateDoc(hostelRef, { availability: newAvailability });
      toast({ title: "Status Updated", description: `${hostel.name} is now set to ${newAvailability}.` });
    } catch (error) {
      console.error("Error updating availability:", error);
      toast({ title: "Update Failed", description: "Could not update status.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  }

  const handleToggleFeatured = async (hostel: Hostel) => {
    setProcessingId(hostel.id);
    const newFeaturedState = !hostel.isFeatured;
    try {
      const hostelRef = doc(db, 'hostels', hostel.id);
      await updateDoc(hostelRef, { isFeatured: newFeaturedState });
      toast({ title: "Featured Status Updated", description: `${hostel.name} is ${newFeaturedState ? 'now featured' : 'no longer featured'}.` });
    } catch (error) {
      console.error("Error updating featured status:", error);
      toast({ title: "Update Failed", description: "Could not update featured status.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  }


  const toggleUserRole = async (user: User) => {
    const newRole = user.role === 'student' ? 'hostel_manager' : 'student';
    if (!confirm(`Are you sure you want to change ${user.fullName} 's role to ${newRole === 'hostel_manager' ? 'Hostel Manager' : 'Student'}?`)) return;

    setProcessingId(user.id);
    toast({ title: 'Updating user role...' });
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { role: newRole });
      toast({ title: 'Role Updated', description: `${user.fullName} is now a ${newRole === 'hostel_manager' ? 'Hostel Manager' : 'Student'}.` });
    } catch (error) {
      console.error("Error updating user role:", error);
      toast({ title: 'Update Failed', description: "Could not update user role.", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  }

  const handleDeleteUser = async (user: User) => {
    // Prevent deleting admin users
    if (user.role === 'admin') {
      toast({
        title: 'Cannot Delete Admin',
        description: 'Admin users cannot be deleted for security reasons.',
        variant: "destructive"
      });
      return;
    }

    // Confirmation dialog
    if (!window.confirm(
      `Are you sure you want to permanently delete ${user.fullName} (${user.email})?\n\n` +
      `This will remove the user from Firestore. This action cannot be undone.`
    )) {
      return;
    }

    setProcessingId(user.id);
    toast({ title: "Deleting User...", description: `Removing ${user.fullName} from the system.` });

    try {
      // Delete user from Firestore
      const userRef = doc(db, 'users', user.id);
      await deleteDoc(userRef);

      toast({
        title: "User Deleted",
        description: `${user.fullName} has been permanently removed from Firestore.`
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Deletion Failed",
        description: "Could not delete the user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
    }
  }


  const openHostelReviewDialog = async (hostel: PendingHostel) => {
    // Fetch full details including room types before opening dialog
    const pendingDocRef = doc(db, 'pendingHostels', hostel.id);
    const roomTypesRef = collection(pendingDocRef, 'roomTypes');

    const [hostelSnap, roomTypesSnap] = await Promise.all([
      getDoc(pendingDocRef),
      getDocs(roomTypesRef)
    ]);

    if (hostelSnap.exists()) {
      const fetchedRoomTypes = roomTypesSnap.docs.map(d => ({ ...d.data(), id: d.id })) as RoomType[];
      const fullHostelData = {
        ...hostelSnap.data(),
        id: hostelSnap.id,
        roomTypes: fetchedRoomTypes
      } as PendingHostel;

      setSelectedHostel(fullHostelData);
      setIsHostelDialogOpen(true);
    } else {
      toast({ title: "Error", description: "Could not fetch hostel details.", variant: 'destructive' });
    }
  }

  const students = users.filter(u => u.role === 'student');
  const managers = users.filter(u => u.role === 'hostel_manager' || u.role === 'manager');
  const admins = users.filter(u => u.role === 'admin');
  const institutionalStaff = users.filter(u => ['dean', 'hostel_coordinator', 'pro_vc', 'vc'].includes(u.role));
  const totalPending = pendingHostels.length + pendingReviews.length;

  // Combine DynamoDB verifications with Firestore student users
  const mergedVerifications = React.useMemo(() => {
    const list: StudentVerification[] = [...verifications];

    students.forEach((stu: any) => {
      const existingIdx = list.findIndex(
        v => v.userId === stu.id || (stu.studentIndexNumber && v.studentIdNumber === stu.studentIndexNumber)
      );
      if (existingIdx >= 0) {
        list[existingIdx] = {
          ...list[existingIdx],
          status: (stu.verificationStatus as any) || list[existingIdx].status,
          rejectionReason: stu.verificationRejectionReason || stu.rejectionReason || list[existingIdx].rejectionReason,
          admissionLetterUrl: stu.verificationDocType === 'admission_letter'
            ? stu.verificationDocUrl
            : (list[existingIdx].admissionLetterUrl || (stu.verificationDocUrl && !list[existingIdx].admissionLetterUrl ? stu.verificationDocUrl : undefined)),
          studentIdCardUrl: stu.verificationDocType === 'student_id'
            ? stu.verificationDocUrl
            : (list[existingIdx].studentIdCardUrl || undefined),
          phone: stu.phoneNumber || list[existingIdx].phone,
          fullName: stu.fullName || list[existingIdx].fullName,
        };
      } else if (stu.verificationStatus || stu.verificationDocUrl || stu.studentIndexNumber) {
        list.push({
          id: `stu_verif_${stu.id}`,
          userId: stu.id,
          fullName: stu.fullName || 'Student',
          email: stu.email || '',
          phone: stu.phoneNumber || '',
          studentIdNumber: stu.studentIndexNumber || 'N/A',
          institution: stu.faculty || 'USTED',
          admissionLetterUrl: stu.verificationDocType === 'admission_letter' ? stu.verificationDocUrl : undefined,
          studentIdCardUrl: stu.verificationDocType === 'student_id' ? stu.verificationDocUrl : (!stu.verificationDocType && stu.verificationDocUrl ? stu.verificationDocUrl : undefined),
          status: (stu.verificationStatus as any) || 'pending',
          rejectionReason: stu.verificationRejectionReason || stu.rejectionReason,
          submittedAt: stu.createdAt || new Date().toISOString(),
          reviewedAt: stu.verificationReviewedAt,
          reviewedBy: stu.verificationReviewedBy,
        });
      }
    });

    return list;
  }, [verifications, students]);

  const pendingVerificationsCount = mergedVerifications.filter(v => v.status === 'pending').length;
  const verifiedCount = mergedVerifications.filter(v => v.status === 'verified').length;
  const rejectedCount = mergedVerifications.filter(v => v.status === 'rejected').length;

  const filteredVerifications = mergedVerifications.filter((item) => {
    const matchesFilter = verificationFilter === 'all' || item.status === verificationFilter;
    const q = verificationSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.fullName.toLowerCase().includes(q) ||
      (item.email && item.email.toLowerCase().includes(q)) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.studentIdNumber && item.studentIdNumber.toLowerCase().includes(q)) ||
      (item.institution && item.institution.toLowerCase().includes(q));
    return matchesFilter && matchesSearch;
  });

  const handleVerifyStudent = async (verificationId: string, status: "verified" | "rejected", reason?: string) => {
    setVerifActionLoading(true);
    try {
      const adminName = auth.currentUser?.displayName || "HostelHQ Administration";
      const verif = mergedVerifications.find((v) => v.id === verificationId) || selectedVerification;
      const targetUserId = verif?.userId;
      const targetPhone = verif?.phone || (verif as any)?.phoneNumber;
      const targetName = verif?.fullName || (verif as any)?.studentName;

      const res = await updateStudentVerificationStatusAction(
        verificationId,
        status,
        reason,
        adminName,
        targetPhone,
        targetName
      );

      if (res.success) {
        // Sync Firestore user document
        if (targetUserId) {
          try {
            await updateDoc(doc(db, "users", targetUserId), {
              verificationStatus: status,
              verificationReviewedAt: new Date().toISOString(),
              verificationReviewedBy: adminName,
              ...(reason ? { verificationRejectionReason: reason, rejectionReason: reason } : { verificationRejectionReason: null, rejectionReason: null }),
            });
          } catch (fsErr) {
            console.warn("Could not sync verificationStatus to Firestore user:", fsErr);
          }
        }

        setVerifications((prev) => {
          const exists = prev.some(v => v.id === verificationId || (targetUserId && v.userId === targetUserId));
          if (exists) {
            return prev.map((v) =>
              v.id === verificationId || (targetUserId && v.userId === targetUserId)
                ? {
                    ...v,
                    status,
                    rejectionReason: reason,
                    reviewedAt: new Date().toISOString(),
                    reviewedBy: adminName,
                  }
                : v
            );
          } else if (verif) {
            return [
              ...prev,
              {
                ...verif,
                status,
                rejectionReason: reason,
                reviewedAt: new Date().toISOString(),
                reviewedBy: adminName,
              }
            ];
          }
          return prev;
        });

        toast({
          title: status === "verified" ? "Student Account Approved! 🎓" : "Verification Rejected",
          description: `${targetName || "Student"} credentials marked as ${status}. Notification SMS dispatched.`,
        });

        setSelectedVerification(null);
        setRejectDialogOpen(false);
        setRejectionReason("");
      } else {
        toast({
          title: "Action Failed",
          description: res.error || "Could not update verification status.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setVerifActionLoading(false);
    }
  };

  const userRoleData = [
    { role: 'Students', count: students.length },
    { role: 'Managers', count: managers.length },
    { role: 'Staff', count: institutionalStaff.length },
    { role: 'Admins', count: admins.length },
  ];

  const availabilityCounts: Record<Hostel['availability'], number> = {
    Available: 0,
    Limited: 0,
    Full: 0,
  };

  approvedHostels.forEach((hostel) => {
    const key = hostel.availability || 'Full';
    availabilityCounts[key] += 1;
  });

  const availabilityData = [
    { status: 'Available', value: availabilityCounts.Available },
    { status: 'Limited', value: availabilityCounts.Limited },
    { status: 'Full', value: availabilityCounts.Full },
  ].filter(item => item.value > 0);

  const AVAILABILITY_COLORS = ['#22c55e', '#f97316', '#ef4444'];

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 bg-gray-50/50 p-4 md:p-8">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
            <Link href="/admin/settings">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Admin Settings
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{students.length}</div>
                <p className="text-xs text-muted-foreground">Registered students</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Managers</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{managers.length}</div>
                <p className="text-xs text-muted-foreground">Registered managers</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Institutional Staff</CardTitle>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{institutionalStaff.length}</div>
                <p className="text-xs text-muted-foreground">Dean, Coord, Exec</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved Listings</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{approvedHostels.length}</div>
                <p className="text-xs text-muted-foreground">Live on the platform</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
                <Loader2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalPending}</div>
                <p className="text-xs text-muted-foreground">Hostels & Reviews</p>
              </CardContent>
            </Card>
            <Card className={cn(pendingVerificationsCount > 0 && "border-amber-500/50 bg-amber-50/20")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Student Verifications</CardTitle>
                <GraduationCap className={cn("h-4 w-4", pendingVerificationsCount > 0 ? "text-amber-600" : "text-muted-foreground")} />
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-bold">{pendingVerificationsCount}</div>
                  {pendingVerificationsCount > 0 && (
                    <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0">Needs Review</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{mergedVerifications.length} total submitted</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>User Roles Overview</CardTitle>
                <CardDescription>Distribution of users by role.</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {userRoleData.every(item => item.count === 0) ? (
                  <p className="text-sm text-muted-foreground">No users found yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart data={userRoleData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="role" tick={{ fontSize: 12 }} interval={0} />
                      <YAxis allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.15)' }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </ReBarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hostel Availability</CardTitle>
                <CardDescription>How many live hostels are in each status.</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {availabilityData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No approved hostels yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={availabilityData}
                        dataKey="value"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                        paddingAngle={2}
                      >
                        {availabilityData.map((entry, index) => (
                          <Cell key={entry.status} fill={AVAILABILITY_COLORS[index % AVAILABILITY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend verticalAlign="bottom" height={24} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Security & Management */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
            <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <DollarSign className="h-24 w-24 text-primary" />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-primary">Paystack Wallet</CardTitle>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center z-10">
                  <span className="font-bold text-primary text-xs">GH</span>
                </div>
              </CardHeader>
              <CardContent className="z-10 relative">
                <div className="text-2xl font-bold tracking-tight text-primary">
                  {adminBalance ? `GH₵ ${(adminBalance.balance / 100).toFixed(2)}` : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Live Balance (GHS)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Payouts</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Review and approve withdrawal requests from managers.
                </p>
                <Button asChild size="sm">
                  <Link href="/admin/payouts">
                    Manage Payouts
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">OTP Management</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  View, audit, and bulk delete OTP verification records stored in Firestore.
                </p>
                <Button asChild size="sm">
                  <Link href="/admin/otp-management">
                    Manage OTPs
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Flagged Reviews</CardTitle>
                <MessageSquare className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Review and moderate flagged reviews containing inappropriate content.
                </p>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm">
                    <Link href="/admin/reviews">
                      Manage Reviews
                    </Link>
                  </Button>
                  {pendingReviews.length > 0 && (
                    <Badge variant="destructive">{pendingReviews.length}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hostel Requests</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Review hostel submission requests from hostel managers.
                </p>
                <Button asChild size="sm">
                  <Link href="/admin/hostel-requests">
                    View Requests
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card className={cn(pendingVerificationsCount > 0 && "border-amber-500/30 bg-amber-50/10")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Student Verification</CardTitle>
                <FileCheck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Approve admission letters & student IDs for room booking privileges.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const el = document.getElementById('student-verifications-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Verify Students
                  </Button>
                  {pendingVerificationsCount > 0 && (
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-semibold">
                      {pendingVerificationsCount} pending
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Staff Invites</CardTitle>
                <KeyRound className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Generate 24h role-locked single-use links for Dean, Coord, and VC.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setUserManagementTab('invites');
                      const el = document.getElementById('user-management-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                      setIsStaffInviteDialogOpen(true);
                    }}
                    className="bg-primary text-white hover:bg-primary/90"
                  >
                    Create Invite
                  </Button>
                  {staffInvites.filter(i => !i.used && !i.revoked && new Date(i.expiresAt).getTime() > Date.now()).length > 0 && (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-semibold">
                      {staffInvites.filter(i => !i.used && !i.revoked && new Date(i.expiresAt).getTime() > Date.now()).length} active
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* STUDENT ACCOUNT VERIFICATION QUEUE */}
          <div id="student-verifications-section" className="mb-8">
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="border-b bg-slate-50/60 pb-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-primary" />
                      <CardTitle className="text-xl font-bold font-headline">
                        Student Account Verification Queue
                      </CardTitle>
                      {pendingVerificationsCount > 0 && (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-2">
                          {pendingVerificationsCount} Pending Approval
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs text-muted-foreground">
                      Inspect uploaded institutional credentials (Admission Letter or Student ID Card) to authorize student bookings and account verification.
                    </CardDescription>
                  </div>

                  {/* Filters & Search */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search student name, index no, email..."
                        value={verificationSearch}
                        onChange={(e) => setVerificationSearch(e.target.value)}
                        className="h-8 pl-8 text-xs w-full sm:w-64 bg-white"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg border text-xs">
                      <Button
                        size="sm"
                        variant={verificationFilter === 'all' ? 'default' : 'ghost'}
                        onClick={() => setVerificationFilter('all')}
                        className="h-7 text-xs px-2.5"
                      >
                        All ({mergedVerifications.length})
                      </Button>
                      <Button
                        size="sm"
                        variant={verificationFilter === 'pending' ? 'default' : 'ghost'}
                        onClick={() => setVerificationFilter('pending')}
                        className="h-7 text-xs px-2.5"
                      >
                        Pending ({pendingVerificationsCount})
                      </Button>
                      <Button
                        size="sm"
                        variant={verificationFilter === 'verified' ? 'default' : 'ghost'}
                        onClick={() => setVerificationFilter('verified')}
                        className="h-7 text-xs px-2.5"
                      >
                        Verified ({verifiedCount})
                      </Button>
                      <Button
                        size="sm"
                        variant={verificationFilter === 'rejected' ? 'default' : 'ghost'}
                        onClick={() => setVerificationFilter('rejected')}
                        className="h-7 text-xs px-2.5"
                      >
                        Rejected ({rejectedCount})
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {filteredVerifications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                    <UserCheck className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="font-semibold text-foreground">No student verifications found</p>
                    <p className="text-xs">
                      {verificationFilter === 'pending'
                        ? 'All student admission submissions have been processed!'
                        : 'No records match the current filter or search criteria.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-100/70">
                        <TableRow>
                          <TableHead className="w-56">Student Details</TableHead>
                          <TableHead className="w-48">Institution & Index No.</TableHead>
                          <TableHead>Admission Letter</TableHead>
                          <TableHead>Student ID Card</TableHead>
                          <TableHead className="w-36">Status</TableHead>
                          <TableHead className="text-right w-44">Verification Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredVerifications.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                    {item.fullName ? item.fullName.charAt(0).toUpperCase() : 'S'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-semibold text-foreground text-sm line-clamp-1">{item.fullName}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1">{item.email}</p>
                                  <p className="text-[11px] text-muted-foreground font-mono">{item.phone || 'No phone'}</p>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <p className="font-semibold text-foreground text-xs">{item.institution || 'AAMUSTED'}</p>
                              <Badge variant="outline" className="font-mono text-[11px] mt-1 bg-white">
                                {item.studentIdNumber || 'Index pending'}
                              </Badge>
                              {item.submittedAt && (
                                <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(item.submittedAt).toLocaleDateString()}
                                </div>
                              )}
                            </TableCell>

                            <TableCell>
                              {item.admissionLetterUrl ? (
                                <a
                                  href={item.admissionLetterUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-700 font-semibold hover:bg-blue-100 transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5" /> View Letter
                                  <ExternalLink className="h-3 w-3 opacity-60" />
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Not uploaded</span>
                              )}
                            </TableCell>

                            <TableCell>
                              {item.studentIdCardUrl ? (
                                <a
                                  href={item.studentIdCardUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 border border-purple-200 text-xs text-purple-700 font-semibold hover:bg-purple-100 transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5" /> View ID Card
                                  <ExternalLink className="h-3 w-3 opacity-60" />
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Not uploaded</span>
                              )}
                            </TableCell>

                            <TableCell>
                              {item.status === 'pending' && (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[11px] flex items-center gap-1 w-fit">
                                  <Clock className="h-3 w-3" /> Pending Review
                                </Badge>
                              )}
                              {item.status === 'verified' && (
                                <div className="space-y-0.5">
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[11px] flex items-center gap-1 w-fit">
                                    <CheckCircle2 className="h-3 w-3" /> Approved
                                  </Badge>
                                  {item.reviewedBy && (
                                    <p className="text-[10px] text-muted-foreground">
                                      By {item.reviewedBy.split(' ')[0]}
                                    </p>
                                  )}
                                </div>
                              )}
                              {item.status === 'rejected' && (
                                <div className="space-y-1">
                                  <Badge variant="destructive" className="text-[11px] flex items-center gap-1 w-fit">
                                    <XCircle className="h-3 w-3" /> Rejected
                                  </Badge>
                                  {item.rejectionReason && (
                                    <p className="text-[10px] text-red-600 line-clamp-1 max-w-[130px]" title={item.rejectionReason}>
                                      "{item.rejectionReason}"
                                    </p>
                                  )}
                                </div>
                              )}
                            </TableCell>

                            <TableCell className="text-right">
                              {item.status === 'pending' ? (
                                <div className="flex justify-end items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => handleVerifyStudent(item.id, 'verified')}
                                    disabled={verifActionLoading}
                                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1"
                                  >
                                    <CheckCircle className="h-3.5 w-3.5" /> Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedVerification(item);
                                      setRejectDialogOpen(true);
                                    }}
                                    disabled={verifActionLoading}
                                    className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                  >
                                    Reject
                                  </Button>
                                </div>
                              ) : item.status === 'rejected' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleVerifyStudent(item.id, 'verified')}
                                  disabled={verifActionLoading}
                                  className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                >
                                  Re-Approve
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedVerification(item);
                                    setRejectDialogOpen(true);
                                  }}
                                  disabled={verifActionLoading}
                                  className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                >
                                  Revoke
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Pending Hostel Approvals</CardTitle>
                <CardDescription>Review and approve or reject new hostel listings.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="ml-4 text-muted-foreground">Loading pending hostels...</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hostel Name</TableHead>
                        <TableHead>Submitted By</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingHostels.length > 0 ? (
                        pendingHostels.map(hostel => (
                          <TableRow key={hostel.id}>
                            <TableCell className="font-medium">{hostel.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {(hostel.createdBy?.fullName && !hostel.createdBy.fullName.toLowerCase().includes('unknown')) ? hostel.createdBy.fullName.charAt(0) : 'V'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">
                                    {(hostel.createdBy?.fullName && !hostel.createdBy.fullName.toLowerCase().includes('unknown')) ? hostel.createdBy.fullName : 'Verified Hall Management'}
                                  </p>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {(hostel.createdBy?.role && hostel.createdBy.role !== 'unknown') ? hostel.createdBy.role : 'Property Manager'}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{hostel.dateSubmitted}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => openHostelReviewDialog(hostel)}>Review</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center h-24">
                            No pending hostels.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-8 lg:grid-cols-2 mb-8">

            <Card>
              <CardHeader>
                <CardTitle>Live Hostel Listings</CardTitle>
                <CardDescription>Manage approved hostels and their availability.</CardDescription>
              </CardHeader>
              <CardContent className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hostel Name</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedHostels.length > 0 ? (
                      approvedHostels.map(hostel => (
                        <TableRow key={hostel.id}>
                          <TableCell className="font-medium">{hostel.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {(hostel.createdBy?.fullName && !hostel.createdBy.fullName.toLowerCase().includes('unknown')) ? hostel.createdBy.fullName.charAt(0) : 'V'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">
                                  {(hostel.createdBy?.fullName && !hostel.createdBy.fullName.toLowerCase().includes('unknown')) ? hostel.createdBy.fullName : 'Verified Hall Management'}
                                </p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {(hostel.createdBy?.role && hostel.createdBy.role !== 'unknown') ? hostel.createdBy.role : 'Property Manager'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={availabilityVariant[hostel.availability || 'Full']}>
                              {hostel.availability || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleToggleFeatured(hostel)}
                              disabled={processingId === hostel.id}
                              title={hostel.isFeatured ? "Remove from featured" : "Mark as featured"}
                            >
                              {processingId === hostel.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                <Star className={cn("h-4 w-4", hostel.isFeatured ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground")} />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleToggleAvailability(hostel)}
                              disabled={processingId === hostel.id}
                              title="Cycle availability status"
                            >
                              {processingId === hostel.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteApproved(hostel.id)}
                              disabled={processingId === hostel.id}
                              title="Delete hostel"
                            >
                              {processingId === hostel.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center h-24">
                          No approved hostels.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>


            <Card id="user-management-section">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      User Management & Staff Access
                    </CardTitle>
                    <CardDescription>
                      Manage registered platform users or generate single-use, role-locked staff invite links.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setNewlyCreatedInvite(null);
                      setIsStaffInviteDialogOpen(true);
                    }}
                    className="bg-primary text-white hover:bg-primary/90 gap-1.5 shadow-sm text-xs"
                  >
                    <KeyRound className="h-4 w-4" />
                    Generate Staff Invite Link
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Section Toggle */}
                <div className="flex items-center gap-2 border-b border-border/60 pb-3 mb-4">
                  <Button
                    variant={userManagementTab === 'users' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUserManagementTab('users')}
                    className="text-xs h-8"
                  >
                    Registered Users ({users.length})
                  </Button>
                  <Button
                    variant={userManagementTab === 'invites' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setUserManagementTab('invites');
                      loadStaffInvites();
                    }}
                    className="text-xs h-8 gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Staff Access Invites
                    {staffInvites.filter(i => !i.used && !i.revoked && new Date(i.expiresAt).getTime() > Date.now()).length > 0 && (
                      <Badge className="ml-1 bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                        {staffInvites.filter(i => !i.used && !i.revoked && new Date(i.expiresAt).getTime() > Date.now()).length} active
                      </Badge>
                    )}
                  </Button>
                  {userManagementTab === 'invites' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 ml-auto"
                      onClick={loadStaffInvites}
                      disabled={loadingInvites}
                      title="Refresh invites list"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", loadingInvites && "animate-spin text-primary")} />
                    </Button>
                  )}
                </div>

                {userManagementTab === 'users' ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.length > 0 ? (
                        [
                          { label: 'Admins', items: admins },
                          { label: 'Managers', items: managers },
                          { label: 'Institutional Staff', items: institutionalStaff },
                          { label: 'Students', items: students },
                        ].map(group =>
                          group.items.length > 0 ? (
                            <React.Fragment key={`group-${group.label}`}>
                              <TableRow>
                                <TableCell colSpan={4} className="bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {group.label}
                                </TableCell>
                              </TableRow>
                              {group.items.map(user => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.fullName}</TableCell>
                                  <TableCell>{user.email}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="capitalize">
                                      {user.role}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleUserRole(user)}
                                        disabled={processingId === user.id || user.role === 'admin'}
                                        title={`Toggle ${user.role === 'student' ? 'Hostel Manager' : 'Student'}`}
                                      >
                                        {processingId === user.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : user.role === 'student' ? (
                                          <UserCheck className="h-4 w-4 text-blue-500" />
                                        ) : (
                                          <UserX className="h-4 w-4 text-orange-500" />
                                        )}
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleDeleteUser(user)}
                                        disabled={processingId === user.id || user.role === 'admin'}
                                        title="Delete user"
                                      >
                                        {processingId === user.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          ) : null
                        )
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center h-24">
                            No users found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <div>
                    {loadingInvites ? (
                      <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground text-sm">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading staff invitation records...
                      </div>
                    ) : staffInvites.length === 0 ? (
                      <div className="text-center py-10 border border-dashed rounded-lg bg-slate-50/50">
                        <KeyRound className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                        <h4 className="font-semibold text-slate-800 text-sm">No Staff Invites Generated Yet</h4>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                          Click "Generate Staff Invite Link" above to provision a 24-hour single-use onboarding URL for university officials.
                        </p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Target Role</TableHead>
                            <TableHead>Tracking Identifier</TableHead>
                            <TableHead>Status & Validity</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {staffInvites.map((invite) => {
                            const isExpired = new Date(invite.expiresAt).getTime() <= Date.now();
                            const isActive = !invite.used && !invite.revoked && !isExpired;
                            const hoursRemaining = Math.max(0, Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)));
                            const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/staff-access/${invite.token}` : `/staff-access/${invite.token}`;

                            return (
                              <TableRow key={invite.id}>
                                <TableCell>
                                  <div className="space-y-0.5">
                                    <Badge
                                      variant={
                                        invite.role === 'admin'
                                          ? 'default'
                                          : invite.role === 'dean'
                                          ? 'secondary'
                                          : 'outline'
                                      }
                                      className="font-medium capitalize text-xs"
                                    >
                                      {invite.roleTitle || STAFF_ROLE_TITLES[invite.role] || invite.role}
                                    </Badge>
                                    <p className="text-[11px] text-muted-foreground">
                                      By: {invite.createdBy || 'Admin'}
                                    </p>
                                  </div>
                                </TableCell>

                                <TableCell>
                                  <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                                    {invite.tempEmail}
                                  </code>
                                </TableCell>

                                <TableCell>
                                  {invite.revoked ? (
                                    <Badge variant="destructive" className="text-[11px]">Revoked</Badge>
                                  ) : invite.used ? (
                                    <div className="space-y-0.5">
                                      <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[11px]">
                                        Account Created
                                      </Badge>
                                      {invite.registeredEmail && (
                                        <p className="text-[11px] text-muted-foreground">
                                          {invite.registeredEmail}
                                        </p>
                                      )}
                                    </div>
                                  ) : isExpired ? (
                                    <Badge variant="secondary" className="text-[11px] text-muted-foreground">
                                      Expired (24h)
                                    </Badge>
                                  ) : (
                                    <div className="space-y-0.5">
                                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px]">
                                        Active
                                      </Badge>
                                      <p className="text-[11px] text-emerald-700 font-medium">
                                        Expires in ~{hoursRemaining}h
                                      </p>
                                    </div>
                                  )}
                                </TableCell>

                                <TableCell className="text-xs text-muted-foreground">
                                  {invite.createdAt ? format(new Date(invite.createdAt), 'MMM d, h:mm a') : 'N/A'}
                                </TableCell>

                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {isActive && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 text-xs gap-1"
                                          onClick={() => handleCopyLink(inviteUrl, invite.id)}
                                        >
                                          {copiedTokenId === invite.id ? (
                                            <>
                                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                                              Copied
                                            </>
                                          ) : (
                                            <>
                                              <Copy className="h-3.5 w-3.5" />
                                              Copy Link
                                            </>
                                          )}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                          onClick={() => handleRevokeStaffInvite(invite.token)}
                                          title="Revoke this invite immediately"
                                        >
                                          Revoke
                                        </Button>
                                      </>
                                    )}
                                    {!isActive && (
                                      <span className="text-xs text-muted-foreground italic">Closed</span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </main>

      {selectedHostel && (
        <Dialog open={isHostelDialogOpen} onOpenChange={setIsHostelDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">Review: {selectedHostel.name}</DialogTitle>
              <DialogDescription>
                Location: {selectedHostel.location} {selectedHostel.submittedBy ? `| Submitted by: ${selectedHostel.submittedBy}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Images</h3>
                <Carousel className="w-full">
                  <CarouselContent>
                    {selectedHostel.images.map((img, index) => (
                      <CarouselItem key={index}>
                        <div className="relative h-64 w-full rounded-md overflow-hidden">
                          <Image
                            src={img}
                            alt={`Hostel image ${index + 1}`}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 70vw, 50vw"
                            style={{ objectFit: 'cover' }}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-4" />
                  <CarouselNext className="right-4" />
                </Carousel>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Room Types</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room Name</TableHead>
                      <TableHead>Price/Year</TableHead>

                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedHostel.roomTypes.map((room) => (
                      <TableRow key={room.id}>
                        <TableCell className="font-medium">{room.name}</TableCell>
                        <TableCell>GH₵{room.price.toLocaleString()}</TableCell>

                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {(selectedHostel.amenities as string[]).map(amenity => (
                      <Badge key={amenity} variant="secondary">{amenity}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Description</h3>
                <p className="text-sm text-foreground/80 bg-muted/50 p-3 rounded-md">{selectedHostel.description}</p>
              </div>

            </div>
            <DialogFooter className="pt-4 border-t">
              <Button
                variant="destructive"
                onClick={() => handleReject(selectedHostel.id)}
                disabled={processingId === selectedHostel.id}
              >
                {processingId === selectedHostel.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <XCircle className="h-5 w-5" />}
                <span className="ml-2">Reject</span>
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleApprove(selectedHostel.id)}
                disabled={processingId === selectedHostel.id}
              >
                {processingId === selectedHostel.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
                <span className="ml-2">Approve</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* REJECT STUDENT VERIFICATION DIALOG */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-1">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold">Reject Student Credentials</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Please specify the reason why <span className="font-semibold text-foreground">{selectedVerification?.fullName || "this student"}</span>'s admission credentials could not be approved. An automated SMS notification will be dispatched to their phone immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <label className="text-xs font-semibold text-foreground">Common Reasons (click to select):</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Document is blurred or unreadable",
                "Index number does not match university records",
                "Expired or invalid student identification card",
                "Uploaded file is not an official admission letter",
                "Name on document does not match account name"
              ].map((reason) => (
                <Badge
                  key={reason}
                  variant="outline"
                  className="cursor-pointer hover:bg-slate-100 text-[11px] py-1 transition-colors"
                  onClick={() => setRejectionReason(reason)}
                >
                  {reason}
                </Badge>
              ))}
            </div>

            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-semibold text-foreground">Detailed Reason / Note:</label>
              <Textarea
                placeholder="Type or edit the reason sent to the student..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="text-xs min-h-[85px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRejectDialogOpen(false);
                setSelectedVerification(null);
                setRejectionReason("");
              }}
              disabled={verifActionLoading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (selectedVerification) {
                  handleVerifyStudent(
                    selectedVerification.id,
                    'rejected',
                    rejectionReason || "Credentials could not be verified against the university registry."
                  );
                }
              }}
              disabled={verifActionLoading}
              className="text-xs font-semibold"
            >
              {verifActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STAFF ACCESS INVITATION GENERATOR DIALOG */}
      <Dialog open={isStaffInviteDialogOpen} onOpenChange={setIsStaffInviteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold font-headline">
                  Generate Staff Invite Link
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Creates a secure, single-use onboarding URL valid strictly for 24 hours.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {newlyCreatedInvite ? (
            <div className="space-y-4 py-3">
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">Invitation Link Ready to Dispatch</h4>
                  <p className="text-xs text-emerald-800">
                    The role is securely pre-locked to <strong>{newlyCreatedInvite.roleTitle}</strong>. Send this link to the university official.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Onboarding Link (Single-Use, 24h Expiry)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={newlyCreatedInvite.inviteUrl}
                    className="font-mono text-xs bg-slate-50 selection:bg-primary/20"
                  />
                  <Button
                    size="sm"
                    className="gap-1 text-xs shrink-0"
                    onClick={() => handleCopyLink(newlyCreatedInvite.inviteUrl, 'modal')}
                  >
                    {copiedTokenId === 'modal' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-300" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Link
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200 text-xs space-y-1.5 text-slate-600">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">Internal Tracking Label:</span>
                  <span className="font-medium text-slate-800">{newlyCreatedInvite.tempEmail}</span>
                </div>
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">Single-Use Security:</span>
                  <span className="font-medium text-emerald-700">Burns immediately upon signup</span>
                </div>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewlyCreatedInvite(null);
                  }}
                  className="text-xs"
                >
                  Generate Another
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsStaffInviteDialogOpen(false)}
                  className="text-xs"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label htmlFor="staff-role-select" className="text-xs font-semibold text-slate-700">
                  Select Administrative Target Role
                </Label>
                <Select
                  value={selectedStaffRole}
                  onValueChange={(val) => setSelectedStaffRole(val as StaffRole)}
                >
                  <SelectTrigger id="staff-role-select" className="text-sm">
                    <SelectValue placeholder="Choose administrative role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dean">
                      <div className="font-medium">Dean of Students</div>
                    </SelectItem>
                    <SelectItem value="hostel_coordinator">
                      <div className="font-medium">University Hostel Coordinator</div>
                    </SelectItem>
                    <SelectItem value="pro_vc">
                      <div className="font-medium">Pro-Vice-Chancellor</div>
                    </SelectItem>
                    <SelectItem value="vc">
                      <div className="font-medium">Vice-Chancellor</div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="font-medium">System Administrator</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic Role Description */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-xs space-y-1.5">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {STAFF_ROLE_TITLES[selectedStaffRole]}
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {STAFF_ROLE_DESCRIPTIONS[selectedStaffRole]}
                </p>
              </div>

              {/* Security Protocol Notice */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-md text-xs text-blue-900 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Zero-Email Input:</strong> No email is required from the administrator. The system automatically provisions an unguessable token. The recipient sets up their permanent university email and password upon opening the link.
                </div>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsStaffInviteDialogOpen(false)}
                  disabled={generatingInvite}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerateStaffInvite}
                  disabled={generatingInvite}
                  className="text-xs font-semibold gap-1.5"
                >
                  {generatingInvite ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Generate 24h Invite Link
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
