import { reactive, ref } from 'vue';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ThemePalette — applies a named color theme throughout the application
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The resolved application appearance, with separate colour values for light and dark modes. */
export type PaletteMode = 'light' | 'dark';

/** A saved, named set of application-wide colours. */
export type ColorTheme = {
	/** Stable identifier saved on this device. */
	id: string;
	/** Shared colour values for the dark application appearance. */
	dark: Record<string, string>;
	/** Shared colour values for the light application appearance. */
	light: Record<string, string>;
};

/** Manages named color themes selected in Settings. */
export class ThemePalette {
	/** The local storage key for the selected color theme. */
	static readonly STORAGE_KEY = 'heidrun.color-theme';

	/** The color themes available in Settings. The Amber theme keeps the standard application colours. */
	static readonly COLOR_THEMES: ColorTheme[] = [
		{
			id: 'amber',
			dark: {},
			light: {},
		},
		{
			id: 'ocean',
			dark: {
				bg: '#1b232d',
				panel: '#111923',
				bar: '#121b26',
				shell: '#18212b',
				side: '#18212b',
				field: '#141e29',
				raised: '#202c39',
				hover: '#233244',
				line: '#2c3948',
				'line-strong': '#34485b',
				accent: '#4c9aff',
				'action-bg': '#2767c8',
				'action-hover': '#3c7ee0',
				'action-pressed': '#1d56ad',
				'action-text': '#ffffff',
				focus: '#78aaff',
				link: '#78b7ff',
				sel: '#1c2c42',
				'selection-border': '#78aaff',
			},
			light: {
				bg: '#f1f5fa',
				panel: '#ffffff',
				bar: '#f6f8fb',
				shell: '#e8eef5',
				side: '#edf2f8',
				field: '#ffffff',
				raised: '#f8fafd',
				hover: '#e6eef8',
				line: '#d6e0eb',
				'line-strong': '#b7c6d7',
				accent: '#145bb8',
				'action-bg': '#145bb8',
				'action-hover': '#0e4b9f',
				'action-pressed': '#0b3d82',
				'action-text': '#ffffff',
				focus: '#175caa',
				link: '#175caa',
				sel: '#e0edff',
				'selection-border': '#175caa',
			},
		},
		{
			id: 'forest',
			dark: {
				bg: '#1d2620',
				panel: '#121b15',
				bar: '#141e17',
				shell: '#1a241d',
				side: '#1a241d',
				field: '#151f18',
				raised: '#232f26',
				hover: '#29392d',
				line: '#303b32',
				'line-strong': '#435348',
				accent: '#50bd7a',
				'action-bg': '#287c4b',
				'action-hover': '#33965b',
				'action-pressed': '#20643d',
				'action-text': '#ffffff',
				focus: '#73d796',
				link: '#7bd49a',
				sel: '#1b3024',
				'selection-border': '#73d796',
			},
			light: {
				bg: '#f2f6f1',
				panel: '#ffffff',
				bar: '#f7faf6',
				shell: '#e9f0e8',
				side: '#edf3eb',
				field: '#ffffff',
				raised: '#f9fbf8',
				hover: '#e5eee3',
				line: '#d7e1d5',
				'line-strong': '#bbcbb9',
				accent: '#17643b',
				'action-bg': '#17643b',
				'action-hover': '#11532f',
				'action-pressed': '#0d4226',
				'action-text': '#ffffff',
				focus: '#17643b',
				link: '#17643b',
				sel: '#e0f2e7',
				'selection-border': '#17643b',
			},
		},
		{
			id: 'violet',
			dark: {
				bg: '#241f2d',
				panel: '#17131d',
				bar: '#191520',
				shell: '#201b29',
				side: '#201b29',
				field: '#1a1522',
				raised: '#2b2537',
				hover: '#352b44',
				line: '#37313f',
				'line-strong': '#4a4058',
				accent: '#ad86f5',
				'action-bg': '#7650ba',
				'action-hover': '#8962d0',
				'action-pressed': '#60409a',
				'action-text': '#ffffff',
				focus: '#b89aff',
				link: '#c0a3ff',
				sel: '#2d2440',
				'selection-border': '#b89aff',
			},
			light: {
				bg: '#f5f2f9',
				panel: '#ffffff',
				bar: '#faf8fc',
				shell: '#eee9f5',
				side: '#f1edf7',
				field: '#ffffff',
				raised: '#fcfaff',
				hover: '#ede7f5',
				line: '#ddd5e8',
				'line-strong': '#c5b8d8',
				accent: '#624099',
				'action-bg': '#624099',
				'action-hover': '#52347f',
				'action-pressed': '#432968',
				'action-text': '#ffffff',
				focus: '#624099',
				link: '#624099',
				sel: '#eee7fa',
				'selection-border': '#624099',
			},
		},
		{
			id: 'rose',
			dark: {
				bg: '#2a2023',
				panel: '#1b1417',
				bar: '#1e161a',
				shell: '#261c20',
				side: '#261c20',
				field: '#1e161a',
				raised: '#33252a',
				hover: '#3e2a31',
				line: '#3d3034',
				'line-strong': '#574147',
				accent: '#f07d98',
				'action-bg': '#b84763',
				'action-hover': '#d05a76',
				'action-pressed': '#973950',
				'action-text': '#ffffff',
				focus: '#ff91aa',
				link: '#ff9caf',
				sel: '#39232a',
				'selection-border': '#ff91aa',
			},
			light: {
				bg: '#faf1f2',
				panel: '#ffffff',
				bar: '#fdf8f8',
				shell: '#f4e9eb',
				side: '#f7edef',
				field: '#ffffff',
				raised: '#fffafb',
				hover: '#f5e5e8',
				line: '#e7d5d9',
				'line-strong': '#d3b9c0',
				accent: '#9d304a',
				'action-bg': '#9d304a',
				'action-hover': '#84263d',
				'action-pressed': '#6c1f32',
				'action-text': '#ffffff',
				focus: '#9d304a',
				link: '#9d304a',
				sel: '#f8e4e9',
				'selection-border': '#9d304a',
			},
		},
	];

