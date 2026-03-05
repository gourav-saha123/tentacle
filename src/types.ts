export interface SocialLink {
  platform: string;
  url: string;
}

export interface User {
  uid: string;
  email: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  socialLinks: SocialLink[];
  bio: string;
  onboarded: boolean;
  updatedAt: string;
}

export interface Group {
  id: string;
  title: string;
  about: string;
  goal: string;
  ownerId: string;
  members: string[];
  createdAt: string;
}

export interface FeedPost {
  id: string;
  content: string;
  authorId: string;
  authorUsername: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
}

export interface ChatMessage {
  id?: string;
  sessionId: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
}

export interface Memory {
  userId: string;
  content: string;
  updatedAt: string;
}
