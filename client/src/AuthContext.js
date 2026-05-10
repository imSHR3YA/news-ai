import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, isFirebaseEnabled } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseEnabled) {
      const savedUser = localStorage.getItem("newsai_demo_user");
      setUser(savedUser ? JSON.parse(savedUser) : null);
      setLoading(false);
      return undefined;
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  function demoLogin({ email, displayName, photoURL = null }) {
    const demoUser = {
      uid: `demo-${email.toLowerCase()}`,
      email,
      displayName: displayName || email.split("@")[0],
      photoURL,
      isDemoUser: true,
    };
    localStorage.setItem("newsai_demo_user", JSON.stringify(demoUser));
    setUser(demoUser);
  }

  async function logout() {
    if (!isFirebaseEnabled) {
      localStorage.removeItem("newsai_demo_user");
      setUser(null);
      return;
    }
    await signOut(auth);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'DM Sans, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 900, marginBottom: '1rem' }}>
            News<span style={{ color: '#e83a2f', fontStyle: 'italic' }}>AI</span>
          </div>
          <div style={{ width: 36, height: 36, border: '3px solid #e8e8e8', borderTopColor: '#e83a2f', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, demoLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
