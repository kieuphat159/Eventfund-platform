import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  MapPin,
  Calendar,
  Camera,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { useAuth } from "../../contexts/AuthContext";
import {
  userService,
  UserProfile,
  UserStats,
} from "../../services/user.service";

export const Profile: React.FC = () => {
  const { user: authUser, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      if (!authUser?.walletAddress) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        const [profileData, statsData] = await Promise.all([
          userService.getProfile(),
          userService.getFullStats(authUser.walletAddress),
        ]);

        setProfile(profileData);
        setStats(statsData);
      } catch (error: any) {
        console.error("Failed to fetch profile data:", error?.message, error?.data);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [authUser]);

  const handleSave = async () => {
    if (!profile) return;

    try {
      setIsSaving(true);

      const updated = await userService.updateProfile({
        username: profile.username,
        bio: profile.bio,
        location: profile.location,
      });

      setProfile(updated);
      await refreshProfile();
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Save profile error:", error);
      alert("An error occurred while saving changes.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3">Loading live data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">My Profile</h1>
        <p className="text-slate-400">
          Manage profile information synced from the platform
        </p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center border-4 border-slate-800 shadow-xl overflow-hidden">
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-white" />
                )}
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 bg-slate-800 border-2 border-slate-900 rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors">
                <Camera className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="flex-1 w-full">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {profile?.username || "Anonymous User"}
                  </h2>
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-blue-400 bg-blue-500/10 px-3 py-1 rounded border border-blue-500/20">
                      {profile?.walletAddress?.slice(0, 6)}...
                      {profile?.walletAddress?.slice(-4)}
                    </code>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Events Created", value: stats?.eventsCreated ?? 0 },
                  { label: "Tickets Owned", value: stats?.ticketsOwned ?? 0 },
                  { label: "Investments", value: stats?.totalInvestments ?? "0 ETH" },
                  { label: "Member Since", value: stats?.memberSince ?? "N/A" },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="bg-slate-800/40 border border-slate-800/60 rounded-xl p-4"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold">
                      {s.label}
                    </p>
                    <p className="text-lg font-bold text-white">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Personal Information</CardTitle>
          <CardDescription>
            Update your off-chain information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-slate-300">Display Name</Label>
              <Input
                value={profile?.username || ""}
                onChange={(e) =>
                  setProfile((p) => (p ? { ...p, username: e.target.value } : null))
                }
                className="bg-slate-800/50 border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Email (Read-only)</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  value={profile?.email || "N/A"}
                  readOnly
                  className="pl-10 bg-slate-800/20 border-slate-800 text-slate-500"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Bio</Label>
            <Textarea
              value={profile?.bio || ""}
              onChange={(e) =>
                setProfile((p) => (p ? { ...p, bio: e.target.value } : null))
              }
              className="bg-slate-800/50 border-slate-700 text-white min-h-[100px]"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-slate-300">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  value={profile?.location || ""}
                  onChange={(e) =>
                    setProfile((p) =>
                      p ? { ...p, location: e.target.value } : null,
                    )
                  }
                  className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Member Since</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  value={stats?.memberSince || ""}
                  disabled
                  className="pl-10 bg-slate-800/20 border-slate-800 text-slate-500"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end space-x-4 pt-4">
        <Button variant="ghost" className="text-slate-400 hover:text-white">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Changes
        </Button>
      </div>
    </div>
  );
};