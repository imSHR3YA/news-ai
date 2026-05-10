# 🚀 NewsAI — Complete AI-Powered News Aggregator
### Final Year Project | Full Stack | React + Node.js + Firebase + Claude AI

---

## ✅ Everything Included

### 🔐 Authentication
- Google Sign-In (one click)
- Email & Password Sign-Up / Sign-In
- Protected routes — news only visible after login
- User avatar + dropdown menu in navbar

### 📰 News Features
- Real-time news from NewsAPI + RSS fallback (Times of India, BBC, NDTV, TechCrunch)
- Breaking news ticker (auto-scrolling)
- Cinematic hero carousel (auto-rotates every 5s)
- Masonry grid layout
- Category tabs (General, Technology, Business, Health, Science, Sports, Entertainment)
- Infinite scroll pagination
- Skeleton loading screens
- Video thumbnail detection
- Scroll reveal animations

### 🤖 AI/ML Features (Claude API)
- 📝 AI Article Summarizer (3 bullet points)
- 😊 Sentiment Analysis (Positive/Negative/Neutral with score)
- ✅ Credibility Scorer (0-100% with reason)
- ⚖️ Bias Detector (Left → Right political spectrum)
- 👶 ELI5 — Explain Like I'm 5
- 🌐 Auto-Translator (12 languages)
- 🏷️ Smart Tag Generator
- 🤖 AI Chatbot Assistant

### 👤 User Features (Firebase)
- 💡 Suggest Articles (saved to Firestore)
- 💬 Real-time Comments on every article
- ⭐ Star Rating (1-5) with average shown to all
- 🔖 Save articles (localStorage)
- 📤 Share / Copy link

### 🎨 UI/UX Features
- 3 Themes: Light ☀️ / Dark 🌙 / Sepia 📜
- Font size A- / A / A+ controls
- Live clock in navbar
- Weather widget (auto-detects location)
- On This Day section (Wikipedia API)
- Most Read sidebar
- Sentiment Dashboard sidebar
- User Profile sidebar
- Full-screen search overlay
- Voice search 🎤
- Search filters (category, sentiment)
- Search history & trending suggestions
- Reading progress bar
- Read time + Difficulty badge
- Back to top button
- Responsive mobile design

---

## 🛠️ Setup Guide (Mac — Step by Step)

### Step 1 — Install Node.js
```bash
# Check if already installed:
node -v

# If not installed, go to https://nodejs.org → Download LTS → Install
```

### Step 2 — Get 3 Free API Keys

**🔑 NewsAPI** (real-time news)
→ https://newsapi.org → Get API Key → Sign up free → Copy key

**🌤️ OpenWeather** (weather widget)
→ https://openweathermap.org/api → Sign Up → My API Keys → Copy key
⚠️ Wait 10 minutes after signup before key activates

**🤖 Anthropic Claude** (all AI features)
→ https://console.anthropic.com → API Keys → Create new key → Copy key

### Step 3 — Setup Firebase (free)
1. Go to → https://console.firebase.google.com
2. Click "Add Project" → Name: "NewsAI" → Continue → Create
3. Click the Web icon `</>` → Register app as "newsai" → Copy firebaseConfig
4. **Authentication** → Get Started → Enable "Google" + "Email/Password"
5. **Firestore Database** → Create Database → Test Mode → Choose region → Enable

### Step 4 — Configure the Project

**A) Create .env file:**
```bash
cp .env.example .env
```
Open `.env` and fill in your 3 keys.

**B) Add Firebase config:**
Open `client/src/firebase.js` and replace the firebaseConfig values with yours from Step 3.

### Step 5 — Install Dependencies
```bash
# In the newsai-full folder:
npm install

# Then:
cd client
npm install
cd ..
```

### Step 6 — Run
```bash
npm run dev
```

Opens automatically at **http://localhost:3000** 🎉

---

## 🔒 Firestore Security Rules
In Firebase Console → Firestore → Rules, paste this and Publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /suggestions/{doc} {
      allow read: if true;
      allow create: if request.auth != null;
    }
    match /comments/{doc} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.userId;
    }
    match /ratings/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /ratings_summary/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 📁 Project Structure
```
newsai-full/
├── server/
│   └── index.js          ← Express backend (all API routes)
├── client/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js         ← Complete React app (all components)
│       ├── AuthContext.js ← Firebase auth state management
│       ├── firebase.js    ← Firebase configuration ← FILL THIS IN
│       ├── index.css      ← All styles + all 3 themes
│       └── index.js       ← React entry point
├── .env                   ← Your API keys ← CREATE FROM .env.example
├── .env.example           ← Template
├── package.json
└── README.md
```

---

## 🐛 Troubleshooting

**Blank page / Auth error**
→ Fill in Firebase config in `client/src/firebase.js`
→ Make sure Google & Email auth are enabled in Firebase Console

**News not loading**
→ Check NEWS_API_KEY in .env (falls back to RSS if missing)

**Weather not showing**
→ Check WEATHER_API_KEY — new keys take 10 mins to activate

**AI features show "unavailable"**
→ Check ANTHROPIC_API_KEY in .env (starts with `sk-ant-`)

**Comments/Ratings not working**
→ Set Firestore rules (see above section)
→ Make sure Firestore is in Test Mode

**Port already in use**
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:5000 | xargs kill -9
```

---

## 📊 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, CSS3 |
| Backend | Node.js, Express |
| Auth | Firebase Authentication |
| Database | Firebase Firestore |
| AI Engine | Anthropic Claude Sonnet |
| News Data | NewsAPI + RSS Feeds |
| Weather | OpenWeatherMap API |
| History | Wikipedia REST API |
| Fonts | Google Fonts |

---

*NewsAI — Final Year Project 2026*
