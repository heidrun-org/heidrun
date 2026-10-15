///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ScrollSimulator — gives jsdom a scroll position and a size, which it does not have
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Makes `scrollTop`, `scrollHeight`, and `clientHeight` work on every element, with fixed sizes. The output of a pane
 * is 1000 pixels high inside a box of 200 pixels, so its end is at 800. The element `main` is 2000 pixels high inside
 * a box of 500 pixels, so its end is at 1500.
 */
export class ScrollSimulator {
	/** The scroll position of each element that was scrolled. */
	private static readonly positions = new WeakMap<Element, number>();

	/** The properties that were replaced, to put them back. */
	private static readonly saved: Array<[string, PropertyDescriptor | undefined]> = [];

	/**
	 * Replaces the three properties on all elements.
	 */
	static install(): void {
		ScrollSimulator.replace('scrollHeight', {
			get(this: Element): number {
				return ScrollSimulator.heightOf(this);
			},
		});
		ScrollSimulator.replace('clientHeight', {
			get(this: Element): number {
				return ScrollSimulator.boxOf(this);
			},
		});
		ScrollSimulator.replace('scrollTop', {
			get(this: Element): number {
				return ScrollSimulator.positions.get(this) ?? 0;
			},
			set(this: Element, value: number) {
				const end = Math.max(0, ScrollSimulator.heightOf(this) - ScrollSimulator.boxOf(this));
				ScrollSimulator.positions.set(this, Math.min(Math.max(0, value), end));
			},
		});
	}

	/**
	 * Puts the original properties back.
	 */
	static restore(): void {
		for (const [name, descriptor] of ScrollSimulator.saved.splice(0)) {
			if (descriptor === undefined) {
				Reflect.deleteProperty(Element.prototype, name);
			} else {
				Object.defineProperty(Element.prototype, name, descriptor);
			}
		}
	}

	/**
	 * Gives the end of the scroll of an element.
	 * @param element The element.
	 * @returns The largest value of `scrollTop`.
	 */
	static endOf(element: Element): number {
		return ScrollSimulator.heightOf(element) - ScrollSimulator.boxOf(element);
	}

	private static replace(name: string, accessor: PropertyDescriptor): void {
		ScrollSimulator.saved.push([name, Object.getOwnPropertyDescriptor(Element.prototype, name)]);
		Object.defineProperty(Element.prototype, name, {
			...accessor,
			configurable: true,
		});
	}

	private static heightOf(element: Element): number {
		if (element.classList.contains('output')) {
			return 1000;
		}
		return element.tagName === 'MAIN' ? 2000 : 0;
	}

	private static boxOf(element: Element): number {
		if (element.classList.contains('output')) {
			return 200;
		}
		return element.tagName === 'MAIN' ? 500 : 0;
	}
}
