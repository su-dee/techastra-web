# Techastra '26 mailer (PHP `mail()`, no SMTP account)

The API sends **one** automatic email: when the Registration desk approves a registration. It doesn't talk SMTP. It POSTs a signed message to `send.php`, and `send.php` sends it with PHP's built-in `mail()`, using the mail server that comes with the Plesk hosting. There is no SMTP account, no email service and no extra cost.

## Set up on Plesk

1. **Upload the folder.** Upload this `php-mailer/` folder into the site's `httpdocs/`. The URL becomes `https://<your-domain>/php-mailer/send.php`.
2. **Create the config.** Copy `config.sample.php` to `config.php` and fill in:
   - `SECRET`: a long random string. Put the same value in the API's `MAIL_ENDPOINT_SECRET`.
   - `FROM`: an address on your own domain, e.g. `no-reply@<your-domain>`. No mailbox is needed.
   - `REPLY_TO`: a mailbox someone reads.
3. **Set up mail in Plesk.** Mail is included in the plan.
   - Websites & Domains → *your domain* → **Mail Settings**: make sure mail service is on.
   - Turn on **DKIM** signing, and check that DNS has the **SPF** record Plesk suggests. Without them, emails often land in spam.
4. **Connect the API.** In the API's environment, set:
   - `MAIL_ENDPOINT_URL=https://<your-domain>/php-mailer/send.php`
   - `MAIL_ENDPOINT_SECRET=<same secret as config.php>`
5. **Test.**
   - With `DRY_RUN => true`, approve a test registration, then open `mail-log.txt` in File Manager. The email should be there.
   - Set `DRY_RUN => false`, approve a registration made with your own email, and check your inbox (and spam folder).
   - Delete `mail-log.txt` afterwards.

## Good to know

- **Sending limits.** Shared hosting plans usually cap outgoing mail (often 100–500 per hour). Check your plan against how many approvals the desk will make in an hour.
- **Security.** Requests without a valid signature, or older than 5 minutes, are rejected. The script can't be used to send spam. The sender address is fixed in `config.php`.
- **If mail fails,** the approval still goes through. The API just logs a warning, and the participant can see "Approved" on the Status page.

## Test locally

PHP on Windows has no mail server, so keep `DRY_RUN => true`:

    php -S localhost:8081 -t php-mailer

Then set `MAIL_ENDPOINT_URL=http://localhost:8081/send.php` in `server/.env`.
