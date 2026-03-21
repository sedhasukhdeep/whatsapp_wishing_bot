import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { Profile } from '@/types';

interface ProfileContextType {
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
}

const ProfileContext = createContext<ProfileContextType>({ profile: null, setProfile: () => {} });

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile | null>(() => {
    const stored = localStorage.getItem('wishing_bot_profile');
    try {
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setProfile = (p: Profile | null) => {
    if (p) {
      localStorage.setItem('wishing_bot_profile', JSON.stringify(p));
    } else {
      localStorage.removeItem('wishing_bot_profile');
    }
    setProfileState(p);
  };

  return <ProfileContext.Provider value={{ profile, setProfile }}>{children}</ProfileContext.Provider>;
}

export const useProfile = () => useContext(ProfileContext);
