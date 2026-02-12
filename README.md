This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Mobile (Capacitor)

The app ships as a native iOS/Android wrapper using [Capacitor](https://capacitorjs.com) in **remote mode** — the WebView loads the live Vercel deployment. No local bundling required.

### Prerequisites

- **iOS:** macOS with Xcode 15+ and CocoaPods (`sudo gem install cocoapods`)
- **Android:** Android Studio with SDK 33+

### Setup

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Edit capacitor.config.ts and replace <MY_VERCEL_DOMAIN> with your actual domain
#    e.g. server.url = "https://job-picks.vercel.app"

# 3. Sync native projects (copies config to native platforms)
npx cap sync
```

### Open in IDE

```bash
# Open iOS project in Xcode
npx cap open ios

# Open Android project in Android Studio
npx cap open android
```

### Development

After changing `capacitor.config.ts` or adding plugins, re-sync:

```bash
npx cap sync
```

### Release Builds

**iOS (App Store):**
1. `npx cap open ios`
2. In Xcode: Product → Archive
3. Distribute via App Store Connect

**Android (Play Store):**
1. `npx cap open android`
2. In Android Studio: Build → Generate Signed Bundle / APK → Android App Bundle (.aab)
3. Upload to Google Play Console