	/** The chosen theme, saved across application restarts. */
	static readonly selectedTheme = ref(ThemePalette._loadTheme());

	/** The appearance currently applied to the application. */
	static readonly state = reactive({
		mode: 'dark' as PaletteMode,
	});

	/**
	 * Applies the saved color theme after the application appearance changes.
	 * @param mode - Light or dark appearance.
	 * @returns Nothing.
	 */
	static activate(mode: PaletteMode): void {
		ThemePalette.state.mode = mode;
		const allNames = new Set(ThemePalette.COLOR_THEMES.flatMap((colorTheme) => Object.keys(colorTheme.dark)));
		for (const name of allNames) {
			document.documentElement.style.removeProperty(`--${name}`);
		}
		const colorTheme = ThemePalette.COLOR_THEMES.find(({ id }) => id === ThemePalette.selectedTheme.value);
		for (const [name, value] of Object.entries(colorTheme?.[mode] ?? {})) {
			document.documentElement.style.setProperty(`--${name}`, value);
		}
	}

	/**
	 * Applies and remembers one available color theme.
	 * @param id - Stable identifier of the selected theme.
	 * @returns Nothing.
	 */
	static selectTheme(id: string): void {
		if (ThemePalette.COLOR_THEMES.some((colorTheme) => colorTheme.id === id) === false) {
			return;
		}
		ThemePalette.selectedTheme.value = id;
		ThemePalette.activate(ThemePalette.state.mode);
		localStorage.setItem(ThemePalette.STORAGE_KEY, id);
	}

	/**
	 * Loads a saved theme, falling back to the standard application colours.
	 * @returns A valid color theme identifier.
	 */
	private static _loadTheme(): string {
		const saved = localStorage.getItem(ThemePalette.STORAGE_KEY);
		return ThemePalette.COLOR_THEMES.some((colorTheme) => colorTheme.id === saved) ? saved as string : 'amber';
	}
}
