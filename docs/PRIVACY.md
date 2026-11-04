# Privacy and data

The same text is shown in the app under **More → Privacy**.

- **Local only.** Everything you enter is stored in your browser (IndexedDB and local storage). There is no account, server-side database, sync or telemetry.
- **No outside requests.** The app makes no analytics, advertising, tracking or error-reporting requests. Fonts, icons, art and the starter cookbook are bundled. The Content-Security-Policy (`connect-src 'self'`) prevents the app from talking to other origins, and the test suite checks that no request leaves the site.
- **Hosting.** Like any website, the static host may keep ordinary access logs of page requests. It never receives pantry data.
- **Photos** (recipes, profile, background) are resized and kept in the browser only.
- **Backups** are plain, unencrypted JSON. Restoring validates size, format, version, checksum and every record before anything changes, and is a single transaction.
- **Deleting.** Settings → Delete my data (typed confirmation) or clearing site data in the browser.
- **Not advice.** Allergen and diet filters rely on the ingredient data and tags saved in the app and can be incomplete. Dates are what the user enters. The app gives no medical or food-safety advice.
