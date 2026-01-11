"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface UnlockContextType {
  unlockedPostIds: Set<string>;
  addUnlockedPost: (postId: string) => void;
  isUnlocked: (postId: string) => boolean;
  clearUnlockedPosts: () => void;
}

const UnlockContext = createContext<UnlockContextType | undefined>(undefined);

export function UnlockProvider({ children }: { children: ReactNode }) {
  const [unlockedPostIds, setUnlockedPostIds] = useState<Set<string>>(new Set());

  const addUnlockedPost = (postId: string) => {
    setUnlockedPostIds((prev) => {
      const next = new Set(prev);
      next.add(postId);
      return next;
    });
  };

  const isUnlocked = (postId: string) => {
    return unlockedPostIds.has(postId);
  };

  const clearUnlockedPosts = () => {
    setUnlockedPostIds(new Set());
  };

  return (
    <UnlockContext.Provider
      value={{
        unlockedPostIds,
        addUnlockedPost,
        isUnlocked,
        clearUnlockedPosts,
      }}
    >
      {children}
    </UnlockContext.Provider>
  );
}

export function useUnlock() {
  const context = useContext(UnlockContext);
  if (context === undefined) {
    throw new Error("useUnlock must be used within an UnlockProvider");
  }
  return context;
}
