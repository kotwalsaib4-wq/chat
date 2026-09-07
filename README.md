# WebRTC Live Call

A simple one-to-one audio/video calling website built with:

- Node.js
- Express
- Socket.IO
- WebRTC
- HTML/CSS/JavaScript

## How it works

The **receiver** keeps a browser tab open at:

`https://YOUR-DOMAIN/?role=receiver`

The other person opens:

`https://YOUR-DOMAIN/?role=caller`

They press **Request Live Call**. The receiver gets an incoming-call screen and can **Accept** or **Reject**.

After acceptance, the browsers establish a WebRTC peer-to-peer media connection.

## Run locally

Requirements: Node.js 18+.

```bash
npm install
npm start
```

Open:

- Receiver: `http://localhost:3000/?role=receiver`
- Caller: `http://localhost:3000/?role=caller`

For local testing, open the two URLs in two different browsers/tabs.

## Deploy on GitHub + Render/Railway/etc.

GitHub stores the source code; it does not itself run a persistent Node.js server.

1. Create a GitHub repository.
2. Upload this project.
3. Connect the repository to a Node.js hosting provider.
4. Build command: `npm install`
5. Start command: `npm start`
6. Use the HTTPS URL supplied by the host.

HTTPS is important because browsers generally require a secure context for camera/microphone access.

## Important production note: TURN

The included STUN servers help browsers discover network paths, but some networks use NAT/firewalls that prevent a direct WebRTC connection.

For reliable production calls, add a TURN server and put its credentials in `rtcConfig` in `public/app.js`.

Do not put long-lived TURN credentials, private API keys, or other secrets in client-side JavaScript. Use short-lived TURN credentials or a server-side credential service.

## Privacy and consent

This project intentionally requires:

- the caller to press the call button;
- the receiver to explicitly accept;
- browser permission for camera/microphone.

It does not provide hidden camera/microphone access or silent recording.

## Security improvements before public use

For a real public service, add:

- authentication;
- private/random room IDs;
- rate limiting;
- CSRF/origin protections where applicable;
- authorization checks for signaling messages;
- short-lived TURN credentials;
- HTTPS;
- logging/monitoring;
- a privacy policy and terms appropriate to your use case.
