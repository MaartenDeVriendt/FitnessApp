# Firebase (Spark / free tier) setup for Fitness PWA

This app uses **Firebase Authentication (email/password)** and **Cloud Firestore**. The **Spark plan** is enough for development and modest personal use; stay within [Firestore and Auth quotas](https://firebase.google.com/pricing).

## 1. Create a Firebase project

1. Open [Firebase console](https://console.firebase.google.com) → **Add project**.
2. Disable Google Analytics if you do not need it (optional).
3. Finish the wizard.

## 2. Register a web app

1. Project **Settings** (gear) → **Your apps** → **Web** (`</>`).
2. Register the app, copy the `firebaseConfig` object.
3. Paste the values into `src/environments/environment.ts` and `src/environments/environment.development.ts` (replace the `YOUR_*` placeholders).

`ng serve` uses the **development** file via `angular.json` `fileReplacements`. Production builds use `environment.ts`.

## 3. Enable Authentication

1. **Build** → **Authentication** → **Get started**.
2. **Sign-in method** → **Email/Password** → Enable.

## 4. Create Firestore

1. **Build** → **Firestore Database** → **Create database**.
2. Start in **production mode** (you will deploy rules next) or **test mode** for a quick local try (rules expire after 30 days).
3. Pick a region close to your users.

## 5. Security rules (multi-user isolation)

Rules live in `firestore.rules`. They tell Firestore: **only the signed-in user** may read/write `users/{theirUid}` and `users/{theirUid}/workouts/*`. Without publishing rules (or while still on default “deny” production rules), the app will often show **permission denied** when saving workouts.

### What happens between “publish rules” and “run the app”

1. **You publish rules** (console or CLI). Google stores that rules text for your project.
2. **Nothing else is required in Firebase** before you try the app.
3. You run **`npm start`**, sign up/sign in, and add a workout. Each Firestore request includes an **ID token**; Firestore checks `request.auth.uid` against the path. If it matches, the read/write is allowed.

**Recommended (no CLI):** open **Firestore Database** → **Rules** → replace the editor contents with the full contents of `firestore.rules` from this repo → **Publish**. Then go straight to `npm start`.

### Firebase CLI — step by step (easy)

Do this on your Mac in **Terminal**. Your app folder is `FitnessApp` (the one that contains `firestore.rules` and `firebase.json`).

**1. Install the CLI (pick one way)**

- **No global install (recommended):** use `npx` so you always get a fresh CLI:

  ```bash
  npx firebase-tools@latest --help
  ```

- **Or install globally:**

  ```bash
  npm install -g firebase-tools
  ```

Below, if you use `npx`, replace `firebase` with `npx firebase-tools@latest` (e.g. `npx firebase-tools@latest login`).

**2. Log in with your Google account**

```bash
cd /Users/maartenmuto/Desktop/FitnessApp
firebase login
```

A browser window opens → choose the Google account that owns the Firebase project → allow access.

**3. See your projects (optional check)**

```bash
firebase projects:list
```

Confirm your new project appears.

**4. Link this folder to that Firebase project**

```bash
cd /Users/maartenmuto/Desktop/FitnessApp
firebase use --add
```

- Pick your project from the list.
- When asked for an alias, press **Enter** to use **`default`**.

This creates **`.firebaserc`** in the folder (it stores which `projectId` deploys use). Safe to commit.

**Alternative:** if you know the project id (from the console URL or project settings):

```bash
firebase use your-project-id
```

**5. Deploy Firestore rules**

This repo already has **`firebase.json`** (points at `firestore.rules`). Run:

```bash
firebase deploy --only firestore:rules
```

You should see something like **“Deploy complete!”** for Firestore rules.

**6. Run your Angular app**

```bash
npm start
```

Sign up, add a workout. If something fails, check the deploy output and that **Authentication** and **Firestore** are enabled in the console (steps 3–4 earlier in this doc).

**Common issues**

| Problem | What to do |
|--------|------------|
| `No currently active project` | Run `firebase use --add` or `firebase use YOUR_PROJECT_ID` in `FitnessApp`. |
| `Error: Failed to authenticate` | Run `firebase login` again. |
| Permission denied in the app | Redeploy rules (`firebase deploy --only firestore:rules`) and confirm `firestore.rules` matches this repo. |

## 6. AngularFire

Dependencies are already in `package.json` (`@angular/fire`, `firebase`). Providers are registered in `src/app/app.config.ts` (`provideFirebaseApp`, `provideAuth`, `provideFirestore`).

---

## Firestore data layout

Firebase Auth owns identities (UIDs). Data under each user:

```text
users/{uid}                              ← profile (created on sign-up)
users/{uid}/settings/weeklyProgram       ← repeating Mon–Sun exercise template
users/{uid}/weekLogs/{weekMondayKey_day} ← logged weights for that calendar week + weekday
users/{uid}/workouts/{workoutId}         ← legacy (optional); the app UI uses weekLogs now
```

`weekLogs` document id example: `2026-04-06_monday` (local Monday date of that week + weekday). Fields include `weekMondayKey`, `dayOfWeek`, and `exercises[]` with `exerciseKey`, `name`, `sets: [kg, kg, kg]`.

### Example: `users/aliceUid`

```json
{
  "uid": "aliceUid",
  "email": "alice@example.com",
  "displayName": "Alice",
  "createdAt": { "_seconds": 1712505600, "_nanoseconds": 0 }
}
```

(`createdAt` is a server `Timestamp` in the console.)

### Example: `users/aliceUid/workouts/abc123`

```json
{
  "date": { "_seconds": 1712592000, "_nanoseconds": 0 },
  "exercises": [
    {
      "name": "Back squat",
      "sets": [80, 80, 75],
      "previous": [75, 75, 70],
      "pr": { "maxKg": 80, "achievedAt": "2026-04-07" }
    },
    {
      "name": "Bench press",
      "sets": [60, 60, 55]
    }
  ],
  "createdAt": { "_seconds": 1712592000, "_nanoseconds": 0 },
  "updatedAt": { "_seconds": 1712592000, "_nanoseconds": 0 }
}
```

- **`sets`**: exactly three numbers (kg), per product requirement.
- **`previous`**: optional previous session triple.
- **`pr`**: optional snapshot on that line; the **PR summary screen** recomputes bests across all workouts via `WorkoutService.computePersonalRecords`.

---

## PWA notes

- `ng add @angular/pwa` is already applied. The service worker registers in production builds (`ng build`), not during `ng serve` (see `provideServiceWorker` in `app.config.ts`).
- After deploy, serve over **HTTPS** so the service worker and installability work as expected.

---

## Useful commands

| Command        | Purpose                          |
| -------------- | -------------------------------- |
| `npm start`    | Dev server (`ng serve`)          |
| `npm run build`| Production build + PWA worker    |
| `npm test`     | Unit tests (Vitest)              |
