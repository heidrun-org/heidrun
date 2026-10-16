# Heidrun Mobile

- Created: 12 October 2026
- Last updated: 16 October 2026
- Status: Maintained description of Heidrun Mobile
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun: Heidrun Mobile](../agents_rules/glossary/heidrun_mobile.md), [User interface of Heidrun Mobile](../agents_rules/user_interface/heidrun_mobile/screens.md)
- Related issue: [issue 274](https://github.com/heidrun-org/heidrun/issues/274), [issue 581](https://github.com/heidrun-org/heidrun/issues/581)

Heidrun Mobile is the second front end of Heidrun. It is a mobile website that the developer opens on a phone, to keep the coding agents working when the developer is away from the desk. The coding agents keep running on the computer. The phone is only a remote control. The idea comes from the meeting notes in [issue #274](https://github.com/heidrun-org/heidrun/issues/274).

## How it works

- The mobile website, in the package [mobile_website](../../packages/auxiliary/mobile_website/CONTEXT.md), is the page of the phone. It talks only to the mobile server.
- The mobile server, in the package [mobile_server](../../packages/auxiliary/mobile_server/CONTEXT.md), is a Rust library that the desktop application starts. It serves the files of the mobile website, checks the pairing key, and accepts only a closed list of methods.
- An ngrok tunnel gives the mobile server a fixed public `https` address. The developer scans a QR code with the camera of the phone, and the QR code holds the address and the pairing key.
- Each call of the phone reaches the web front end of the desktop application through the event `mobile-call`. The file [mobile.ts](../../packages/apps/web_frontend/src/stores/mobile.ts) answers it with the same data and the same guards as the desktop.

## Decisions

- No private network. A person who wants a private network installs one without the help of Heidrun.
- No progressive web application. With the free plan of ngrok, the warning page of ngrok (`ERR_NGROK_6024`) replaces the manifest and the icons, so Chrome on Android cannot install the page. The developer adds a shortcut to the Home Screen of the phone instead.
- The texts say "phone", never "iPhone", and "computer", never the name of one brand of computer. A test checks it.

## The screens

The rules of each screen are in [the user interface of Heidrun Mobile](../agents_rules/user_interface/heidrun_mobile/screens.md). In short:

- The welcome page, the Dashboard, the Needs you screen, the Panes screen, and the screen of one pane. The Panes screen lists the plain terminals too. The phone reads them, and types in them only when the setting "Allow typing in terminals from the phone" is on and the developer confirms each time.
- The macro button in the top bar of the screen of one pane: a macro writes its text into the field for a prompt.
- The Launchers screen: a launcher runs or stops on the computer.
- The microphone button on the screen of one pane: the voice fills the field for a prompt, with the Web Speech API of the browser.

## The guards

A prompt, a macro, an answer to a menu, a launcher, and a command typed in a plain terminal from the phone pass the same guards as on the desktop. When the guards want a confirmation, the computer sends the command to the phone, and the phone asks the developer. A command that the project blocks never runs.

## What stays out

Heidrun Mobile does not show the Source control sidebar section, the Past chats sidebar section, the Clipboard sidebar section, the Settings window, the tab bar, the layout of several panes, or the pinned panes. The developer does these things at the desk.

## What is not done

- The notifications, on Android only. Chrome on Android shows a Web Push notification in a normal tab, with a service worker on `https`. An iPhone shows a notification only from an installed progressive web application, so there is no notification on an iPhone. The Dashboard already has a live test section (service worker `sw.js`, permission, test notification). Next: the push from the computer, after the live test works on a real Android phone ([issue 581](https://github.com/heidrun-org/heidrun/issues/581)).
- The microphone needs a live test on a real phone through the ngrok address. When the Web Speech API does not work, the page shows no microphone button, and the microphone key of the keyboard of the phone is the fallback.
