APP STORE BADGE — drop Apple's official asset here
==================================================

Save Apple's official "Download on the App Store" badge as:

    public/badges/app-store.svg

Get it from Apple's marketing resources (use their EXACT artwork — Apple's
guidelines prohibit recreating, recoloring, or altering the badge):

    https://developer.apple.com/app-store/marketing/guidelines/#section-badges

The GetAppBadge component (components/GetAppBadge.tsx) loads this file
automatically. Until it exists, the CTA falls back to the TestFlight beta button.

NOTE: the official App Store badge is only appropriate once the app is public on
the App Store. During the TestFlight beta, the TestFlight CTA is the correct call.
