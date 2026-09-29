<?php
/**
 * Techastra '26 mailer - sends an email with PHP's built-in mail(), using the
 * hosting's own mail server (no SMTP account, no paid service).
 *
 * Only the Techastra API may call it: every request must carry an HMAC-SHA256
 * signature of the raw body made with the shared SECRET, and a timestamp no
 * older than 5 minutes. Without that it would be an open spam relay.
 *
 *   POST send.php
 *   X-Techastra-Signature: sha256=<hex HMAC of the raw body>
 *   {"to": "...", "subject": "...", "text": "...", "ts": 1759040000}
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// mbstring isn't enabled on every host - fall back to plain equivalents.
function cut(string $s, int $max): string
{
    return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max);
}

function encodeHeader(string $s): string
{
    if (preg_match('/^[\x20-\x7E]*$/', $s)) {
        return $s;
    }
    return '=?UTF-8?B?' . base64_encode($s) . '?=';
}

function respond(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    respond(500, ['ok' => false, 'error' => 'Mailer is not configured']);
}
$config = require $configFile;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'Method not allowed']);
}

$raw = file_get_contents('php://input', false, null, 0, 64 * 1024);
if ($raw === false || $raw === '') {
    respond(400, ['ok' => false, 'error' => 'Empty body']);
}

// 1. Signature: only the API knows the secret.
$secret = (string) ($config['SECRET'] ?? '');
if (strlen($secret) < 32) {
    respond(500, ['ok' => false, 'error' => 'Mailer secret is missing or too short']);
}
$given = (string) ($_SERVER['HTTP_X_TECHASTRA_SIGNATURE'] ?? '');
$expected = 'sha256=' . hash_hmac('sha256', $raw, $secret);
if (!hash_equals($expected, $given)) {
    respond(401, ['ok' => false, 'error' => 'Bad signature']);
}

$msg = json_decode($raw, true);
if (!is_array($msg)) {
    respond(400, ['ok' => false, 'error' => 'Invalid JSON']);
}

// 2. Freshness: a captured request can't be replayed later.
$ts = (int) ($msg['ts'] ?? 0);
if (abs(time() - $ts) > 300) {
    respond(401, ['ok' => false, 'error' => 'Request expired']);
}

// 3. Validate and sanitise. CR/LF in the subject would allow header injection.
$to = trim((string) ($msg['to'] ?? ''));
if (!filter_var($to, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n,;]/', $to)) {
    respond(400, ['ok' => false, 'error' => 'Invalid recipient']);
}
$subject = trim(preg_replace('/[\r\n]+/', ' ', (string) ($msg['subject'] ?? '')));
$text = (string) ($msg['text'] ?? '');
if ($subject === '' || $text === '') {
    respond(400, ['ok' => false, 'error' => 'Subject and text are required']);
}
$subject = cut($subject, 200);
$text = cut(str_replace(["\r\n", "\r"], "\n", $text), 20000);

// 4. Sender comes from config only, never from the request.
$from = (string) $config['FROM'];
$fromName = (string) ($config['FROM_NAME'] ?? "Techastra '26");
$replyTo = (string) ($config['REPLY_TO'] ?? $from);

if (!empty($config['DRY_RUN'])) {
    $entry = sprintf("===== %s =====\nFrom: %s <%s>\nTo: %s\nSubject: %s\n\n%s\n\n", date('c'), $fromName, $from, $to, $subject, $text);
    file_put_contents(__DIR__ . '/mail-log.txt', $entry, FILE_APPEND | LOCK_EX);
    respond(200, ['ok' => true, 'dryRun' => true]);
}

$headers = [
    'From' => sprintf('%s <%s>', encodeHeader($fromName), $from),
    'Reply-To' => $replyTo,
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => '8bit',
    'X-Mailer' => 'Techastra26',
];
$sent = mail($to, encodeHeader($subject), $text, $headers, '-f' . $from);

if (!$sent) {
    respond(500, ['ok' => false, 'error' => 'mail() failed']);
}
respond(200, ['ok' => true]);
