# Google Play remediation — 2026-11-14

Production baseline verified in Vercel: ee31e783afb59d57bef63eda4377b1d211d42d68.

## Web

Removed both public Android packages, APK download buttons and sideloading instructions from /aplicatii, /superadmin/sms and the SMS gateway configuration. The retired /downloads/* route responds 410, including direct links. No user-agent or reviewer exceptions. Existing SMS device operation and PDF invoices are unchanged.

Run node scripts/test-play-distribution.cjs before release.

## Native

An isolated copy of the code 6 Android source has been updated to version 1.3.3 (7). DownloadListener permits only same-origin HTTPS PDF, CSV, PNG and JPEG with matching extensions. Executable package navigation and external handoffs are rejected. No package-install permission is declared.

Local release source, Android changes, signed AAB and verification report are in output/play-policy-remediation-20261114 under the main workspace. These binary artifacts must never be copied to public/. The upload certificate is unchanged from version 6. Unit tests: 6 passed. Android lint: 0 errors, 21 warnings. Device runtime QA is not included in these checks.

## Appeal

Select the remediation option in Play Console and use the prepared English text in google-play-appeal.txt. Preparation does not submit an appeal or reinstate the application. Google must approve the appeal before a corrected release can be reviewed.
