import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/providers/AuthContext';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { Avatar } from '@/components/ui/Avatar';
import { Upload, X } from 'lucide-react';
import type { Freelancer } from '@/types';

type EditableProfile = Partial<Omit<Freelancer, 'id' | 'verified' | 'rating' | 'reviewCount' | 'responseTimeMinutes' | 'reviews'>> & { approved?: boolean };

export const FreelancerProfilePage: React.FC = () => {
  const { currentUser, isAuthLoading } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [bio, setBio] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [rateMin, setRateMin] = useState<number | ''>('');
  const [rateMax, setRateMax] = useState<number | ''>('');
  const [currency, setCurrency] = useState('USD');
  const [availability, setAvailability] = useState<Freelancer['availability']>('now');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  // Avatar Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      navigate('/for-freelancers');
      return;
    }

    if (currentUser) {
      const fetchProfile = async () => {
        try {
          const docRef = doc(db, 'freelancerProfiles', currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data() as EditableProfile;
            setProfile(data);
            setName(data.name || '');
            setRole(data.role || '');
            setBio(data.bio || '');
            setPortfolioUrl(data.portfolioUrl || '');
            setTimezone(data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
            setRateMin(data.rateMin || '');
            setRateMax(data.rateMax || '');
            setCurrency(data.currency || 'USD');
            setAvailability(data.availability || 'now');
            setSkills(data.skills || []);
            setAvatarUrl(data.avatarUrl);
          }
        } catch (err) {
          console.error(err);
          setError("Failed to load profile.");
        } finally {
          setIsLoading(false);
        }
      };
      fetchProfile();
    }
  }, [currentUser, isAuthLoading, navigate]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError("Please upload a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB
      setUploadError("Image must be smaller than 5MB.");
      return;
    }

    try {
      const storageRef = ref(storage, `avatars/${currentUser!.uid}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setAvatarUrl(url);
    } catch (err) {
      console.error("Upload error", err);
      setUploadError("Failed to upload image. Please try again.");
    }
  };

  const handleAddSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = skillInput.trim();
      if (val && !skills.includes(val)) {
        setSkills([...skills, val]);
      }
      setSkillInput('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    if (portfolioUrl && !portfolioUrl.startsWith('http')) {
      setError("Please enter a valid portfolio URL starting with http:// or https://");
      setIsSaving(false);
      return;
    }

    try {
      const docRef = doc(db, 'freelancerProfiles', currentUser.uid);
      
      const payload = {
        name,
        role,
        bio,
        portfolioUrl,
        timezone,
        rateMin: Number(rateMin),
        rateMax: Number(rateMax),
        currency,
        availability,
        skills,
        avatarUrl: avatarUrl || undefined,
        verified: false,
        approved: false, // Editing always resets to pending
        updatedAt: serverTimestamp(),
      };

      if (!profile) {
        // Initial creation
        Object.assign(payload, { createdAt: serverTimestamp() });
      }

      await setDoc(docRef, payload, { merge: true });
      
      setSuccess("Profile saved and is pending review.");
      
      // Update local state to reflect pending
      setProfile(prev => ({ ...prev, ...payload }));
      
    } catch (err) {
      console.error(err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return <div className="p-32 flex justify-center"><div className="text-text-dim text-body">Loading profile...</div></div>;
  }

  const commonInputClass = "w-full min-h-[40px] bg-bg border border-border rounded-sm px-12 py-8 text-body text-text placeholder:text-text-mute focus:outline-none focus-visible:ring-1 focus-visible:ring-accent transition-colors";

  return (
    <div className="max-w-[800px] mx-auto px-24 py-48">
      <div className="flex items-center justify-between mb-32">
        <h1 className="text-[28px] font-semibold text-text">Your Profile</h1>
        {profile && (
          <div className="flex items-center gap-8">
            <span className="text-micro-label text-text-mute uppercase tracking-[0.05em]">Status:</span>
            {profile.approved ? (
              <span className="inline-flex items-center justify-center rounded-sm bg-surface-3 text-text text-11 font-medium leading-none px-8 py-4">Live</span>
            ) : (
              <span className="inline-flex items-center justify-center rounded-sm bg-surface-2 border border-border text-text-dim text-11 font-medium leading-none px-8 py-4">Pending Review</span>
            )}
          </div>
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg p-32">
        {error && (
          <div className="mb-24 p-12 bg-surface-2 border border-border text-meta text-text rounded-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-24 p-12 bg-surface-3 border border-border text-meta text-text rounded-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-32">
          
          {/* Avatar */}
          <section className="flex items-start gap-24">
            <Avatar src={avatarUrl} name={name || 'User'} size="lg" />
            <div className="flex flex-col gap-8">
              <span className="text-body font-medium text-text">Profile Picture</span>
              <span className="text-meta text-text-dim">Max 5MB. JPG, PNG, or WebP.</span>
              <div className="flex items-center gap-12 mt-4">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-8"
                >
                  <Upload className="w-16 h-16" />
                  Upload Image
                </Button>
                {avatarUrl && (
                  <button 
                    type="button" 
                    onClick={() => setAvatarUrl(undefined)}
                    className="text-meta text-text-dim hover:text-text transition-colors"
                  >
                    Remove
                  </button>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleAvatarUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              {uploadError && <div className="text-meta text-meta text-text mt-4">{uploadError}</div>}
            </div>
          </section>

          <hr className="border-border" />

          {/* Basic Info */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-24">
            <div className="flex flex-col gap-8">
              <label className="text-micro-label text-text-mute uppercase tracking-[0.05em]" htmlFor="name">Full Name *</label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} required placeholder="Jane Doe" />
            </div>
            <div className="flex flex-col gap-8">
              <label className="text-micro-label text-text-mute uppercase tracking-[0.05em]" htmlFor="role">Professional Title *</label>
              <Input id="role" value={role} onChange={e => setRole(e.target.value)} required placeholder="Senior Frontend Engineer" />
            </div>
          </section>

          {/* Skills */}
          <section className="flex flex-col gap-8">
            <label className="text-micro-label text-text-mute uppercase tracking-[0.05em]">Skills</label>
            <div className="flex flex-wrap gap-8 p-12 border border-border rounded-sm bg-bg min-h-[56px]">
              {skills.map(s => (
                <Chip key={s} interactive={false} className="gap-4 pl-12 pr-8">
                  {s}
                  <button 
                    type="button" 
                    onClick={() => removeSkill(s)} 
                    className="text-text-mute hover:text-text transition-colors"
                  >
                    <X className="w-12 h-12" />
                  </button>
                </Chip>
              ))}
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleAddSkill}
                placeholder={skills.length === 0 ? "Type a skill and press Enter..." : "Add another skill..."}
                className="flex-1 min-w-[200px] bg-transparent outline-none text-body text-text placeholder:text-text-mute"
              />
            </div>
          </section>

          {/* Rate & Availability */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-24">
            <div className="flex flex-col gap-8">
              <label className="text-micro-label text-text-mute uppercase tracking-[0.05em]">Hourly Rate</label>
              <div className="flex gap-8 items-center">
                <Input type="number" min="1" placeholder="Min" value={rateMin} onChange={e => setRateMin(e.target.value ? Number(e.target.value) : '')} className="font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" required />
                <span className="text-text-mute">-</span>
                <Input type="number" min="1" placeholder="Max" value={rateMax} onChange={e => setRateMax(e.target.value ? Number(e.target.value) : '')} className="font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" required />
                <select 
                  value={currency} 
                  onChange={e => setCurrency(e.target.value)}
                  className={`w-80 ${commonInputClass} pr-24`}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            
            <div className="flex flex-col gap-8">
              <label className="text-micro-label text-text-mute uppercase tracking-[0.05em]" htmlFor="availability">Availability</label>
              <select 
                id="availability"
                value={availability} 
                onChange={e => setAvailability(e.target.value as Freelancer['availability'])}
                className={commonInputClass}
              >
                <option value="now">Available now</option>
                <option value="this_week">This week</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </section>

          {/* Bio */}
          <section className="flex flex-col gap-8">
            <label className="text-micro-label text-text-mute uppercase tracking-[0.05em]" htmlFor="bio">Bio *</label>
            <textarea 
              id="bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              required
              maxLength={500}
              placeholder="Tell clients about your background and approach..."
              className={`${commonInputClass} min-h-[120px] resize-y`}
            />
            <div className="text-right text-[11px] text-text-mute tabular-nums">{bio.length}/500</div>
          </section>

          {/* Links & Location */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-24">
            <div className="flex flex-col gap-8">
              <label className="text-micro-label text-text-mute uppercase tracking-[0.05em]" htmlFor="portfolio">Portfolio URL</label>
              <Input id="portfolio" type="url" value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex flex-col gap-8">
              <label className="text-micro-label text-text-mute uppercase tracking-[0.05em]" htmlFor="timezone">Timezone</label>
              <Input id="timezone" value={timezone} onChange={e => setTimezone(e.target.value)} required />
            </div>
          </section>

          <hr className="border-border mt-8" />

          <div className="flex justify-end gap-16">
            <Button variant="primary" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : (profile ? 'Save changes' : 'Submit profile')}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
};
