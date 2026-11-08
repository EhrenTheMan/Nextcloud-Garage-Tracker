# Auto Tracker for Nextcloud

Auto Tracker is a private, per-user garage for Nextcloud 35. Keep vehicle specifications (including custom fields such as oil, filters, bulbs, and bolt pattern), modifications, fuel fill-ups, maintenance, issues, and plans in one place. Link photos already in Nextcloud Files without moving or copying them.

## Install

Installation requires administrator access to the server or container running Nextcloud. An app password or ordinary Files/WebDAV access is not enough to install a server app.

1. Copy this directory into a configured Nextcloud apps directory as `auto_tracker`, or extract the provided archive into that apps directory. The resulting directory must directly contain `appinfo/info.xml`, `lib/`, `js/`, and the other app files. For example, on a traditional installation:

   ```sh
   sudo cp -a /path/to/Auto-Tracker /var/www/nextcloud/apps/auto_tracker
   sudo chown -R www-data:www-data /var/www/nextcloud/apps/auto_tracker
   sudo -u www-data php /var/www/nextcloud/occ app:enable auto_tracker
   ```

   If using the archive instead of the source directory, replace the `cp` command with `sudo tar -xzf /path/to/auto_tracker.tar.gz -C /var/www/nextcloud/apps`.

   Adjust paths and the web-server user for your installation. For Docker, copy or mount the app into an apps directory inside the Nextcloud container and run `occ` as the container's web-server user. Use a persistent custom-apps mount so upgrades or container replacement do not discard the app.
2. Open **Auto Tracker** in Nextcloud's app navigation. Each signed-in user has their own separate garage; this app does not currently share vehicles with other users.
3. Back up the Nextcloud database as well as Files. Vehicle records are in the Nextcloud database, not in the Files folder. Linked photos remain in Files and need their usual backup.

This app targets Nextcloud 35 and has not been published to the Nextcloud app store or signed. Some installations may show an integrity warning for unsigned custom apps. Review your server's custom-app policies before installation.

## Using the garage

- Add a vehicle and choose US (miles, gallons, MPG) or metric (km, liters, L/100 km) units and a three-letter currency code. Add oil type and capacity, filter part numbers, bulbs, wheels, and other information under **Specifications**.
- Add dates, odometer readings, notes, and costs to modifications, service, issues, and fill-ups as applicable. Costs are total amounts, not per-unit prices; blank costs are excluded from totals. Issue costs should only be entered there if they were not also recorded as maintenance or modification costs, to avoid double counting.
- Use **Plans** for future modifications, repairs, and maintenance. Plan costs are estimates and are shown separately from actual expenses, including when a plan is marked done. Create an actual record separately when work is performed.
- In **Photos**, browse your accessible Nextcloud folders and link existing image files. Save selections in one folder before navigating to another. Removing a link or deleting a vehicle never deletes the file. If a file is deleted or no longer accessible, its preview will stop working.
- Fuel economy is computed from one full tank to the next full tank, using the odometer difference and all fuel added after the first full tank, including partial fill-ups. The first full tank is a baseline. Records are ordered by date, then odometer; an odometer decrease resets the baseline. Accurate results depend on entering every intervening fill-up and marking full tanks correctly.
- Units cannot be changed while fuel or odometer records exist, and currency cannot be changed while any cost or estimate exists. This prevents silently mixing incompatible values. Remove the relevant records first if the original choice was incorrect.
- Concurrent edits are detected. If another tab changed a vehicle, reload the page and reapply your changes; the app does not automatically merge them.

## Development and verification

No frontend build is required. Run the fuel-economy tests with `node --test tests/*.test.js` and check JavaScript syntax with `node --check js/auto-tracker.js`. Install and test the app against a disposable Nextcloud 35 instance before deploying to production.

## License

Auto Tracker is available under the [GNU Affero General Public License, version 3 or later](LICENSE).
