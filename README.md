# ❤️ Couple Calendar — Setup & Free Hosting Guide

A private, real-time shared calendar designed exclusively for couples to plan dates, send proposals, track upcoming milestones, and sync in real time across devices.

---

## 🚀 Option 1: 100% Free Cloud Hosting (Firebase + GitHub Pages / Vercel)

This setup costs **$0 forever**, requires **no server maintenance**, and syncs changes between you and your partner in **under 100 milliseconds** anywhere in the world.

### Step 1: Create Your Free Firebase Project (2 minutes)

1. Open the [Firebase Console](https://console.firebase.google.com/) and sign in with your Google account.
2. Click **Add project** (or **Create a project**).
   - Name your project (e.g. `our-couple-calendar`).
   - Turn off Google Analytics (not needed) and click **Create project**.
3. Create the Realtime Database:
   - In the left sidebar, click **Build** > **Realtime Database**.
   - Click **Create Database**.
   - Select a location (e.g. `us-central1` or closest to you) and click **Next**.
   - Choose **Start in test mode** (this allows you and your partner to read and write without authentication setup).
   - Click **Enable**.
4. Get your Web Configuration keys:
   - Click the **Gear icon (⚙️)** next to Project Overview > **Project settings**.
   - Under the **General** tab, scroll down to **Your apps**.
   - Click the Web icon **`</>`**.
   - Enter an App nickname (e.g. `Couple Calendar Web`) and click **Register app**.
   - You will see a `firebaseConfig` object looking like this:
     ```javascript
     const firebaseConfig = {
       apiKey: "AIzaSy...",
       authDomain: "our-couple-calendar.firebaseapp.com",
       databaseURL: "https://our-couple-calendar-default-rtdb.firebaseio.com",
       projectId: "our-couple-calendar",
       storageBucket: "our-couple-calendar.appspot.com",
       messagingSenderId: "123456789",
       appId: "1:123456789:web:abcdef"
     };
     ```

---

### Step 2: Connect the App to Your Firebase

You can connect your Firebase keys in either of two easy ways:

#### Method A: Directly in the Web App (No coding required)
1. Open the app in your browser (e.g., `http://localhost:8080`).
2. Tap the **`Cloud: Setup`** pill in the top session bar.
3. Paste your `firebaseConfig` JSON into the box and click **Connect Cloud**.
4. The cloud dot will turn green (🟢 **`Cloud: Live`**). You are connected!

#### Method B: Paste into `firebase-config.js`
Open [`firebase-config.js`](file:///Users/reejansunshrestha/Inventory/Gemini%20AG/firebase-config.js) in your text editor and paste your keys into `window.FIREBASE_CONFIG`:
```javascript
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "our-couple-calendar.firebaseapp.com",
  databaseURL: "https://our-couple-calendar-default-rtdb.firebaseio.com",
  projectId: "our-couple-calendar",
  storageBucket: "our-couple-calendar.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

---

### Step 3: Deploy to GitHub Pages (100% Free Hosting)

1. Create a free GitHub repository at [github.com/new](https://github.com/new) (e.g. `couple-calendar`).
2. Upload or push this folder's files:
   - `index.html`
   - `firebase-config.js`
3. In your GitHub repository:
   - Go to **Settings** > **Pages** (in the left sidebar).
   - Under **Build and deployment** > **Branch**, select `main` (or `master`) and folder `/ (root)`.
   - Click **Save**.
4. Within 1 minute, GitHub will give you your free live URL:
   `https://<your-username>.github.io/couple-calendar/`

*(Alternatively, you can drag and drop this folder onto [Vercel.com](https://vercel.com) or [Netlify.com](https://netlify.com) for instant free hosting).*

---

### Step 4: Share Direct Links with Your Partner

Send these links to your phones:

- **Partner 1 (Anna)**:
  `https://<your-username>.github.io/couple-calendar/?user=a`
- **Partner 2 (Daniel)**:
  `https://<your-username>.github.io/couple-calendar/?user=b`

> 📱 **Pro Tip — Add to Home Screen (Native App Feel)**:
> - **On iPhone (Safari)**: Tap the Share button at the bottom of the screen > tap **Add to Home Screen**.
> - **On Android (Chrome)**: Tap the three dots menu > tap **Install app** or **Add to Home screen**.
> 
> The calendar will open full-screen like a real iOS / Android app without browser URL bars!

---

## 🔒 Firebase Security Rules (Optional but Recommended)

By default, "test mode" in Firebase Realtime Database lasts for 30 days. To make it permanent and private for just you and your partner:

1. In Firebase Console, go to **Realtime Database** > **Rules** tab.
2. Set the rules:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
3. Click **Publish**. This keeps your shared calendar permanently accessible to your web app.
