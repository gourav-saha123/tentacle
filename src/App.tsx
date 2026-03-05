import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, storage, signInWithGoogle, logout } from './firebase';
import { 
  doc, getDoc, setDoc, updateDoc, collection, query, onSnapshot, 
  orderBy, addDoc, serverTimestamp, where, limit, getDocs 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  UserProfile, Group, FeedPost, ChatSession, ChatMessage, Memory, SocialLink 
} from './types';
import { getChatResponse, updateMemory, generateFeedPost, generateGroupDetails, analyzeWorkPotential } from './services/aiService';
import { 
  Plus, LogOut, Search, Send, Loader2, ChevronRight, Sparkles, 
  MessageSquare, Users, History, Brain, PlusCircle, User as UserIcon,
  ExternalLink, Github, Twitter, Linkedin, Globe, Edit3, Save, X,
  Briefcase, TrendingUp, AlertCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) displayMessage = parsed.error;
      } catch (e) {
        displayMessage = this.state.error.message || displayMessage;
      }

      return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-50 p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Application Error</h2>
          <p className="text-zinc-600 mb-6 max-w-md">{displayMessage}</p>
          <Button onClick={() => window.location.reload()}>Reload Application</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- UI Components ---

const Button = ({ className, variant = 'primary', size = 'md', ...props }: any) => {
  const variants = {
    primary: 'bg-zinc-900 text-white hover:bg-zinc-800',
    secondary: 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50',
    ghost: 'hover:bg-zinc-100 text-zinc-600',
    accent: 'bg-indigo-600 text-white hover:bg-indigo-700',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100'
  };
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };
  return (
    <button 
      className={cn(
        'rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2',
        variants[variant as keyof typeof variants],
        sizes[size as keyof typeof sizes],
        className
      )} 
      {...props} 
    />
  );
};

const Input = ({ className, ...props }: any) => (
  <input 
    className={cn(
      'w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all',
      className
    )}
    {...props}
  />
);

