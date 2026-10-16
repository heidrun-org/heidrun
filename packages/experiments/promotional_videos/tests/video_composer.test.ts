import { describe, expect, it } from 'vitest';
import { VideoComposer } from '../src/video_composer.ts';

describe('VideoComposer.buildFilterGraph', () => {
	it('puts one comic word on the gameplay at each time, for 0.45 seconds', () => {
		const filterGraph = VideoComposer.buildFilterGraph({
			gameSeconds: 10,
			comicWordSeconds: [2.3, 2.6, 2.9],
			soundStartSeconds: null,
			hasIntroMusic: false,
			outroMusicSoundEndSeconds: null,
		});
		expect(filterGraph).toContain("enable='between(t,2.300,2.750)'");
		expect(filterGraph).toContain("enable='between(t,2.600,3.050)'");
		expect(filterGraph).toContain("enable='between(t,2.900,3.350)'");
		expect(filterGraph.match(/overlay=\d+:\d+:format=auto/g)).toHaveLength(3);
	});

	it('crossfades the intro to the gameplay after two seconds, because the intro lasts three seconds', () => {
		const filterGraph = VideoComposer.buildFilterGraph({
			gameSeconds: 10,
			comicWordSeconds: [],
			soundStartSeconds: null,
			hasIntroMusic: false,
			outroMusicSoundEndSeconds: null,
		});
		expect(filterGraph).toContain('xfade=transition=fade:duration=1:offset=2[introAndGameplay]');
	});

	it('fades from the gameplay to the outro 0.5 seconds before the end of the gameplay', () => {
		const filterGraph = VideoComposer.buildFilterGraph({
			gameSeconds: 10,
			comicWordSeconds: [2.3],
			soundStartSeconds: null,
			hasIntroMusic: false,
			outroMusicSoundEndSeconds: null,
		});
		expect(filterGraph).toContain('xfade=transition=fade:duration=0.5:offset=11.500[video]');
	});

	it('still makes a valid graph when the scenario has no shot', () => {
		const filterGraph = VideoComposer.buildFilterGraph({
			gameSeconds: 8,
			comicWordSeconds: [],
			soundStartSeconds: null,
			hasIntroMusic: false,
			outroMusicSoundEndSeconds: null,
		});
		expect(filterGraph).toContain('[gameplay0]null[gameplay]');
		expect(filterGraph).toContain('split=1[comicWord0]');
	});

	it('delays the sound by the length of the intro minus the crossfade, plus the start of the sound', () => {
		const filterGraph = VideoComposer.buildFilterGraph({
			gameSeconds: 10,
			comicWordSeconds: [],
			soundStartSeconds: 0.5,
			hasIntroMusic: false,
			outroMusicSoundEndSeconds: null,
		});
		expect(filterGraph).toContain('[4:a]aresample=48000:async=1:first_pts=0,volume=3,adelay=2500:all=1[gameSound]');
	});

	it('makes no audio line when the scenario has no sound', () => {
		const filterGraph = VideoComposer.buildFilterGraph({
			gameSeconds: 10,
			comicWordSeconds: [],
			soundStartSeconds: null,
			hasIntroMusic: false,
			outroMusicSoundEndSeconds: null,
		});
		expect(filterGraph).not.toContain('[audio]');
	});

	it('fades the intro music out during the crossfade of the picture, from second 2 to second 3', () => {
		const filterGraph = VideoComposer.buildFilterGraph({
			gameSeconds: 10,
			comicWordSeconds: [],
			soundStartSeconds: null,
			hasIntroMusic: true,
			outroMusicSoundEndSeconds: null,
		});
		expect(filterGraph).toContain('[4:a]aresample=48000,atrim=0:3,afade=t=out:st=2:d=1,volume=0.8');
		expect(filterGraph).toContain('anullsrc=channel_layout=stereo:sample_rate=48000:duration=14.500[silence]');
		expect(filterGraph).toContain('[silence][introMusic]amix=inputs=2:duration=first:normalize=0[audio]');
	});

	it('mixes the intro music with the recorded sound, and reads the music from the input after the sound', () => {
		const filterGraph = VideoComposer.buildFilterGraph({
			gameSeconds: 10,
			comicWordSeconds: [],
			soundStartSeconds: 0.5,
			hasIntroMusic: true,
			outroMusicSoundEndSeconds: null,
		});
		expect(filterGraph).toContain('[5:a]aresample=48000,atrim=0:3,afade=t=out:st=2:d=1');
		expect(filterGraph).toContain('[silence][gameSound][introMusic]amix=inputs=3:duration=first:normalize=0');
	});

	it('plays the last three seconds of the outro music before its last silence, and ends with the video', () => {
		const filterGraph = VideoComposer.buildFilterGraph({
			gameSeconds: 10,
			comicWordSeconds: [],
			soundStartSeconds: null,
			hasIntroMusic: false,
			outroMusicSoundEndSeconds: 27.75,
		});
		expect(filterGraph).toContain(
			'[4:a]aresample=48000,atrim=start=24.750:end=27.750,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.5,volume=0.4,adelay=11500:all=1[outroMusic]',
		);
		expect(filterGraph).toContain('[silence][outroMusic]amix=inputs=2:duration=first:normalize=0[audio]');
		expect(filterGraph).not.toContain('afade=t=out:st=2');
	});

	it('starts a short outro music later, so that its sound still ends with the video', () => {
		const filterGraph = VideoComposer.buildFilterGraph({
			gameSeconds: 10,
			comicWordSeconds: [],
			soundStartSeconds: null,
			hasIntroMusic: false,
			outroMusicSoundEndSeconds: 2,
		});
		expect(filterGraph).toContain('atrim=start=0.000:end=2.000');
		expect(filterGraph).toContain('adelay=12500:all=1[outroMusic]');
	});

	it('mixes the recorded sound, the intro music, and the outro music with the inputs in this order', () => {
		const filterGraph = VideoComposer.buildFilterGraph({
			gameSeconds: 10,
			comicWordSeconds: [],
			soundStartSeconds: 0.5,
			hasIntroMusic: true,
			outroMusicSoundEndSeconds: 27.75,
		});
		expect(filterGraph).toContain('[4:a]aresample=48000:async=1:first_pts=0,volume=3,adelay=2500:all=1');
		expect(filterGraph).toContain('[5:a]aresample=48000,atrim=0:3,afade=t=out:st=2:d=1');
		expect(filterGraph).toContain('[6:a]aresample=48000,atrim=start=24.750:end=27.750');
		expect(filterGraph).toContain('[silence][gameSound][introMusic][outroMusic]amix=inputs=4:duration=first:normalize=0');
	});
});
