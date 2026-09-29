<?php
// Copy this file to config.php (next to send.php) and fill it in.
// config.php is gitignored - never commit the real secret.
return [
    // Same value as MAIL_ENDPOINT_SECRET in the API's environment.
    // At least 32 random characters, e.g.
    //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    'SECRET' => 'change-me-to-a-long-random-secret-string',

    // Must be an address on YOUR domain (the one this hosting serves),
    // otherwise receiving servers treat the email as spoofed. No mailbox is needed.
    'FROM' => 'no-reply@your-domain.example',
    'FROM_NAME' => "Techastra '26",

    // Where participants' replies go (a mailbox someone actually reads).
    'REPLY_TO' => 'techastra@your-domain.example',

    // true = write emails to mail-log.txt instead of sending (for testing).
    'DRY_RUN' => true,
];
