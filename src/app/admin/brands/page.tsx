"use client";

import {useEffect, useState} from "react";
import {Header} from "@/components/header";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table";
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {Loader2, PlusCircle, Upload, X} from "lucide-react";
import Image from "next/image";
import {db, auth} from "@/lib/firebase";
import {collection, addDoc, deleteDoc, doc, getDocs, onSnapshot, updateDoc} from "firebase/firestore";
import {uploadImage} from "@/lib/cloudinary";
import {useToast} from "@/hooks/use-toast";
import {onAuthStateChanged} from "firebase/auth";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {AlertTriangle} from "lucide-react";

type Brand = {
  id: string;
  name: string;
  logoUrl: string;
  createdAt: string;
};

export default function AdminBrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandLogo, setNewBrandLogo] = useState<File | null>(null);
  const [newBrandPreview, setNewBrandPreview] = useState<string | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const {toast} = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnapshot = await getDocs(collection(db, "users"));
        const adminDoc = userSnapshot.docs.find((doc) => doc.id === user.uid);
        setIsAdmin(adminDoc?.data().role === "admin");
      } else {
        setIsAdmin(false);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(collection(db, "brandPartners"), (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({id: docSnap.id, ...docSnap.data()} as Brand));
      setBrands(data);
      setLoading(false);
    });
    return () => unsub();
  }, [isAdmin]);

  const openDialog = (brand?: Brand) => {
    if (brand) {
      setEditingBrand(brand);
      setNewBrandName(brand.name);
      setNewBrandLogo(null);
      setNewBrandPreview(brand.logoUrl);
    } else {
      setEditingBrand(null);
      setNewBrandName("");
      setNewBrandLogo(null);
      setNewBrandPreview(null);
    }
    setIsDialogOpen(true);
  };

  const handleLogoChange = (event?: React.ChangeEvent<HTMLInputElement>) => {
    const file = event?.target.files?.[0] ?? null;
    setNewBrandLogo(file);
    if (file) {
      setNewBrandPreview(URL.createObjectURL(file));
    } else {
      setNewBrandPreview(editingBrand?.logoUrl ?? null);
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingBrand(null);
    setNewBrandName("");
    setNewBrandLogo(null);
    setNewBrandPreview(null);
  };

  const handleSaveBrand = async () => {
    if (!newBrandName || (!editingBrand && !newBrandLogo)) {
      toast({
        title: "Brand info missing",
        description: editingBrand ? "Provide a name." : "Provide both a name and a logo.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      let logoUrl = editingBrand?.logoUrl ?? "";
      if (newBrandLogo) {
        logoUrl = await uploadImage(newBrandLogo);
      }
      if (editingBrand) {
        await updateDoc(doc(db, "brandPartners", editingBrand.id), {
          name: newBrandName,
          logoUrl,
          updatedAt: new Date().toISOString(),
        });
        toast({title: "Brand updated"});
      } else {
        await addDoc(collection(db, "brandPartners"), {
          name: newBrandName,
          logoUrl,
          createdAt: new Date().toISOString(),
        });
        toast({title: "Brand added"});
      }
      closeDialog();
    } catch (error) {
      console.error(error);
      toast({title: "Failed to save brand", description: "Please try again.", variant: "destructive"});
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (brandId: string) => {
    if (!window.confirm("Delete this brand?")) return;
    try {
      await deleteDoc(doc(db, "brandPartners", brandId));
      toast({title: "Brand deleted"});
    } catch (error) {
      console.error(error);
      toast({title: "Failed to delete brand", variant: "destructive"});
    }
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center bg-gray-50/60 px-6">
          <Alert variant="destructive" className="max-w-lg">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access denied</AlertTitle>
            <AlertDescription>You must be an admin to manage partners.</AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-gray-50/60 p-4 md:p-8">
        <div className="container mx-auto space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold">Brand Partners</h1>
              <p className="text-sm text-muted-foreground">
                Manage the logos displayed on the marketing site.
              </p>
            </div>
            <Button onClick={() => openDialog()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add brand
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Current brands</CardTitle>
              <CardDescription>Logos go live as soon as you add them.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading brands…
                </div>
              ) : brands.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No partners yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Logo</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {brands.map((brand) => (
                      <TableRow key={brand.id}>
                        <TableCell>
                          <div className="relative h-12 w-28 overflow-hidden rounded-lg border bg-white">
                            <Image
                              src={brand.logoUrl}
                              alt={`${brand.name} logo`}
                              fill
                              sizes="112px"
                              className="object-contain p-1"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{brand.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {brand.createdAt ? new Date(brand.createdAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => openDialog(brand)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(brand.id)}>
                            <X className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          closeDialog();
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBrand ? "Edit partner" : "Add partner"}</DialogTitle>
            <DialogDescription>
              Upload a logo and give it a label for the marketing carousel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand name</Label>
              <Input
                id="brandName"
                placeholder="Frog.wigal"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brandLogo">Logo</Label>
              <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border/70 p-6 text-center">
                {newBrandPreview ? (
                  <div className="relative mx-auto h-20 w-48 overflow-hidden rounded-md bg-white">
                    <Image
                      src={newBrandPreview}
                      alt="Brand preview"
                      fill
                      sizes="192px"
                      className="object-contain p-2"
                    />
                  </div>
                ) : (
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                )}
                <div className="flex items-center justify-center gap-2">
                  <Input
                    id="brandLogo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <Button variant="outline" onClick={() => document.getElementById("brandLogo")?.click()}>
                    Choose file
                  </Button>
                  {newBrandPreview && (
                    <Button variant="ghost" size="icon" onClick={() => handleLogoChange()}>
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove image</span>
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">SVG or PNG, max 1MB.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveBrand} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingBrand ? "Save changes" : "Save brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