const Card = ({ children, className }: any) => (
  <div className={cn('bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm', className)}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, loading] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        try {
          const profileRef = doc(db, 'profiles', user.uid);
          const profileSnap = await getDoc(profileRef);
          
          if (profileSnap.exists()) {
            setProfile(profileSnap.data() as UserProfile);
          } else {
            // Create both private user and public profile
            const randomId = Math.random().toString(36).substring(2, 8);
            const username = `user_${randomId}`;
            const now = new Date().toISOString();
            
            const newPrivateUser = {
              uid: user.uid,
              email: user.email || '',
              createdAt: now
            };
            
            const newProfile: UserProfile = {
              uid: user.uid,
              username,
              displayName: user.displayName || 'Anonymous',
              photoURL: user.photoURL || '',
              socialLinks: [],
              bio: '',
              onboarded: true,
              updatedAt: now
            };
            
            await setDoc(doc(db, 'users', user.uid), newPrivateUser);
            await setDoc(doc(db, 'profiles', user.uid), newProfile);
            setProfile(newProfile);
          }
          setIsAuthReady(true);
        } catch (error) {
          console.error(error);
          handleFirestoreError(error, OperationType.GET, `profiles/${user.uid}`);
        }
      };
      fetchProfile();
    } else if (!loading) {
      setIsAuthReady(true);
    }
  }, [user, loading]);

  if (loading || !isAuthReady) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl rotate-6">
              <Sparkles className="text-white w-10 h-10" />
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-zinc-900 uppercase">Tentacle</h1>
            <p className="text-zinc-500 text-lg font-medium">
              The AI-driven collaboration network.
            </p>
          </div>
          <Button onClick={signInWithGoogle} size="lg" className="w-full py-4 shadow-lg">
            Connect with Google
          </Button>
        </motion.div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      {/* Navbar */}
      <nav className="h-16 border-b border-zinc-200 bg-white px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
            <Sparkles className="text-white w-4 h-4" />
          </div>
          <span className="font-black text-2xl tracking-tighter uppercase">Tentacle</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 p-1.5 pr-3 rounded-full hover:bg-zinc-100 transition-colors border border-zinc-100"
          >
            <img src={profile?.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
            <span className="text-sm font-bold text-zinc-700">@{profile?.username}</span>
          </button>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left 1/3: AI Chat */}
        <aside className="w-1/3 border-r border-zinc-200 bg-white flex flex-col">
          <AIChatSection profile={profile} />
        </aside>

        {/* Right 2/3: Social Feed & Groups */}
        <main className="flex-1 overflow-hidden bg-zinc-50/50">
          <SocialSection profile={profile} />
        </main>
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <ProfileModal 
            profile={profile} 
            onClose={() => setShowProfileModal(false)} 
            onUpdate={(p) => setProfile(p)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sections ---

function AIChatSection({ profile }: { profile: UserProfile }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [memory, setMemory] = useState<Memory | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const path = 'chatSessions';
    const q = query(collection(db, path), where('userId', '==', profile.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sess = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
      setSessions(sess);
      if (sess.length > 0 && !currentSession) {
        setCurrentSession(sess[0]);
      } else if (sess.length === 0 && !isTyping) {
        handleNewChat();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, [profile.uid]);

  useEffect(() => {
    if (currentSession) {
      const path = `chatSessions/${currentSession.id}/messages`;
      const q = query(collection(db, 'chatSessions', currentSession.id, 'messages'), orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });
      return unsubscribe;
    }
  }, [currentSession]);

  useEffect(() => {
    const path = `memories/${profile.uid}`;
    const unsubscribe = onSnapshot(doc(db, 'memories', profile.uid), (doc) => {
      if (doc.exists()) setMemory(doc.data() as Memory);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
    return unsubscribe;
  }, [profile.uid]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const handleNewChat = async () => {
    const path = 'chatSessions';
    const newSess = {
      userId: profile.uid,
      title: `Chat ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString()
    };
    try {
      const docRef = await addDoc(collection(db, path), newSess);
      const sessionWithId = { id: docRef.id, ...newSess };
      setCurrentSession(sessionWithId);
      
      // Add initial AI message
      await addDoc(collection(db, 'chatSessions', docRef.id, 'messages'), {
        sessionId: docRef.id,
        role: 'model',
        content: "What's new?",
        createdAt: new Date().toISOString()
      });
      
      setShowHistory(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping || !currentSession) return;

    const userMsg = input;
    setInput('');
    setIsTyping(true);

    const path = `chatSessions/${currentSession.id}/messages`;
    const msgData = {
      sessionId: currentSession.id,
      role: 'user' as const,
      content: userMsg,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'chatSessions', currentSession.id, 'messages'), msgData);

      const response = await getChatResponse([...messages, msgData], memory, profile);
      await addDoc(collection(db, 'chatSessions', currentSession.id, 'messages'), {
        sessionId: currentSession.id,
        role: 'model',
        content: response,
        createdAt: new Date().toISOString()
      });

      // Update memory periodically
      if (messages.length % 5 === 0) {
        const conversation = messages.concat(msgData).map(m => `${m.role}: ${m.content}`).join('\n');
        const newMemoryContent = await updateMemory(conversation, memory?.content || '');
        await setDoc(doc(db, 'memories', profile.uid), {
          userId: profile.uid,
          content: newMemoryContent,
          updatedAt: new Date().toISOString()
        });
      }

      // Check for feed post opportunity
      const postContent = await generateFeedPost(profile, memory, []);
      if (postContent !== 'NO_POST') {
        await addDoc(collection(db, 'feed'), {
          content: postContent,
          authorId: profile.uid,
          authorUsername: profile.username,
          createdAt: new Date().toISOString()
        });
      }

    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message.includes('permission')) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleWork = async () => {
    if (isTyping || !currentSession) return;
    setIsTyping(true);
    
    try {
      // Get all groups for analysis
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, limit(20));
      const snap = await getDocs(q);
      const existingGroups = snap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
      
      const analysis = await analyzeWorkPotential(profile, memory, existingGroups);
      
      let aiResponse = "";
      if (analysis.action === 'JOIN') {
        aiResponse = `I found a group that matches your profile! You should check out the group with ID: ${analysis.groupId}.`;
      } else if (analysis.action === 'CREATE') {
        aiResponse = `I couldn't find a perfect match, so I've proposed a new group idea for you in the feed: "${analysis.postContent}"`;
        await addDoc(collection(db, 'feed'), {
          content: analysis.postContent,
          authorId: profile.uid,
          authorUsername: profile.username,
          createdAt: new Date().toISOString()
        });
      } else {
        aiResponse = analysis.message || "I need a bit more information about your specific goals to find or create the right group for you. What kind of projects are you most interested in right now?";
      }

      await addDoc(collection(db, 'chatSessions', currentSession.id, 'messages'), {
        sessionId: currentSession.id,
        role: 'model',
        content: aiResponse,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message.includes('permission')) {
        handleFirestoreError(err, OperationType.WRITE, 'groups/feed');
      }
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-full flex flex-col relative">
      <header className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-sm uppercase tracking-wider">AI Assistant</h3>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={handleWork} title="Work Analysis">
            <Briefcase className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowMemory(!showMemory)}>
            <Brain className="w-4 h-4" />
          </Button>
          <Button variant="primary" size="sm" onClick={handleNewChat}>
            <PlusCircle className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* History Overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute inset-x-0 top-14 bottom-0 z-30 bg-white border-r border-zinc-200 p-4 space-y-2 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-xs uppercase text-zinc-400">Chat History</h4>
              <button onClick={() => setShowHistory(false)}><X className="w-4 h-4" /></button>
            </div>
            {sessions.map(s => (
              <button 
                key={s.id}
                onClick={() => { setCurrentSession(s); setShowHistory(false); }}
                className={cn(
                  "w-full text-left p-3 rounded-xl text-sm transition-all",
                  currentSession?.id === s.id ? "bg-zinc-900 text-white" : "hover:bg-zinc-100 text-zinc-600"
                )}
              >
                {s.title}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memory Overlay */}
      <AnimatePresence>
        {showMemory && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute inset-x-0 top-14 bottom-0 z-30 bg-zinc-900 text-white p-6 space-y-4 overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase text-zinc-400">Long-term Memory</h4>
              <button onClick={() => setShowMemory(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="text-sm leading-relaxed text-zinc-300 font-mono">
              {memory?.content || "I'm still learning about you. Keep chatting to build my memory!"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}>
            <div className={cn(
              "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
              m.role === 'user' ? "bg-zinc-900 text-white rounded-tr-none" : "bg-zinc-100 text-zinc-800 rounded-tl-none"
            )}>
              <div className="prose prose-sm max-w-none prose-zinc dark:prose-invert">
                <Markdown>{m.content}</Markdown>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-1 p-2">
            <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce" />
            <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:0.2s]" />
            <div className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
        <div className="relative">
          <textarea 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask me anything about collaboration..."
            rows={2}
            className="w-full bg-white border border-zinc-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none shadow-sm"
          />
          <button 
            onClick={handleSend}
            disabled={isTyping || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SocialSection({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState<'feed' | 'groups'>('feed');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = 'feed';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedPost)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const path = 'groups';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const path = 'profiles';
    const q = query(collection(db, path), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllProfiles(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, []);

  const trendingGroups = [...groups]
    .sort((a, b) => b.members.length - a.members.length)
    .slice(0, 5);

  const matchedUsers = allProfiles
    .filter(p => p.uid !== profile.uid)
    .map(p => {
      // Simple matching logic: count shared groups
      const sharedGroups = groups.filter(g => g.members.includes(profile.uid) && g.members.includes(p.uid)).length;
      return { ...p, sharedGroups };
    })
    .filter(u => u.sharedGroups > 0)
    .sort((a, b) => b.sharedGroups - a.sharedGroups)
    .slice(0, 5);

  const handleCreateGroupFromPost = async (post: FeedPost) => {
    try {
      const details = await generateGroupDetails(post.content);
      const path = 'groups';
      await addDoc(collection(db, path), {
        ...details,
        ownerId: profile.uid,
        members: [profile.uid],
        createdAt: new Date().toISOString()
      });
      setActiveTab('groups');
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, 'groups');
    }
  };

  const handleJoinGroup = async (group: Group) => {
    if (group.members.includes(profile.uid)) return;
    const path = `groups/${group.id}`;
    try {
      await updateDoc(doc(db, 'groups', group.id), {
        members: [...group.members, profile.uid]
      });
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        <div className="flex items-center gap-1 p-1 bg-zinc-200/50 rounded-xl w-fit">
          <button 
            onClick={() => setActiveTab('feed')}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'feed' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            Open Feed
          </button>
          <button 
            onClick={() => setActiveTab('groups')}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-bold transition-all",
              activeTab === 'groups' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            Groups
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'feed' ? (
            <motion.div 
              key="feed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {posts.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <Sparkles className="w-12 h-12 text-zinc-200 mx-auto" />
                  <p className="text-zinc-400 font-medium">No AI posts yet. Chat with the assistant to generate ideas!</p>
                </div>
              ) : (
                posts.map(post => (
                  <Card key={post.id} className="p-6 space-y-4 hover:border-zinc-300 transition-all group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">@{post.authorUsername}'s AI Assistant</p>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">AI Suggestion</p>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400">{formatDistanceToNow(new Date(post.createdAt))} ago</span>
                    </div>
                    <p className="text-zinc-800 leading-relaxed text-lg font-medium italic">"{post.content}"</p>
                    <div className="pt-4 flex justify-end">
                      <Button variant="accent" size="sm" onClick={() => handleCreateGroupFromPost(post)}>
                        Launch Group <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="groups"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 gap-4"
            >
              {groups.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <Users className="w-12 h-12 text-zinc-200 mx-auto" />
                  <p className="text-zinc-400 font-medium">No groups created yet.</p>
                </div>
              ) : (
                groups.map(group => (
                  <Card key={group.id} className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xl font-black tracking-tight uppercase">{group.title}</h4>
                      <span className="text-xs font-bold text-zinc-400">{group.members.length} Members</span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">About</h5>
                        <p className="text-sm text-zinc-600 leading-relaxed">{group.about}</p>
                      </div>
                      <div>
                        <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Goal</h5>
                        <p className="text-sm font-bold text-indigo-600">{group.goal}</p>
                      </div>
                    </div>
                    <div className="pt-4 flex justify-between items-center border-t border-zinc-100">
                      <div className="flex -space-x-2">
                         {group.members.slice(0, 5).map((m, i) => {
                           const memberProfile = allProfiles.find(p => p.uid === m);
                           return (
                             <button 
                               key={i} 
                               onClick={() => memberProfile && setSelectedUserProfile(memberProfile)}
                               className="w-8 h-8 rounded-full bg-zinc-200 border-2 border-white overflow-hidden hover:z-10 transition-transform hover:scale-110"
                             >
                               {memberProfile?.photoURL ? (
                                 <img src={memberProfile.photoURL} alt="" className="w-full h-full object-cover" />
                               ) : (
                                 <UserIcon className="w-full h-full p-1 text-zinc-400" />
                               )}
                             </button>
                           );
                         })}
                      </div>
                      <Button 
                        variant={group.members.includes(profile.uid) ? "ghost" : "secondary"} 
                        size="sm"
                        onClick={() => handleJoinGroup(group)}
                        disabled={group.members.includes(profile.uid)}
                      >
                        {group.members.includes(profile.uid) ? "Joined" : "Join Group"}
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Trending Sidebar */}
      <aside className="w-80 border-l border-zinc-200 bg-white/50 p-6 space-y-8 hidden xl:block overflow-y-auto">
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Trending Groups</h3>
          </div>
          <div className="space-y-4">
            {trendingGroups.map((group, i) => (
              <div key={group.id} className="flex gap-4 items-start group cursor-pointer" onClick={() => setActiveTab('groups')}>
                <span className="text-2xl font-black text-zinc-200 group-hover:text-zinc-900 transition-colors">0{i + 1}</span>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold group-hover:text-indigo-600 transition-colors line-clamp-1">{group.title}</h4>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">{group.members.length} Members</p>
                </div>
              </div>
            ))}
            {trendingGroups.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-10 italic">No trending groups yet.</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Matched Users</h3>
          </div>
          <div className="space-y-4">
            {matchedUsers.map((u, i) => (
              <div 
                key={u.uid} 
                className="flex gap-3 items-center group cursor-pointer hover:bg-white p-2 rounded-xl transition-all"
                onClick={() => setSelectedUserProfile(u)}
              >
                <div className="relative">
                  <img src={u.photoURL} alt="" className="w-10 h-10 rounded-full object-cover border border-zinc-100" />
                  {u.sharedGroups > 0 && (
                    <div className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[8px] font-bold px-1 rounded-full">
                      {u.sharedGroups}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold truncate">@{u.username}</h4>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase truncate">{u.displayName}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-900 transition-colors" />
              </div>
            ))}
            {matchedUsers.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-10 italic">No matched users yet.</p>
            )}
          </div>
        </section>
      </aside>

      <AnimatePresence>
        {selectedUserProfile && (
          <UserModal profile={selectedUserProfile} onClose={() => setSelectedUserProfile(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function UserModal({ profile, onClose }: { profile: UserProfile, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-32 bg-zinc-900 relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-8 pb-8 -mt-12">
          <div className="flex items-end justify-between mb-6">
            <img src={profile.photoURL} alt="" className="w-24 h-24 rounded-3xl object-cover border-4 border-white shadow-xl bg-white" />
          </div>
          
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black tracking-tight">{profile.displayName}</h2>
              <p className="text-zinc-500 font-bold">@{profile.username}</p>
            </div>

            {profile.bio && (
              <p className="text-zinc-600 leading-relaxed">{profile.bio}</p>
            )}

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Social Links</h4>
              <div className="flex flex-wrap gap-2">
                {profile.socialLinks.map((link, i) => (
                  <a 
                    key={i} 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-100 transition-colors"
                  >
                    {link.platform.toLowerCase().includes('github') && <Github className="w-3 h-3" />}
                    {link.platform.toLowerCase().includes('twitter') && <Twitter className="w-3 h-3" />}
                    {link.platform.toLowerCase().includes('linkedin') && <Linkedin className="w-3 h-3" />}
                    {!['github', 'twitter', 'linkedin'].some(p => link.platform.toLowerCase().includes(p)) && <Globe className="w-3 h-3" />}
                    {link.platform}
                  </a>
                ))}
                {profile.socialLinks.length === 0 && (
                  <p className="text-xs text-zinc-400 italic">No social links provided.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProfileModal({ profile, onClose, onUpdate }: { profile: UserProfile, onClose: () => void, onUpdate: (p: UserProfile) => void }) {
  const [name, setName] = useState(profile.displayName);
  const [photo, setPhoto] = useState(profile.photoURL);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [links, setLinks] = useState<SocialLink[]>(profile.socialLinks || []);
  const [newPlatform, setNewPlatform] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddLink = () => {
    if (newPlatform && newUrl) {
      setLinks([...links, { platform: newPlatform, url: newUrl }]);
      setNewPlatform('');
      setNewUrl('');
    }
  };

  const handleRemoveLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const path = `profiles/${profile.uid}`;
    try {
      let finalPhotoUrl = photo;

      if (photoFile) {
        try {
          const storageRef = ref(storage, `profiles/${profile.uid}/${photoFile.name}`);
          const snapshot = await uploadBytes(storageRef, photoFile);
          finalPhotoUrl = await getDownloadURL(snapshot.ref);
        } catch (storageErr: any) {
          console.error('Storage error:', storageErr);
          if (storageErr.code === 'storage/unauthorized') {
            throw new Error(JSON.stringify({
              error: "Firebase Storage permissions are missing. Please ensure your Storage Security Rules allow uploads to 'profiles/{userId}/'.",
              operationType: 'write',
              path: `profiles/${profile.uid}/${photoFile.name}`
            }));
          }
          throw storageErr;
        }
      }

      const updated = {
        ...profile,
        displayName: name,
        photoURL: finalPhotoUrl,
        socialLinks: links,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'profiles', profile.uid), updated);
      onUpdate(updated);
      onClose();
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
      >
        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black tracking-tighter uppercase">Edit Profile</h3>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-all"><X className="w-6 h-6" /></button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative group">
                <img src={photo} alt="" className="w-24 h-24 rounded-3xl object-cover border-4 border-zinc-100 shadow-xl" />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer"
                >
                  <Edit3 className="text-white w-6 h-6" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              <div className="flex-1 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Display Name</label>
                  <Input value={name} onChange={(e: any) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Photo URL</label>
                  <Input value={photo} onChange={(e: any) => setPhoto(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Social Links</label>
              <div className="space-y-2">
                {links.map((link, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <div className="flex items-center gap-3">
                      <Globe className="w-4 h-4 text-zinc-400" />
                      <span className="text-sm font-bold">{link.platform}:</span>
                      <span className="text-sm text-zinc-500 truncate max-w-[200px]">{link.url}</span>
                    </div>
                    <button onClick={() => handleRemoveLink(i)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input 
                  placeholder="Platform (e.g. Twitter)" 
                  value={newPlatform} 
                  onChange={(e: any) => setNewPlatform(e.target.value)} 
                  className="w-1/3"
                />
                <Input 
                  placeholder="URL" 
                  value={newUrl} 
                  onChange={(e: any) => setNewUrl(e.target.value)} 
                  className="flex-1"
                />
                <Button variant="secondary" onClick={handleAddLink}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-zinc-100 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button variant="primary" className="flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
