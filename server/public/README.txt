Plesk "Document root" for the Techastra Node.js app - keep this folder empty.

Plesk's nginx serves files found here directly, bypassing the app. The
website itself (client/dist) is served by the Node app (server/index.js),
which adds the security headers. See PRODUCTION.md.
