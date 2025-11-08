import { createContext, useContext, useState, ReactNode } from 'react';

interface AvatarPreviewContextType {
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
}

const AvatarPreviewContext = createContext<AvatarPreviewContextType | undefined>(undefined);

export const AvatarPreviewProvider = ({ children }: { children: ReactNode }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <AvatarPreviewContext.Provider value={{ previewUrl, setPreviewUrl }}>
      {children}
    </AvatarPreviewContext.Provider>
  );
};

export const useAvatarPreview = () => {
  const context = useContext(AvatarPreviewContext);
  if (!context) {
    throw new Error('useAvatarPreview must be used within AvatarPreviewProvider');
  }
  return context;
};
