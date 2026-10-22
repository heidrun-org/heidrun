import { describe, expect, it } from 'vitest';
import { ColorPainter } from '../src/color_painter';

describe('ColorPainter', () => {
	it('sets the text color and the background color from the data attributes', () => {
		const container = document.createElement('div');
		container.innerHTML = '<span data-fg="#ff0000">a</span><span data-bg="#00ff00">b</span><span>c</span>';
		ColorPainter.paint(container);
		const spans = container.querySelectorAll('span');
		expect(spans[0].style.color).toBe('rgb(255, 0, 0)');
		expect(spans[1].style.backgroundColor).toBe('rgb(0, 255, 0)');
		expect(spans[2].getAttribute('style')).toBeNull();
	});

	it('sets both colors of one element', () => {
		const container = document.createElement('div');
		container.innerHTML = '<span data-fg="#010203" data-bg="#040506">a</span>';
		ColorPainter.paint(container);
		const span = container.querySelector('span') as HTMLElement;
		expect(span.style.color).toBe('rgb(1, 2, 3)');
		expect(span.style.backgroundColor).toBe('rgb(4, 5, 6)');
	});
});
