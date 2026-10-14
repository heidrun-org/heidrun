// Two commands for the video recorder, run with `osascript -l JavaScript click_logger.js <command>`.
//   clicks              prints one JSON line for each left mouse button press, until it is stopped.
//   window <owner>      prints one JSON line with the identifier and the bounds of the largest window of the
//                       application <owner>.
// Positions are in screen points, from the top-left corner of the main screen, like the bounds of a window.
// The script needs no compiler and no permission: it reads the state of the mouse button 200 times each second.
ObjC.import('Cocoa');
ObjC.import('CoreGraphics');
ObjC.import('stdlib');

const POLL_SECONDS = 0.005;

function printJson(object) {
	const data = $(JSON.stringify(object) + '\n').dataUsingEncoding($.NSUTF8StringEncoding);
	$.NSFileHandle.fileHandleWithStandardOutput.writeData(data);
}

function fail(message, code) {
	const data = $(message + '\n').dataUsingEncoding($.NSUTF8StringEncoding);
	$.NSFileHandle.fileHandleWithStandardError.writeData(data);
	$.exit(code);
}

function printWindow(owner) {
	const options = $.kCGWindowListOptionOnScreenOnly | $.kCGWindowListExcludeDesktopElements;
	const windows = ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(options, $.kCGNullWindowID)));
	let best = null;
	let bestArea = 0;
	for (const window of windows) {
		if (String(window.kCGWindowOwnerName).toLowerCase() !== owner.toLowerCase() || window.kCGWindowLayer !== 0) {
			continue;
		}
		const bounds = window.kCGWindowBounds;
		const area = bounds.Width * bounds.Height;
		if (area > bestArea) {
			bestArea = area;
			best = {
				windowId: window.kCGWindowNumber,
				x: bounds.X,
				y: bounds.Y,
				width: bounds.Width,
				height: bounds.Height,
			};
		}
	}
	if (best === null) {
		fail('No visible window of the application ' + owner + '.', 1);
	}
	printJson(best);
}

function logClicks() {
	let wasDown = false;
	while (true) {
		const isDown = $.CGEventSourceButtonState($.kCGEventSourceStateCombinedSessionState, $.kCGMouseButtonLeft);
		if (isDown === true && wasDown === false) {
			const location = $.CGEventGetLocation($.CGEventCreate($()));
			printJson({
				timeSeconds: Date.now() / 1000,
				x: location.x,
				y: location.y,
			});
		}
		wasDown = isDown;
		delay(POLL_SECONDS);
	}
}

function run(argv) {
	if (argv.length >= 2 && argv[0] === 'window') {
		printWindow(argv[1]);
	} else if (argv.length >= 1 && argv[0] === 'clicks') {
		logClicks();
	} else {
		fail('Usage: click_logger.js clicks | click_logger.js window <owner>', 64);
	}
}
