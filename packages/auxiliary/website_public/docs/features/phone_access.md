# The phone access

A coding agent can wait for an hour only for one permission, while you are away from your desk.

## What Heidrun does

Heidrun serves a small web page from your Mac. From your iPhone or your iPad, you can:

- See the coding agents and their state, and find the ones that wait for a decision.
- Allow or refuse the request of a blocked coding agent. The same guards as on your Mac apply to a dangerous command.
- Send a prompt to a coding agent, or interrupt a coding agent.
- Read the end of the output of a coding agent.

## Safe by design

- Heidrun serves the page only on the Tailscale address of your Mac. Tailscale is a virtual private network: only your own devices reach the page, never the open Internet.
- Each request needs a pairing key. Each phone pairs once, with a QR code.
- The QR code holds the pairing key. Do not show the QR code, and do not share it.
- The button "Revoke the paired devices" makes every paired device scan the QR code again.

## Set up the phone access

1. Install Tailscale on your Mac and on your iPhone or your iPad, and connect them with the same account.
2. In Heidrun, open the section "Mobile access" of the Settings window, and click "Turn on mobile access". macOS can ask you to allow incoming connections for Heidrun: answer "Allow".
3. Scan the QR code with the camera of the phone, then open the link in Safari.
4. In Safari, tap Share, then "Add to Home Screen". Heidrun then opens like an application.

*Even Odin leaves Valhalla sometimes. Now the einherjar can still reach him.*
