# Heidrun Mobile

- Created: 12 October 2026
- Last updated: 16 October 2026
- Status: Idea that nobody has decided to build yet
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 274](https://github.com/heidrun-org/heidrun/issues/274)

Heidrun Mobile is an idea for a second front end of Heidrun. It is a small application for a phone. It lets the developer keep the agents working when the developer is away from the desk. The idea comes from the meeting notes in [issue #274](https://github.com/heidrun-org/heidrun/issues/274).

## What exists today

Heidrun already has a first mobile access. It is a small web page that the application serves from the Mac, only on the Tailscale address of the Mac, and every request needs a pairing key. The developer scans a QR code, then adds the page to the Home Screen of the iPhone. See [mobile.rs](../../packages/apps/desktop_tauri/src/mobile.rs), [mobile_server](../../packages/auxiliary/mobile_server/CONTEXT.md), [mobile_website](../../packages/auxiliary/mobile_website/CONTEXT.md), and [mobile.ts](../../packages/apps/web_frontend/src/stores/mobile.ts).

Today the page does four things:

- It lists the agents, with their status.
- It answers the menu of a blocked agent: allow or refuse. The same guards as on the desktop apply to dangerous commands.
- It sends a prompt to an agent, and it interrupts an agent.
- It shows the end of the output of an agent.

Heidrun Mobile grows this page into a real application. The pairing key, the Tailscale address, and the guards stay as they are.

## The idea

- Heidrun Mobile is a different front end for Heidrun desktop. It is a progressive web application, so it installs on the Home Screen of the phone and works like an application.
- The developer connects the phone to the Mac through Tailscale, which is a virtual private network. The agents keep running on the Mac. The phone is only a remote control.
- Heidrun Mobile is made for a small screen. It shows only a few parts of Heidrun desktop, and not the whole window.

## The screens

### Welcome page

The first page. It shows the goat in a small circle at the top, then the name "Heidrun", the motto, and the description of the product on two lines, "Keep your agents working." and "Know which one needs you.", all centered, and the button "Go to the app" at the bottom of the screen, where the thumb is. It needs no data from the Mac, so it shows before the pairing, and before the Mac answers. When the address of the page names no screen, the page opens on the welcome page. The button "Go to the app" opens the Dashboard.

### Dashboard

The first screen of the application. It shows the whole situation at a glance: how many coding agents need the developer, how many work, and the usage limits. A tap on a count opens the screen with the details. It is the first button of the bottom bar.

### Needs your attention

The second screen. It lists every agent that is blocked, that asks a question, or that has finished, with a status dot for each one. It shows the same information as the Needs you sidebar section of Heidrun desktop, and the blocked agents come first. A tap on an agent opens its pane.

### Panes

The developer selects a pane in the list of all the panes of Heidrun, grouped by workspace and tab. The screen shows one pane at a time: the end of its output, a field for a prompt, and the buttons to allow, refuse, or interrupt. The developer can open a pane and close a pane from the phone.

### Macros

The list of the macros. A tap on a macro writes its text into the selected pane. The developer never types on the keyboard of the phone.

### Launchers

The list of the launchers of the Launchers sidebar section. A tap on a launcher runs it, and the screen shows its result.

### Voice

The developer speaks a prompt with the microphone of the phone, and the text goes into the field for a prompt. This is a second way to avoid the keyboard.

### Notifications

The phone shows a notification when an agent needs the developer: the agent is blocked, asks a question, or has finished. A tap on the notification opens the pane of that agent.

## What stays out

Heidrun Mobile does not show the Git sidebar section, the Past chats sidebar section, the Clipboard sidebar section, the Settings window, the tab bar, the layout of several panes, or the pinned panes. The developer does these things at the desk.

## Points to decide

- **A new application or a bigger page.** Today the page is one file that is built into the Rust program. Heidrun Mobile may need its own package, with its own build.
- **Macros and launchers must reach the phone.** The personal macros are saved in the window of Heidrun desktop, and the macros of the project are saved in `.heidrun/config.json`. The phone cannot read them today. Heidrun desktop must send them through the same channel as the other calls of the phone.
- **Open a pane.** It is not clear whether "open a pane" means to show an existing pane, or to create a new pane that starts an agent. Closing a pane stops its agent, so it needs a confirmation.
- **The guards.** A macro, a launcher, and a voice prompt from the phone must pass the same guards as a prompt that the developer types on the desktop.

## What to prove before the build

Some features of a progressive web application work only on a secure address, which means an address that starts with `https`. Today the page uses `http` on the Tailscale address. These features need a live test with a real iPhone:

1. The service worker, which the installation as an application needs. Does it work on the Tailscale address? Tailscale can give a certificate for the name of the Mac, if the developer turns on its HTTPS option.
2. The notifications. On the iPhone, they work only after the installation on the Home Screen, and they use a push service of Apple. Does this work when the Mac is reachable only through Tailscale?
3. The microphone. Does the Web Speech API work in an application installed on the Home Screen? If it does not, the microphone key of the iPhone keyboard is the fallback.

If the first test fails, the notifications and the microphone fail with it, and the plan must change before any code is written.
